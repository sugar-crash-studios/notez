import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { authenticateToken } from '../middleware/auth.middleware.js';
import * as tagService from '../services/tag.service.js';
import { z } from 'zod';

// Validation schemas
const renameTagSchema = z.object({
  name: z.string().min(1).max(100),
});

const searchQuerySchema = z.object({
  q: z.string().min(1).optional(),
  limit: z.coerce.number().min(1).max(100).optional().default(10),
});

export async function tagRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  // List all tags
  fastify.get('/', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const tags = await tagService.listTags(request.user!.userId);
      reply.send({ tags });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ message: 'Failed to list tags' });
    }
  });

  // Search/autocomplete tags
  fastify.get(
    '/search',
    async (
      request: FastifyRequest<{ Querystring: z.infer<typeof searchQuerySchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const { q, limit } = searchQuerySchema.parse(request.query);
        const tags = q
          ? await tagService.searchTags(request.user!.userId, q, limit)
          : await tagService.listTags(request.user!.userId);
        reply.send({ tags });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ message: 'Invalid query parameters', errors: error.errors });
        }
        fastify.log.error(error);
        reply.status(500).send({ message: 'Failed to search tags' });
      }
    }
  );

  // Get tag statistics
  fastify.get('/stats', async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const stats = await tagService.getTagStats(request.user!.userId);
      reply.send(stats);
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ message: 'Failed to get tag statistics' });
    }
  });

  // Get single tag
  fastify.get('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      const tag = await tagService.getTagById(request.params.id, request.user!.userId);
      reply.send({ tag });
    } catch (error: any) {
      if (error.message === 'Tag not found') {
        return reply.status(404).send({ message: 'Tag not found' });
      }
      fastify.log.error(error);
      reply.status(500).send({ message: 'Failed to get tag' });
    }
  });

  // Rename tag
  fastify.patch(
    '/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: z.infer<typeof renameTagSchema> }>,
      reply: FastifyReply
    ) => {
      try {
        const { name } = renameTagSchema.parse(request.body);
        const tag = await tagService.renameTag(request.params.id, request.user!.userId, name);
        reply.send({ tag });
      } catch (error: any) {
        if (error instanceof z.ZodError) {
          return reply.status(400).send({ message: 'Invalid request', errors: error.errors });
        }
        if (error.message === 'Tag not found') {
          return reply.status(404).send({ message: 'Tag not found' });
        }
        if (error.message === 'A tag with this name already exists') {
          return reply.status(409).send({ message: error.message });
        }
        fastify.log.error(error);
        reply.status(500).send({ message: 'Failed to rename tag' });
      }
    }
  );

  // Delete tag
  fastify.delete('/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    try {
      await tagService.deleteTag(request.params.id, request.user!.userId);
      reply.send({ message: 'Tag deleted successfully' });
    } catch (error: any) {
      if (error.message === 'Tag not found') {
        return reply.status(404).send({ message: 'Tag not found' });
      }
      fastify.log.error(error);
      reply.status(500).send({ message: 'Failed to delete tag' });
    }
  });
}
