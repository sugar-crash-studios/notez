import type { FastifyInstance, FastifyRequest } from 'fastify';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams } from '../middleware/validate.middleware.js';
import { createApiTokenSchema, createAgentTokenSchema, updateAgentTokenSchema, uuidParamSchema } from '../utils/validation.schemas.js';
import { createApiToken, listApiTokens, revokeApiToken, createAgentToken, listAgentTokens, updateAgentToken } from '../services/token.service.js';

/**
 * Token management routes
 * Protected by JWT auth — users manage their API tokens through normal session
 *
 * Error handling: token.service.ts throws typed AppError subclasses
 * (NotFoundError, BadRequestError, AppError) which the global error handler
 * maps to proper HTTP responses via statusCode.
 */
export async function tokenRoutes(fastify: FastifyInstance) {
  // All routes require JWT authentication
  fastify.addHook('preHandler', authenticateToken);

  // Create a new API token
  fastify.post(
    '/tokens',
    { preHandler: validateBody(createApiTokenSchema) },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.userId;
      const body = request.body as {
        name: string;
        scopes: string[];
        expiresIn?: string | null;
      };

      const token = await createApiToken(userId, body);

      return reply.code(201).send({
        ...token,
        message: 'Store this token securely — it cannot be retrieved again.',
      });
    }
  );

  // List all API tokens for the current user
  fastify.get('/tokens', async (request: FastifyRequest) => {
    const userId = request.user!.userId;
    return listApiTokens(userId);
  });

  // Revoke an API token
  fastify.delete(
    '/tokens/:id',
    { preHandler: validateParams(uuidParamSchema) },
    async (request: FastifyRequest) => {
      const userId = request.user!.userId;
      const { id } = request.params as { id: string };
      return revokeApiToken(id, userId);
    }
  );

  // ─── Agent Tokens ─────────────────────────────────────────────────────

  // Create a new agent token
  fastify.post(
    '/tokens/agents',
    { preHandler: validateBody(createAgentTokenSchema) },
    async (request: FastifyRequest, reply) => {
      const userId = request.user!.userId;
      const body = request.body as {
        name: string;
        scopes: string[];
        expiresIn?: string | null;
        agentName: string;
        agentIcon: string;
        agentColor: string;
      };

      const token = await createAgentToken(userId, body);

      return reply.code(201).send({
        ...token,
        message: 'Store this token securely — it cannot be retrieved again.',
      });
    }
  );

  // List agent tokens for the current user
  fastify.get('/tokens/agents', async (request: FastifyRequest) => {
    const userId = request.user!.userId;
    return listAgentTokens(userId);
  });

  // Update an agent token's display config
  fastify.patch(
    '/tokens/agents/:id',
    { preHandler: [validateParams(uuidParamSchema), validateBody(updateAgentTokenSchema)] },
    async (request: FastifyRequest) => {
      const userId = request.user!.userId;
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        agentName?: string;
        agentIcon?: string;
        agentColor?: string;
      };

      return updateAgentToken(id, userId, body);
    }
  );
}
