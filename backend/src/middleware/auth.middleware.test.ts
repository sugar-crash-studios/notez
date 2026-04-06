import { describe, it, expect, vi, beforeEach } from 'vitest';
import { authenticateToken, requireAdmin, optionalAuth, authenticateApiToken } from './auth.middleware.js';
import { generateTokenPair } from '../utils/jwt.utils.js';

// Mock token service for authenticateApiToken tests
vi.mock('../services/token.service.js', () => ({
  validateApiToken: vi.fn(),
}));

import { validateApiToken } from '../services/token.service.js';
const mockValidateApiToken = vi.mocked(validateApiToken);

// Helper to create mock Fastify request/reply
function createMockRequest(overrides: Partial<any> = {}): any {
  return {
    headers: {},
    user: undefined,
    ...overrides,
  };
}

function createMockReply(): any {
  const reply: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      reply.statusCode = code;
      return reply;
    },
    send(body: any) {
      reply.body = body;
      return reply;
    },
  };
  return reply;
}

describe('auth.middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── authenticateToken ────────────────────────────────────────────────
  describe('authenticateToken', () => {
    it('should return 401 if no authorization header', async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      await authenticateToken(request, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply.body.error).toBe('Unauthorized');
      expect(reply.body.message).toContain('Missing or invalid authorization header');
    });

    it('should return 401 if authorization header does not start with Bearer', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Basic abc123' },
      });
      const reply = createMockReply();

      await authenticateToken(request, reply);

      expect(reply.statusCode).toBe(401);
    });

    it('should return 401 for token exceeding 1000 chars (DoS protection)', async () => {
      const longToken = 'A'.repeat(1001);
      const request = createMockRequest({
        headers: { authorization: `Bearer ${longToken}` },
      });
      const reply = createMockReply();

      await authenticateToken(request, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply.body.message).toBe('Token too long');
    });

    it('should return 401 for invalid JWT', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer invalid.jwt.token' },
      });
      const reply = createMockReply();

      await authenticateToken(request, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply.body.message).toContain('Invalid or expired access token');
    });

    it('should set request.user for valid token', async () => {
      const tokens = generateTokenPair({
        userId: 'user-123',
        username: 'alice',
        role: 'user',
      });

      const request = createMockRequest({
        headers: { authorization: `Bearer ${tokens.accessToken}` },
      });
      const reply = createMockReply();

      await authenticateToken(request, reply);

      expect(request.user).toBeDefined();
      expect(request.user.userId).toBe('user-123');
      expect(request.user.username).toBe('alice');
      expect(request.user.role).toBe('user');
      // Reply should not have been called (no error)
      expect(reply.statusCode).toBe(200);
    });

    it('should handle empty Bearer token', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer ' },
      });
      const reply = createMockReply();

      await authenticateToken(request, reply);

      expect(reply.statusCode).toBe(401);
    });
  });

  // ─── requireAdmin ─────────────────────────────────────────────────────
  describe('requireAdmin', () => {
    it('should return 401 if no user on request', async () => {
      const request = createMockRequest({ user: undefined });
      const reply = createMockReply();

      await requireAdmin(request, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply.body.message).toBe('Authentication required');
    });

    it('should return 403 if user is not admin', async () => {
      const request = createMockRequest({
        user: { userId: 'user-1', username: 'alice', role: 'user' },
      });
      const reply = createMockReply();

      await requireAdmin(request, reply);

      expect(reply.statusCode).toBe(403);
      expect(reply.body.message).toBe('Admin access required');
    });

    it('should pass through for admin user', async () => {
      const request = createMockRequest({
        user: { userId: 'admin-1', username: 'admin', role: 'admin' },
      });
      const reply = createMockReply();

      const result = await requireAdmin(request, reply);

      // Should return undefined (no error response sent)
      expect(result).toBeUndefined();
      expect(reply.statusCode).toBe(200);
    });
  });

  // ─── optionalAuth ─────────────────────────────────────────────────────
  describe('optionalAuth', () => {
    it('should not set user when no auth header', async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      await optionalAuth(request, reply);

      expect(request.user).toBeUndefined();
    });

    it('should set user when valid token is present', async () => {
      const tokens = generateTokenPair({
        userId: 'user-1',
        username: 'bob',
        role: 'user',
      });

      const request = createMockRequest({
        headers: { authorization: `Bearer ${tokens.accessToken}` },
      });
      const reply = createMockReply();

      await optionalAuth(request, reply);

      expect(request.user).toBeDefined();
      expect(request.user.userId).toBe('user-1');
    });

    it('should silently ignore invalid token', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer garbage' },
      });
      const reply = createMockReply();

      await optionalAuth(request, reply);

      expect(request.user).toBeUndefined();
      // No error response sent
      expect(reply.statusCode).toBe(200);
    });

    it('should ignore oversized token without error', async () => {
      const request = createMockRequest({
        headers: { authorization: `Bearer ${'x'.repeat(1001)}` },
      });
      const reply = createMockReply();

      await optionalAuth(request, reply);

      expect(request.user).toBeUndefined();
    });

    it('should ignore non-Bearer auth headers', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Basic abc' },
      });
      const reply = createMockReply();

      await optionalAuth(request, reply);

      expect(request.user).toBeUndefined();
    });
  });

  // ─── authenticateApiToken ────────────────────────────────────────────
  describe('authenticateApiToken', () => {
    it('should return 401 if no authorization header', async () => {
      const request = createMockRequest();
      const reply = createMockReply();

      await authenticateApiToken(request, reply);

      expect(reply.statusCode).toBe(401);
    });

    it('should return 401 for non-ntez_ tokens', async () => {
      const request = createMockRequest({
        headers: { authorization: 'Bearer not_a_ntez_token' },
      });
      const reply = createMockReply();

      await authenticateApiToken(request, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply.body.message).toBe('Invalid API token');
    });

    it('should set request.user, apiTokenScopes, and apiTokenId for valid token', async () => {
      mockValidateApiToken.mockResolvedValue({
        tokenId: 'token-abc',
        userId: 'user-1',
        username: 'testuser',
        role: 'user',
        scopes: ['read', 'write'],
      });

      const request = createMockRequest({
        headers: { authorization: 'Bearer ntez_validtoken123456789012345678901234567890abc' },
      });
      const reply = createMockReply();

      await authenticateApiToken(request, reply);

      expect(request.user).toEqual({
        userId: 'user-1',
        username: 'testuser',
        role: 'user',
      });
      expect(request.apiTokenScopes).toEqual(['read', 'write']);
      expect(request.apiTokenId).toBe('token-abc');
    });

    it('should return 401 when token validation fails', async () => {
      mockValidateApiToken.mockRejectedValue(new Error('Token has been revoked'));

      const request = createMockRequest({
        headers: { authorization: 'Bearer ntez_revokedtoken12345678901234567890123456789ab' },
      });
      const reply = createMockReply();

      await authenticateApiToken(request, reply);

      expect(reply.statusCode).toBe(401);
      expect(reply.body.message).toBe('Invalid or expired API token');
    });
  });
});
