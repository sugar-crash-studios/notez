import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateParams, validateQuery } from '../middleware/validate.middleware.js';
import * as notelinkService from '../services/notelink.service.js';

// Query schemas
const referencesQuerySchema = z.object({
  keyword: z.string().min(1, 'Keyword is required').max(255),
  limit: z.coerce.number().min(1).max(100).optional().default(50),
  offset: z.coerce.number().min(0).optional().default(0),
});

const noteIdParamSchema = z.object({
  id: z.string().uuid('Invalid note ID format'),
});

export async function referencesRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  /**
   * GET /api/notes/references
   *
   * Find all notes that contain a wiki-link to the given keyword
   * Example: GET /api/notes/references?keyword=Ryan
   */
  fastify.get(
    '/notes/references',
    {
      preHandler: validateQuery(referencesQuerySchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const query = request.query as z.infer<typeof referencesQuerySchema>;

        const result = await notelinkService.findNotesByKeyword(userId, query.keyword, {
          limit: query.limit,
          offset: query.offset,
        });

        return result;
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to find references',
        });
      }
    }
  );

  /**
   * GET /api/notes/:id/backlinks
   *
   * Get all notes that link TO this note (by title match)
   * Shows incoming references to the current note
   */
  fastify.get(
    '/notes/:id/backlinks',
    {
      preHandler: validateParams(noteIdParamSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof noteIdParamSchema>;

        const result = await notelinkService.getBacklinksForNote(userId, params.id);

        return result;
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message.includes('not found')) {
          return reply.status(404).send({
            error: 'Not Found',
            message: error.message,
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get backlinks',
        });
      }
    }
  );

  /**
   * GET /api/notes/keywords
   *
   * Get all unique keywords used in wiki-links by the user
   * Useful for autocomplete
   */
  fastify.get('/notes/keywords', async (request, reply) => {
    try {
      const userId = request.user!.userId;

      const keywords = await notelinkService.getAllKeywords(userId);

      return { keywords };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get keywords',
      });
    }
  });
}
