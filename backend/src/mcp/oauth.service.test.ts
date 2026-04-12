import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing
vi.mock('../lib/db.js', () => ({
  prisma: {
    oAuthClient: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    oAuthAuthorizationCode: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
    },
    oAuthAccessToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    oAuthUserConsent: {
      findUnique: vi.fn(),
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

// Mock bcrypt
vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedvalue'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { prisma } from '../lib/db.js';
import {
  validateRedirectUri,
  registerClient,
  validateClientCredentials,
  exchangeAuthorizationCode,
  exchangeRefreshToken,
  verifyAccessToken,
  revokeToken,
  hasActiveConsent,
  grantConsent,
  OAuthError,
} from './oauth.service.js';

const mockPrisma = vi.mocked(prisma);

describe('oauth.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── validateRedirectUri ────────────────────────────────────────────

  describe('validateRedirectUri', () => {
    it('accepts HTTPS claude.ai URIs', () => {
      expect(validateRedirectUri('https://claude.ai/callback')).toBe(true);
      expect(validateRedirectUri('https://www.claude.ai/oauth/callback')).toBe(true);
    });

    it('accepts HTTPS anthropic.com URIs', () => {
      expect(validateRedirectUri('https://anthropic.com/callback')).toBe(true);
      expect(validateRedirectUri('https://app.anthropic.com/auth')).toBe(true);
    });

    it('rejects HTTP URIs', () => {
      expect(validateRedirectUri('http://claude.ai/callback')).toBe(false);
    });

    it('rejects non-allowlisted domains', () => {
      expect(validateRedirectUri('https://evil.com/callback')).toBe(false);
      expect(validateRedirectUri('https://notclaude.ai/callback')).toBe(false);
    });

    it('rejects URIs with user/password', () => {
      expect(validateRedirectUri('https://user:pass@claude.ai/callback')).toBe(false);
    });

    it('rejects invalid URIs', () => {
      expect(validateRedirectUri('not-a-url')).toBe(false);
      expect(validateRedirectUri('')).toBe(false);
    });
  });

  // ─── registerClient ─────────────────────────────────────────────────

  describe('registerClient', () => {
    it('creates a client with pending_approval status', async () => {
      mockPrisma.oAuthClient.create.mockResolvedValue({
        id: 'uuid-1',
        clientId: 'notez_abc',
        clientSecretHash: 'hashed',
        clientSecretExpiresAt: new Date('2026-07-12'),
        clientName: 'Claude',
        clientUri: null,
        redirectUris: ['https://claude.ai/callback'],
        grantTypes: ['authorization_code', 'refresh_token'],
        responseTypes: ['code'],
        scope: 'mcp:read',
        tokenEndpointAuthMethod: 'client_secret_post',
        status: 'pending_approval',
        approvedByUserId: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const result = await registerClient({
        clientName: 'Claude',
        redirectUris: ['https://claude.ai/callback'],
      });

      expect(result.clientId).toMatch(/^notez_/);
      expect(result.clientSecret).toBeDefined();
      expect(result.redirectUris).toEqual(['https://claude.ai/callback']);

      // Verify client was created with pending status
      expect(mockPrisma.oAuthClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'pending_approval',
          }),
        })
      );
    });

    it('rejects invalid redirect URIs', async () => {
      await expect(
        registerClient({ redirectUris: ['https://evil.com/callback'] })
      ).rejects.toThrow(OAuthError);
    });

    it('rejects empty redirect URIs', async () => {
      await expect(
        registerClient({ redirectUris: [] })
      ).rejects.toThrow(OAuthError);
    });
  });

  // ─── validateClientCredentials ──────────────────────────────────────

  describe('validateClientCredentials', () => {
    it('rejects unknown clients', async () => {
      mockPrisma.oAuthClient.findUnique.mockResolvedValue(null);

      await expect(
        validateClientCredentials('unknown', 'secret')
      ).rejects.toThrow(OAuthError);
    });

    it('rejects unapproved clients', async () => {
      mockPrisma.oAuthClient.findUnique.mockResolvedValue({
        id: 'uuid-1',
        clientId: 'notez_abc',
        clientSecretHash: 'hashed',
        status: 'pending_approval',
        clientSecretExpiresAt: null,
      } as any);

      await expect(
        validateClientCredentials('notez_abc', 'secret')
      ).rejects.toThrow(OAuthError);
    });

    it('rejects expired client secrets', async () => {
      mockPrisma.oAuthClient.findUnique.mockResolvedValue({
        id: 'uuid-1',
        clientId: 'notez_abc',
        clientSecretHash: 'hashed',
        status: 'approved',
        clientSecretExpiresAt: new Date('2020-01-01'), // expired
      } as any);

      await expect(
        validateClientCredentials('notez_abc', 'secret')
      ).rejects.toThrow(OAuthError);
    });
  });

  // ─── exchangeAuthorizationCode ──────────────────────────────────────

  describe('exchangeAuthorizationCode', () => {
    it('rejects already-used codes and revokes all tokens (replay protection)', async () => {
      mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
        id: 'code-1',
        codeHash: 'hash',
        clientId: 'client-1',
        userId: 'user-1',
        redirectUri: 'https://claude.ai/cb',
        scope: 'mcp:read',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        expiresAt: new Date(Date.now() + 600000),
        usedAt: new Date(), // already used!
        createdAt: new Date(),
      } as any);

      await expect(
        exchangeAuthorizationCode('client-1', 'somecode', 'verifier', 'https://claude.ai/cb')
      ).rejects.toThrow('already used');

      // Should revoke all tokens for this client+user
      expect(mockPrisma.oAuthAccessToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: 'client-1',
            userId: 'user-1',
          }),
        })
      );
    });

    it('rejects expired codes', async () => {
      mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
        id: 'code-1',
        codeHash: 'hash',
        clientId: 'client-1',
        userId: 'user-1',
        redirectUri: 'https://claude.ai/cb',
        scope: 'mcp:read',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        expiresAt: new Date('2020-01-01'), // expired
        usedAt: null,
        createdAt: new Date(),
      } as any);

      await expect(
        exchangeAuthorizationCode('client-1', 'somecode', 'verifier', 'https://claude.ai/cb')
      ).rejects.toThrow('expired');
    });

    it('rejects wrong client', async () => {
      mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
        id: 'code-1',
        codeHash: 'hash',
        clientId: 'client-1', // different from requesting client
        userId: 'user-1',
        redirectUri: 'https://claude.ai/cb',
        scope: 'mcp:read',
        codeChallenge: 'challenge',
        codeChallengeMethod: 'S256',
        expiresAt: new Date(Date.now() + 600000),
        usedAt: null,
        createdAt: new Date(),
      } as any);

      await expect(
        exchangeAuthorizationCode('client-2', 'somecode', 'verifier', 'https://claude.ai/cb')
      ).rejects.toThrow('not issued to this client');
    });
  });

  // ─── exchangeRefreshToken ───────────────────────────────────────────

  describe('exchangeRefreshToken', () => {
    it('revokes entire token family on refresh replay (Aegis requirement)', async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash',
        clientId: 'client-1',
        userId: 'user-1',
        scope: 'mcp:read',
        expiresAt: new Date(Date.now() + 3600000),
        refreshTokenHash: 'refresh-hash',
        refreshExpiresAt: new Date(Date.now() + 86400000),
        refreshRotatedAt: new Date(), // already rotated!
        revokedAt: null,
        createdAt: new Date(),
      } as any);

      await expect(
        exchangeRefreshToken('client-1', 'refresh-token')
      ).rejects.toThrow('replay detected');

      // Should revoke ALL tokens for this client+user
      expect(mockPrisma.oAuthAccessToken.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            clientId: 'client-1',
            userId: 'user-1',
            revokedAt: null,
          }),
        })
      );
    });

    it('rejects scope escalation via refresh', async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash',
        clientId: 'client-1',
        userId: 'user-1',
        scope: 'mcp:read', // original scope
        expiresAt: new Date(Date.now() + 3600000),
        refreshTokenHash: 'refresh-hash',
        refreshExpiresAt: new Date(Date.now() + 86400000),
        refreshRotatedAt: null,
        revokedAt: null,
        createdAt: new Date(),
      } as any);

      await expect(
        exchangeRefreshToken('client-1', 'refresh-token', 'mcp:read mcp:write')
      ).rejects.toThrow('Cannot escalate scope');
    });
  });

  // ─── verifyAccessToken ──────────────────────────────────────────────

  describe('verifyAccessToken', () => {
    it('rejects revoked tokens', async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash',
        clientId: 'client-1',
        userId: 'user-1',
        scope: 'mcp:read',
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: new Date(), // revoked!
        createdAt: new Date(),
        user: { id: 'user-1', isActive: true },
      } as any);

      await expect(verifyAccessToken('token')).rejects.toThrow('revoked');
    });

    it('rejects expired tokens', async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash',
        clientId: 'client-1',
        userId: 'user-1',
        scope: 'mcp:read',
        expiresAt: new Date('2020-01-01'), // expired
        revokedAt: null,
        createdAt: new Date(),
        user: { id: 'user-1', isActive: true },
      } as any);

      await expect(verifyAccessToken('token')).rejects.toThrow('expired');
    });

    it('rejects tokens for inactive users (Crucible: deleted user)', async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash',
        clientId: 'client-1',
        userId: 'user-1',
        scope: 'mcp:read',
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
        createdAt: new Date(),
        user: { id: 'user-1', isActive: false }, // inactive!
      } as any);

      await expect(verifyAccessToken('token')).rejects.toThrow('inactive');
    });

    it('returns AuthInfo for valid tokens', async () => {
      const expiresAt = new Date(Date.now() + 3600000);
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: 'token-1',
        tokenHash: 'hash',
        clientId: 'client-1',
        userId: 'user-1',
        scope: 'mcp:read',
        expiresAt,
        revokedAt: null,
        createdAt: new Date(),
        user: { id: 'user-1', isActive: true },
      } as any);

      const authInfo = await verifyAccessToken('token');
      expect(authInfo.clientId).toBe('client-1');
      expect(authInfo.scopes).toEqual(['mcp:read']);
      expect(authInfo.extra?.userId).toBe('user-1');
    });
  });

  // ─── User consent ───────────────────────────────────────────────────

  describe('hasActiveConsent', () => {
    it('returns false for missing consent', async () => {
      mockPrisma.oAuthUserConsent.findUnique.mockResolvedValue(null);
      expect(await hasActiveConsent('user-1', 'client-1', 'mcp:read')).toBe(false);
    });

    it('returns false for expired consent', async () => {
      mockPrisma.oAuthUserConsent.findUnique.mockResolvedValue({
        id: 'consent-1',
        userId: 'user-1',
        clientId: 'client-1',
        scope: 'mcp:read',
        grantedAt: new Date(),
        expiresAt: new Date('2020-01-01'), // expired
      } as any);
      expect(await hasActiveConsent('user-1', 'client-1', 'mcp:read')).toBe(false);
    });

    it('returns false if requested scope exceeds consented scope', async () => {
      mockPrisma.oAuthUserConsent.findUnique.mockResolvedValue({
        id: 'consent-1',
        userId: 'user-1',
        clientId: 'client-1',
        scope: 'mcp:read',
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      } as any);
      expect(await hasActiveConsent('user-1', 'client-1', 'mcp:read mcp:write')).toBe(false);
    });

    it('returns true for valid matching consent', async () => {
      mockPrisma.oAuthUserConsent.findUnique.mockResolvedValue({
        id: 'consent-1',
        userId: 'user-1',
        clientId: 'client-1',
        scope: 'mcp:read',
        grantedAt: new Date(),
        expiresAt: new Date(Date.now() + 86400000),
      } as any);
      expect(await hasActiveConsent('user-1', 'client-1', 'mcp:read')).toBe(true);
    });
  });
});
