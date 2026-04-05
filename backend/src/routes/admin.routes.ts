import type { FastifyInstance } from 'fastify';
import { authenticateToken, requireAdmin } from '../middleware/auth.middleware.js';
import { validateParams, validateQuery, validateBody } from '../middleware/validate.middleware.js';
import { uuidParamSchema, createApiTokenSchema } from '../utils/validation.schemas.js';
import {
  listServiceAccounts,
  listServiceAccountNotes,
  getServiceAccountNote,
  listServiceAccountTasks,
  getServiceAccountStats,
  getServiceAccountFolders,
  getServiceAccountNotes,
  getServiceAccountTags,
} from '../services/user.service.js';
import { listApiTokens, createApiToken, revokeApiToken } from '../services/token.service.js';
import { AppError } from '../utils/errors.js';
import { prisma } from '../lib/db.js';
import { z } from 'zod';

const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

const notesPaginationQuerySchema = paginationQuerySchema.extend({
  userId: z.string().uuid().optional(),
});

export async function adminRoutes(fastify: FastifyInstance) {
  // All routes require admin auth
  fastify.addHook('preHandler', authenticateToken);
  fastify.addHook('preHandler', requireAdmin);

  // List service accounts
  fastify.get('/admin/service-accounts', async (_request, reply) => {
    try {
      const accounts = await listServiceAccounts();
      return { serviceAccounts: accounts };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to list service accounts',
      });
    }
  });

  // Get per-account stats for dashboard
  fastify.get('/admin/service-accounts/stats', async (_request, reply) => {
    try {
      const stats = await getServiceAccountStats();
      return { stats };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get service account stats',
      });
    }
  });

  // List all notes from service accounts (paginated, optionally filtered by userId)
  fastify.get(
    '/admin/service-accounts/notes',
    {
      preHandler: validateQuery(notesPaginationQuerySchema),
    },
    async (request, reply) => {
      try {
        const { limit, offset, userId } = request.query as { limit: number; offset: number; userId?: string };
        const result = await listServiceAccountNotes({ limit, offset, userId });
        return result;
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list service account notes',
        });
      }
    }
  );

  // Get single note from service account (read-only)
  fastify.get(
    '/admin/service-accounts/notes/:id',
    {
      preHandler: validateParams(uuidParamSchema),
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const note = await getServiceAccountNote(id);
        return note;
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === 'Note not found') {
            return reply.status(404).send({
              error: 'Not Found',
              message: 'Note not found',
            });
          }
          if (error.message === 'Note does not belong to a service account') {
            return reply.status(403).send({
              error: 'Forbidden',
              message: 'This note does not belong to a service account',
            });
          }
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get service account note',
        });
      }
    }
  );

  // List all tasks from service accounts (paginated)
  fastify.get(
    '/admin/service-accounts/tasks',
    {
      preHandler: validateQuery(paginationQuerySchema),
    },
    async (request, reply) => {
      try {
        const { limit, offset } = request.query as { limit: number; offset: number };
        const result = await listServiceAccountTasks({ limit, offset });
        return result;
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list service account tasks',
        });
      }
    }
  );

  // ─── Per-Account Workspace Endpoints ────────────────────────────────

  const accountNotesQuerySchema = paginationQuerySchema.extend({
    folderId: z.string().optional(),
  });

  // Get folders for a specific service account
  fastify.get(
    '/admin/service-accounts/:id/folders',
    {
      preHandler: validateParams(uuidParamSchema),
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await verifyServiceAccount(id);
        const result = await getServiceAccountFolders(id);
        return result;
      } catch (error) {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send({
            error: error.name,
            message: error.message,
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get service account folders',
        });
      }
    }
  );

  // Get notes for a specific service account (with folder filter + pagination)
  fastify.get(
    '/admin/service-accounts/:id/notes',
    {
      preHandler: [
        validateParams(uuidParamSchema),
        validateQuery(accountNotesQuerySchema),
      ],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        const { limit, offset, folderId } = request.query as {
          limit: number;
          offset: number;
          folderId?: string;
        };
        await verifyServiceAccount(id);
        const result = await getServiceAccountNotes(id, { folderId, limit, offset });
        return result;
      } catch (error) {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send({
            error: error.name,
            message: error.message,
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get service account notes',
        });
      }
    }
  );

  // Get tags for a specific service account
  fastify.get(
    '/admin/service-accounts/:id/tags',
    {
      preHandler: validateParams(uuidParamSchema),
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await verifyServiceAccount(id);
        const result = await getServiceAccountTags(id);
        return { tags: result };
      } catch (error) {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send({
            error: error.name,
            message: error.message,
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get service account tags',
        });
      }
    }
  );

  // ─── Service Account Token Management ──────────────────────────────

  const serviceAccountTokenParamSchema = z.object({
    id: z.string().uuid('Invalid service account ID'),
    tokenId: z.string().uuid('Invalid token ID'),
  });

  /** Verify the target user is a service account */
  async function verifyServiceAccount(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, isServiceAccount: true },
    });
    if (!user) {
      throw new AppError('Service account not found', 404);
    }
    if (!user.isServiceAccount) {
      throw new AppError('User is not a service account', 400);
    }
    return user;
  }

  // List tokens for a service account
  fastify.get(
    '/admin/service-accounts/:id/tokens',
    {
      preHandler: validateParams(uuidParamSchema),
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await verifyServiceAccount(id);
        const tokens = await listApiTokens(id);
        return { tokens };
      } catch (error) {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send({
            error: error.name,
            message: error.message,
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list tokens',
        });
      }
    }
  );

  // Create a new token for a service account
  fastify.post(
    '/admin/service-accounts/:id/tokens',
    {
      preHandler: [
        validateParams(uuidParamSchema),
        validateBody(createApiTokenSchema),
      ],
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };
        await verifyServiceAccount(id);
        const body = request.body as z.infer<typeof createApiTokenSchema>;
        const token = await createApiToken(id, {
          name: body.name,
          scopes: body.scopes,
          expiresIn: body.expiresIn ?? null,
        });
        return reply
          .header('Cache-Control', 'no-store')
          .status(201)
          .send({
            message: 'Token created successfully. Store it securely — it cannot be retrieved again.',
            token: {
              id: token.id,
              name: token.name,
              prefix: token.prefix,
              scopes: token.scopes,
              expiresAt: token.expiresAt,
              createdAt: token.createdAt,
            },
            rawToken: token.rawToken,
          });
      } catch (error) {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send({
            error: error.name,
            message: error.message,
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create token',
        });
      }
    }
  );

  // Revoke a token for a service account
  fastify.delete(
    '/admin/service-accounts/:id/tokens/:tokenId',
    {
      preHandler: validateParams(serviceAccountTokenParamSchema),
    },
    async (request, reply) => {
      try {
        const { id, tokenId } = request.params as { id: string; tokenId: string };
        await verifyServiceAccount(id);
        const result = await revokeApiToken(tokenId, id);
        return {
          message: 'Token revoked successfully',
          token: result,
        };
      } catch (error) {
        if (error instanceof AppError) {
          return reply.status(error.statusCode).send({
            error: error.name,
            message: error.message,
          });
        }
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to revoke token',
        });
      }
    }
  );
}
