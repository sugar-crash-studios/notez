import type { FastifyRequest, FastifyReply } from 'fastify';
import { verifyAccessToken } from '../utils/jwt.utils.js';

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
