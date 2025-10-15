import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as noteService from '../services/note.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import {
  createNoteSchema,
  updateNoteSchema,
  listNotesQuerySchema,
} from '../utils/validation.schemas.js';

// Param schemas
const noteIdParamSchema = z.object({
  id: z.string().uuid('Invalid note ID format'),
});

export async function notesRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  // List all notes for the authenticated user
  fastify.get(
    '/notes',
    {
      preHandler: validateQuery(listNotesQuerySchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const query = request.query as z.infer<typeof listNotesQuerySchema>;

        // Handle 'null' string for folderId (unfiled notes)
        const folderId = query.folderId === 'null' ? null : query.folderId;

        const result = await noteService.listNotes(userId, {
          folderId,
          search: query.search,
          limit: query.limit,
          offset: query.offset,
        });

        return result;
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list notes',
        });
      }
    }
  );

  // Get note statistics for the authenticated user
  fastify.get('/notes/stats', async (request, reply) => {
    try {
      const userId = request.user!.userId;
      const stats = await noteService.getNoteStats(userId);
      return stats;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get note statistics',
      });
    }
  });

  // Get single note by ID
  fastify.get(
    '/notes/:id',
    {
      preHandler: validateParams(noteIdParamSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof noteIdParamSchema>;
        const note = await noteService.getNoteById(params.id, userId);

        return { note };
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
          message: 'Failed to get note',
        });
      }
    }
  );

  // Create new note
  fastify.post(
    '/notes',
    {
      preHandler: validateBody(createNoteSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const note = await noteService.createNote(userId, request.body as any);

        return reply.status(201).send({
          message: 'Note created successfully',
          note,
        });
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error) {
          if (error.message.includes('not found')) {
            return reply.status(404).send({
              error: 'Not Found',
              message: error.message,
            });
          }
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create note',
        });
      }
    }
  );

  // Update note
  fastify.patch(
    '/notes/:id',
    {
      preHandler: [validateParams(noteIdParamSchema), validateBody(updateNoteSchema)],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof noteIdParamSchema>;
        const note = await noteService.updateNote(params.id, userId, request.body as any);

        return {
          message: 'Note updated successfully',
          note,
        };
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
          message: 'Failed to update note',
        });
      }
    }
  );

  // Delete note
  fastify.delete(
    '/notes/:id',
    {
      preHandler: validateParams(noteIdParamSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof noteIdParamSchema>;
        await noteService.deleteNote(params.id, userId);

        return {
          message: 'Note deleted successfully',
        };
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
          message: 'Failed to delete note',
        });
      }
    }
  );
}
