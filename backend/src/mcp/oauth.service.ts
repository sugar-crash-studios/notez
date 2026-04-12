import { randomBytes, createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import { prisma } from '../lib/db.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';

// Token TTLs
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const CONSENT_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

// Redirect URI allowlist for known Claude connector domains
const ALLOWED_REDIRECT_DOMAINS = [
  'claude.ai',
  'www.claude.ai',
  'anthropic.com',
  'www.anthropic.com',
];

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/**
 * Validate that a redirect URI domain is in the allowlist.
 * Also blocks private IPs (SSRF prevention).
 */
export function validateRedirectUri(uri: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(uri);
  } catch {
    return false;
  }

  // Must be HTTPS
  if (parsed.protocol !== 'https:') {
    return false;
  }

  // Must not have a user/password component
  if (parsed.username || parsed.password) {
    return false;
  }

  // Check domain against allowlist
  const hostname = parsed.hostname.toLowerCase();

  // Allow subdomains of allowed domains
  return ALLOWED_REDIRECT_DOMAINS.some(
    (allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`)
  );
}

// --- Client Registration (DCR) ---

export interface RegisterClientInput {
  clientName?: string;
  clientUri?: string;
  redirectUris: string[];
  grantTypes?: string[];
  responseTypes?: string[];
  scope?: string;
  tokenEndpointAuthMethod?: string;
}

export interface RegisterClientResult {
  clientId: string;
  clientSecret: string;
  clientIdIssuedAt: number;
  clientSecretExpiresAt: number;
  clientName?: string;
  redirectUris: string[];
  grantTypes: string[];
  responseTypes: string[];
  scope?: string;
  tokenEndpointAuthMethod: string;
}

export async function registerClient(input: RegisterClientInput): Promise<RegisterClientResult> {
  // Validate all redirect URIs
  for (const uri of input.redirectUris) {
    if (!validateRedirectUri(uri)) {
      throw new OAuthError('invalid_client_metadata', `Invalid redirect URI: ${uri}. Must be HTTPS on an allowed domain.`);
    }
  }

  if (!input.redirectUris.length) {
    throw new OAuthError('invalid_client_metadata', 'At least one redirect_uri is required');
  }

  const clientId = `notez_${randomBytes(16).toString('hex')}`;
  const clientSecret = randomBytes(32).toString('base64url');
  const clientSecretHash = await bcrypt.hash(clientSecret, 10);

  // Client secret expires in 90 days
  const clientSecretExpiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

  const client = await prisma.oAuthClient.create({
    data: {
      clientId,
      clientSecretHash,
      clientSecretExpiresAt,
      clientName: input.clientName || null,
      clientUri: input.clientUri || null,
      redirectUris: input.redirectUris,
      grantTypes: input.grantTypes || ['authorization_code', 'refresh_token'],
      responseTypes: input.responseTypes || ['code'],
      scope: input.scope || 'mcp:read',
      tokenEndpointAuthMethod: input.tokenEndpointAuthMethod || 'client_secret_post',
      status: 'pending_approval', // Admin must approve
    },
  });

  return {
    clientId: client.clientId,
    clientSecret,
    clientIdIssuedAt: Math.floor(client.createdAt.getTime() / 1000),
    clientSecretExpiresAt: Math.floor(clientSecretExpiresAt.getTime() / 1000),
    clientName: client.clientName || undefined,
    redirectUris: client.redirectUris,
    grantTypes: client.grantTypes,
    responseTypes: client.responseTypes,
    scope: client.scope || undefined,
    tokenEndpointAuthMethod: client.tokenEndpointAuthMethod,
  };
}

// --- Client Lookup & Validation ---

export async function getClientByClientId(clientId: string) {
  return prisma.oAuthClient.findUnique({ where: { clientId } });
}

export async function validateClientCredentials(
  clientId: string,
  clientSecret: string
): Promise<{ id: string; clientId: string; scope: string | null; redirectUris: string[] }> {
  const client = await prisma.oAuthClient.findUnique({ where: { clientId } });

  if (!client) {
    throw new OAuthError('invalid_client', 'Unknown client');
  }

  if (client.status !== 'approved') {
    throw new OAuthError('invalid_client', 'Client not approved');
  }

  if (client.clientSecretExpiresAt && client.clientSecretExpiresAt < new Date()) {
    throw new OAuthError('invalid_client', 'Client secret expired');
  }

  const valid = await bcrypt.compare(clientSecret, client.clientSecretHash);
  if (!valid) {
    throw new OAuthError('invalid_client', 'Invalid client credentials');
  }

  return { id: client.id, clientId: client.clientId, scope: client.scope, redirectUris: client.redirectUris };
}

// --- Authorization Codes ---

export interface CreateAuthCodeInput {
  clientId: string; // internal ID
  userId: string;
  redirectUri: string;
  scope: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
}

export async function createAuthorizationCode(input: CreateAuthCodeInput): Promise<string> {
  const code = generateToken();
  const codeHash = sha256(code);

  await prisma.oAuthAuthorizationCode.create({
    data: {
      codeHash,
      clientId: input.clientId,
      userId: input.userId,
      redirectUri: input.redirectUri,
      scope: input.scope,
      codeChallenge: input.codeChallenge,
      codeChallengeMethod: input.codeChallengeMethod || 'S256',
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });

  return code;
}

export async function exchangeAuthorizationCode(
  clientInternalId: string,
  code: string,
  codeVerifier: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string }> {
  const codeHash = sha256(code);

  const authCode = await prisma.oAuthAuthorizationCode.findUnique({
    where: { codeHash },
  });

  if (!authCode) {
    throw new OAuthError('invalid_grant', 'Invalid authorization code');
  }

  if (authCode.clientId !== clientInternalId) {
    throw new OAuthError('invalid_grant', 'Code was not issued to this client');
  }

  if (authCode.usedAt) {
    // Code reuse detected. Per security best practices, revoke all tokens for this grant.
    await prisma.oAuthAccessToken.updateMany({
      where: { clientId: clientInternalId, userId: authCode.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new OAuthError('invalid_grant', 'Authorization code already used');
  }

  if (authCode.expiresAt < new Date()) {
    throw new OAuthError('invalid_grant', 'Authorization code expired');
  }

  if (authCode.redirectUri !== redirectUri) {
    throw new OAuthError('invalid_grant', 'Redirect URI mismatch');
  }

  // PKCE verification
  const expectedChallenge = createHash('sha256')
    .update(codeVerifier)
    .digest('base64url');

  if (expectedChallenge !== authCode.codeChallenge) {
    throw new OAuthError('invalid_grant', 'PKCE verification failed');
  }

  // Mark code as used
  await prisma.oAuthAuthorizationCode.update({
    where: { id: authCode.id },
    data: { usedAt: new Date() },
  });

  // Generate tokens
  return issueTokens(clientInternalId, authCode.userId, authCode.scope);
}

// --- Token Issuance ---

async function issueTokens(
  clientId: string,
  userId: string,
  scope: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string }> {
  const accessToken = generateToken();
  const refreshToken = generateToken();

  await prisma.oAuthAccessToken.create({
    data: {
      tokenHash: sha256(accessToken),
      clientId,
      userId,
      scope,
      expiresAt: new Date(Date.now() + ACCESS_TOKEN_TTL_MS),
      refreshTokenHash: sha256(refreshToken),
      refreshExpiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    scope,
  };
}

// --- Refresh Token Exchange ---

export async function exchangeRefreshToken(
  clientInternalId: string,
  refreshToken: string,
  requestedScope?: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string }> {
  const refreshHash = sha256(refreshToken);

  const token = await prisma.oAuthAccessToken.findUnique({
    where: { refreshTokenHash: refreshHash },
  });

  if (!token) {
    throw new OAuthError('invalid_grant', 'Invalid refresh token');
  }

  if (token.clientId !== clientInternalId) {
    throw new OAuthError('invalid_grant', 'Token not issued to this client');
  }

  if (token.revokedAt) {
    throw new OAuthError('invalid_grant', 'Token has been revoked');
  }

  if (token.refreshRotatedAt) {
    // Replay attack detected! Revoke entire token family for this client+user.
    await prisma.oAuthAccessToken.updateMany({
      where: { clientId: clientInternalId, userId: token.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    throw new OAuthError('invalid_grant', 'Refresh token replay detected');
  }

  if (token.refreshExpiresAt && token.refreshExpiresAt < new Date()) {
    throw new OAuthError('invalid_grant', 'Refresh token expired');
  }

  // Scope cannot be escalated
  const scope = requestedScope || token.scope;
  const originalScopes = token.scope.split(' ');
  const requestedScopes = scope.split(' ');
  if (requestedScopes.some((s) => !originalScopes.includes(s))) {
    throw new OAuthError('invalid_scope', 'Cannot escalate scope via refresh');
  }

  // Rotate: mark old refresh token as rotated, issue new tokens
  await prisma.oAuthAccessToken.update({
    where: { id: token.id },
    data: { refreshRotatedAt: new Date() },
  });

  return issueTokens(clientInternalId, token.userId, scope);
}

// --- Token Verification (for MCP transport auth) ---

export async function verifyAccessToken(accessToken: string): Promise<AuthInfo> {
  const tokenHash = sha256(accessToken);

  const token = await prisma.oAuthAccessToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, isActive: true } } },
  });

  if (!token) {
    throw new OAuthError('invalid_token', 'Unknown token');
  }

  if (token.revokedAt) {
    throw new OAuthError('invalid_token', 'Token revoked');
  }

  if (token.expiresAt < new Date()) {
    throw new OAuthError('invalid_token', 'Token expired');
  }

  if (!token.user.isActive) {
    throw new OAuthError('invalid_token', 'User account inactive');
  }

  return {
    token: accessToken,
    clientId: token.clientId,
    scopes: token.scope.split(' '),
    expiresAt: Math.floor(token.expiresAt.getTime() / 1000),
    extra: {
      userId: token.userId,
    },
  };
}

// --- Token Revocation ---

export async function revokeToken(
  clientInternalId: string,
  token: string,
  tokenTypeHint?: 'access_token' | 'refresh_token'
): Promise<void> {
  const hash = sha256(token);

  // Try as access token first (or if hinted)
  if (!tokenTypeHint || tokenTypeHint === 'access_token') {
    const result = await prisma.oAuthAccessToken.updateMany({
      where: { tokenHash: hash, clientId: clientInternalId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count > 0) return;
  }

  // Try as refresh token
  if (!tokenTypeHint || tokenTypeHint === 'refresh_token') {
    const result = await prisma.oAuthAccessToken.updateMany({
      where: { refreshTokenHash: hash, clientId: clientInternalId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (result.count > 0) return;
  }

  // Per RFC 7009, if the token is not found or already revoked, do nothing (no error)
}

// --- User Consent ---

export async function hasActiveConsent(userId: string, clientId: string, scope: string): Promise<boolean> {
  const consent = await prisma.oAuthUserConsent.findUnique({
    where: { userId_clientId: { userId, clientId } },
  });

  if (!consent) return false;
  if (consent.expiresAt < new Date()) return false;

  // Check that existing consent covers all requested scopes
  const consentedScopes = consent.scope.split(' ');
  const requestedScopes = scope.split(' ');
  return requestedScopes.every((s) => consentedScopes.includes(s));
}

export async function grantConsent(userId: string, clientId: string, scope: string): Promise<void> {
  await prisma.oAuthUserConsent.upsert({
    where: { userId_clientId: { userId, clientId } },
    create: {
      userId,
      clientId,
      scope,
      expiresAt: new Date(Date.now() + CONSENT_TTL_MS),
    },
    update: {
      scope,
      grantedAt: new Date(),
      expiresAt: new Date(Date.now() + CONSENT_TTL_MS),
    },
  });
}

// --- Admin Operations ---

export async function approveClient(clientId: string, adminUserId: string): Promise<void> {
  await prisma.oAuthClient.update({
    where: { clientId },
    data: { status: 'approved', approvedByUserId: adminUserId },
  });
}

export async function rejectClient(clientId: string): Promise<void> {
  await prisma.oAuthClient.update({
    where: { clientId },
    data: { status: 'rejected' },
  });
}

export async function listClients(status?: string) {
  return prisma.oAuthClient.findMany({
    where: status ? { status } : undefined,
    select: {
      id: true,
      clientId: true,
      clientName: true,
      clientUri: true,
      redirectUris: true,
      scope: true,
      status: true,
      createdAt: true,
      approvedBy: { select: { username: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// --- Cleanup ---

export async function cleanupExpiredOAuthData(): Promise<void> {
  const now = new Date();

  // Delete expired authorization codes (older than 1 hour to be safe)
  await prisma.oAuthAuthorizationCode.deleteMany({
    where: { expiresAt: { lt: new Date(now.getTime() - 60 * 60 * 1000) } },
  });

  // Delete expired and revoked access tokens (older than 7 days)
  await prisma.oAuthAccessToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) }, refreshExpiresAt: { lt: now } },
        { revokedAt: { lt: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) } },
      ],
    },
  });

  // Delete expired consents
  await prisma.oAuthUserConsent.deleteMany({
    where: { expiresAt: { lt: now } },
  });
}

// --- OAuth Error ---

export class OAuthError extends Error {
  constructor(
    public readonly errorCode: string,
    message: string
  ) {
    super(message);
    this.name = 'OAuthError';
  }

  toJSON() {
    return {
      error: this.errorCode,
      error_description: this.message,
    };
  }
}
