import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../utils/jwt.utils.js';
import { validateApiToken } from '../services/token.service.js';

/**
 * Middleware to verify JWT access token
 * Adds user payload to request.user
 */
export async function authenticateToken(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Get token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Validate token length to prevent DoS attacks with extremely long tokens
    if (token.length > 1000) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Token too long',
      });
    }

    // Verify token
    const payload = verifyAccessToken(token);

    // Add user to request
    request.user = payload;
  } catch (error) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: error instanceof Error ? error.message : 'Invalid token',
    });
  }
}

/**
 * Middleware to check if user is an admin
 * Must be used after authenticateToken
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
) {
  if (!request.user) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (request.user.role !== 'admin') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin access required',
    });
  }
}

/**
 * Optional authentication - adds user if token is valid, but doesn't fail if missing
 */
export async function optionalAuth(
  request: FastifyRequest,
  _reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);

      // Validate token length
      if (token.length <= 1000) {
        const payload = verifyAccessToken(token);
        request.user = payload;
      }
    }
  } catch (error) {
    // Ignore errors for optional auth
  }
}

/**
 * Middleware to verify API token (ntez_ prefixed Bearer tokens)
 * Sets request.user and request.apiTokenScopes
 */
export async function authenticateApiToken(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    const token = authHeader.substring(7);

    // Validate token length
    if (token.length > 200) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Token too long',
      });
    }

    // Must be an API token (ntez_ prefix)
    if (!token.startsWith('ntez_')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid API token',
      });
    }

    const result = await validateApiToken(token);

    request.user = {
      userId: result.userId,
      username: result.username,
      role: result.role,
    };
    request.apiTokenScopes = result.scopes;
    request.apiTokenId = result.tokenId;
  } catch {
    // Normalize all token validation failures to a single message
    // to prevent leaking token state (revoked, expired, inactive)
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Invalid or expired API token',
    });
  }
}

/**
 * Factory function to require a specific scope on API token requests
 * Must be used after authenticateApiToken
 */
export function requireScope(scope: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.apiTokenScopes) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'API token required',
      });
    }

    if (!request.apiTokenScopes.includes(scope)) {
      return reply.status(403).send({
        error: 'Forbidden',
        message: `Missing required scope: ${scope}`,
      });
    }
  };
}
