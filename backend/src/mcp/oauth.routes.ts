import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import {
  registerClient,
  validateClientCredentials,
  getClientByClientId,
  createAuthorizationCode,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  revokeToken,
  grantConsent,
  approveClient,
  rejectClient,
  listClients,
  OAuthError,
  validateRedirectUri,
} from './oauth.service.js';

const MCP_SCOPES_SUPPORTED = ['mcp:read', 'mcp:write'];

/**
 * OAuth 2.1 routes for remote MCP connector.
 * Implements: RFC 8414 (metadata), RFC 7591 (DCR), RFC 6749 (authz), RFC 7009 (revocation)
 */
export async function oauthRoutes(fastify: FastifyInstance) {
  // Plugin-level error handler for OAuth errors per RFC 6749 format
  fastify.setErrorHandler((error, _request, reply) => {
    if (error instanceof OAuthError) {
      const statusCode = error.errorCode === 'invalid_client' ? 401
        : error.errorCode === 'invalid_token' ? 401
        : error.errorCode === 'invalid_grant' ? 400
        : error.errorCode === 'invalid_scope' ? 400
        : error.errorCode === 'invalid_client_metadata' ? 400
        : error.errorCode === 'unauthorized_client' ? 403
        : 400;
      return reply.code(statusCode).send(error.toJSON());
    }

    // Fallback
    fastify.log.error(error);
    return reply.code(500).send({
      error: 'server_error',
      error_description: 'An unexpected error occurred',
    });
  });

  // --- Metadata Endpoints ---

  // RFC 8414: OAuth Authorization Server Metadata
  fastify.get('/.well-known/oauth-authorization-server', async (request) => {
    const baseUrl = getBaseUrl(request);
    return {
      issuer: baseUrl,
      authorization_endpoint: `${baseUrl}/mcp/oauth/authorize`,
      token_endpoint: `${baseUrl}/mcp/oauth/token`,
      registration_endpoint: `${baseUrl}/mcp/oauth/register`,
      revocation_endpoint: `${baseUrl}/mcp/oauth/revoke`,
      scopes_supported: MCP_SCOPES_SUPPORTED,
      response_types_supported: ['code'],
      grant_types_supported: ['authorization_code', 'refresh_token'],
      token_endpoint_auth_methods_supported: ['client_secret_post'],
      code_challenge_methods_supported: ['S256'],
      service_documentation: `${baseUrl}/docs`,
    };
  });

  // RFC 9728: OAuth Protected Resource Metadata
  fastify.get('/.well-known/oauth-protected-resource', async (request) => {
    const baseUrl = getBaseUrl(request);
    return {
      resource: `${baseUrl}/mcp`,
      authorization_servers: [baseUrl],
      scopes_supported: MCP_SCOPES_SUPPORTED,
      resource_name: 'Notez MCP Server',
    };
  });

  // --- Dynamic Client Registration (RFC 7591) ---

  fastify.post('/mcp/oauth/register', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        keyGenerator: (request: FastifyRequest) => `dcr:${request.ip}`,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, unknown>;

    if (!body || !Array.isArray(body.redirect_uris) || !body.redirect_uris.length) {
      throw new OAuthError('invalid_client_metadata', 'redirect_uris is required and must be a non-empty array');
    }

    const result = await registerClient({
      clientName: typeof body.client_name === 'string' ? body.client_name : undefined,
      clientUri: typeof body.client_uri === 'string' ? body.client_uri : undefined,
      redirectUris: body.redirect_uris as string[],
      grantTypes: Array.isArray(body.grant_types) ? body.grant_types as string[] : undefined,
      responseTypes: Array.isArray(body.response_types) ? body.response_types as string[] : undefined,
      scope: typeof body.scope === 'string' ? body.scope : undefined,
      tokenEndpointAuthMethod: typeof body.token_endpoint_auth_method === 'string'
        ? body.token_endpoint_auth_method : undefined,
    });

    reply.code(201);
    return {
      client_id: result.clientId,
      client_secret: result.clientSecret,
      client_id_issued_at: result.clientIdIssuedAt,
      client_secret_expires_at: result.clientSecretExpiresAt,
      client_name: result.clientName,
      redirect_uris: result.redirectUris,
      grant_types: result.grantTypes,
      response_types: result.responseTypes,
      scope: result.scope,
      token_endpoint_auth_method: result.tokenEndpointAuthMethod,
    };
  });

  // --- Authorization Endpoint ---

  fastify.get('/mcp/oauth/authorize', {
    config: {
      rateLimit: {
        max: 30,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => `authz:${request.ip}`,
      },
    },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as Record<string, string>;
    const {
      response_type,
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
    } = query;

    // Validate required params
    if (response_type !== 'code') {
      return sendAuthError(reply, redirect_uri, state, 'unsupported_response_type', 'Only code is supported');
    }

    if (!client_id || !redirect_uri || !code_challenge) {
      return sendAuthError(reply, redirect_uri, state, 'invalid_request', 'Missing required parameters: client_id, redirect_uri, code_challenge');
    }

    if (code_challenge_method && code_challenge_method !== 'S256') {
      return sendAuthError(reply, redirect_uri, state, 'invalid_request', 'Only S256 code_challenge_method is supported');
    }

    // Validate client
    const client = await getClientByClientId(client_id);
    if (!client || client.status !== 'approved') {
      return sendAuthError(reply, redirect_uri, state, 'unauthorized_client', 'Client not registered or not approved');
    }

    // Validate redirect_uri matches registered
    if (!client.redirectUris.includes(redirect_uri)) {
      // Do NOT redirect to unregistered URIs
      return reply.code(400).send({
        error: 'invalid_request',
        error_description: 'redirect_uri does not match registered URIs',
      });
    }

    // Validate scope
    const requestedScope = scope || 'mcp:read';
    const requestedScopes = requestedScope.split(' ');
    if (requestedScopes.some((s) => !MCP_SCOPES_SUPPORTED.includes(s))) {
      return sendAuthError(reply, redirect_uri, state, 'invalid_scope', 'Unsupported scope');
    }

    // Redirect to consent page with all params
    // The consent page handles login (if needed) and user approval
    const consentUrl = new URL('/oauth/consent', getBaseUrl(request));
    consentUrl.searchParams.set('client_id', client_id);
    consentUrl.searchParams.set('redirect_uri', redirect_uri);
    consentUrl.searchParams.set('scope', requestedScope);
    consentUrl.searchParams.set('code_challenge', code_challenge);
    consentUrl.searchParams.set('code_challenge_method', code_challenge_method || 'S256');
    if (state) consentUrl.searchParams.set('state', state);

    return reply.redirect(consentUrl.toString());
  });

  // Internal endpoint: consent page calls this after user approves
  // Requires authenticated session (JWT cookie or Bearer)
  fastify.post('/mcp/oauth/approve', {
    preHandler: authenticateToken,
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = request.body as Record<string, string>;
    const {
      client_id,
      redirect_uri,
      scope,
      state,
      code_challenge,
      code_challenge_method,
    } = body;

    if (!client_id || !redirect_uri || !scope || !code_challenge) {
      throw new OAuthError('invalid_request', 'Missing required parameters');
    }

    const client = await getClientByClientId(client_id);
    if (!client || client.status !== 'approved') {
      throw new OAuthError('unauthorized_client', 'Client not approved');
    }

    if (!client.redirectUris.includes(redirect_uri)) {
      throw new OAuthError('invalid_request', 'Invalid redirect_uri');
    }

    const userId = request.user!.userId;

    // Record consent
    await grantConsent(userId, client.id, scope);

    // Issue authorization code
    const code = await createAuthorizationCode({
      clientId: client.id,
      userId,
      redirectUri: redirect_uri,
      scope,
      codeChallenge: code_challenge,
      codeChallengeMethod: code_challenge_method || 'S256',
    });

    // Redirect back to client with code
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set('code', code);
    if (state) callbackUrl.searchParams.set('state', state);

    return reply.redirect(callbackUrl.toString());
  });

  // --- Token Endpoint ---

  fastify.post('/mcp/oauth/token', {
    config: {
      rateLimit: {
        max: 20,
        timeWindow: '1 minute',
        keyGenerator: (request: FastifyRequest) => `token:${request.ip}`,
      },
    },
  }, async (request: FastifyRequest) => {
    const body = request.body as Record<string, string>;
    const { grant_type, client_id, client_secret } = body;

    if (!client_id || !client_secret) {
      throw new OAuthError('invalid_client', 'client_id and client_secret are required');
    }

    const client = await validateClientCredentials(client_id, client_secret);

    if (grant_type === 'authorization_code') {
      const { code, redirect_uri, code_verifier } = body;

      if (!code || !redirect_uri || !code_verifier) {
        throw new OAuthError('invalid_request', 'code, redirect_uri, and code_verifier are required');
      }

      const tokens = await exchangeAuthorizationCode(
        client.id,
        code,
        code_verifier,
        redirect_uri
      );

      return {
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        expires_in: tokens.expiresIn,
        scope: tokens.scope,
        refresh_token: tokens.refreshToken,
      };
    }

    if (grant_type === 'refresh_token') {
      const { refresh_token, scope } = body;

      if (!refresh_token) {
        throw new OAuthError('invalid_request', 'refresh_token is required');
      }

      const tokens = await exchangeRefreshToken(
        client.id,
        refresh_token,
        scope || undefined
      );

      return {
        access_token: tokens.accessToken,
        token_type: 'Bearer',
        expires_in: tokens.expiresIn,
        scope: tokens.scope,
        refresh_token: tokens.refreshToken,
      };
    }

    throw new OAuthError('unsupported_grant_type', 'Supported: authorization_code, refresh_token');
  });

  // --- Token Revocation (RFC 7009) ---

  fastify.post('/mcp/oauth/revoke', async (request: FastifyRequest) => {
    const body = request.body as Record<string, string>;
    const { token, token_type_hint, client_id, client_secret } = body;

    if (!client_id || !client_secret || !token) {
      throw new OAuthError('invalid_request', 'client_id, client_secret, and token are required');
    }

    const client = await validateClientCredentials(client_id, client_secret);

    await revokeToken(
      client.id,
      token,
      token_type_hint as 'access_token' | 'refresh_token' | undefined
    );

    // RFC 7009: always 200 OK, even if token was already revoked
    return {};
  });

  // --- Admin: Client Management ---

  fastify.get('/mcp/oauth/clients', {
    preHandler: [authenticateToken, requireAdmin],
  }, async (request: FastifyRequest) => {
    const query = request.query as Record<string, string>;
    return listClients(query.status || undefined);
  });

  fastify.post('/mcp/oauth/clients/:clientId/approve', {
    preHandler: [authenticateToken, requireAdmin],
  }, async (request: FastifyRequest) => {
    const { clientId } = request.params as { clientId: string };
    await approveClient(clientId, request.user!.userId);
    return { status: 'approved' };
  });

  fastify.post('/mcp/oauth/clients/:clientId/reject', {
    preHandler: [authenticateToken, requireAdmin],
  }, async (request: FastifyRequest) => {
    const { clientId } = request.params as { clientId: string };
    await rejectClient(clientId);
    return { status: 'rejected' };
  });
}

// --- Helpers ---

function getBaseUrl(request: FastifyRequest): string {
  const proto = request.headers['x-forwarded-proto'] || 'https';
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  return `${proto}://${host}`;
}

function sendAuthError(
  reply: FastifyReply,
  redirectUri: string | undefined,
  state: string | undefined,
  error: string,
  description: string
) {
  if (!redirectUri || !validateRedirectUri(redirectUri)) {
    return reply.code(400).send({ error, error_description: description });
  }

  const url = new URL(redirectUri);
  url.searchParams.set('error', error);
  url.searchParams.set('error_description', description);
  if (state) url.searchParams.set('state', state);
  return reply.redirect(url.toString());
}
