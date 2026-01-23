import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as taskService from '../services/task.service.js';
import * as taskExtractionService from '../services/task-extraction.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import {
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
  listTasksQuerySchema,
  scanTasksSchema,
  importTasksSchema,
  addTaskLinkSchema,
  updateTaskLinkSchema,
  type CreateTaskInput,
  type UpdateTaskInput,
  type UpdateTaskStatusInput,
  type ScanTasksInput,
  type ImportTasksInput,
} from '../utils/validation.schemas.js';

// Param schemas
const taskIdParamSchema = z.object({
  id: z.string().uuid('Invalid task ID format'),
});

const linkIdParamSchema = z.object({
  id: z.string().uuid('Invalid task ID format'),
  linkId: z.string().uuid('Invalid link ID format'),
});

export async function tasksRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  // List all tasks for the authenticated user
  fastify.get(
    '/tasks',
    {
      preHandler: validateQuery(listTasksQuerySchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const query = request.query as z.infer<typeof listTasksQuerySchema>;

        const result = await taskService.listTasks(userId, {
          status: query.status,
          priority: query.priority,
          folderId: query.folderId,
          noteId: query.noteId,
          tagId: query.tagId,
          overdue: query.overdue,
          sortBy: query.sortBy,
          sortOrder: query.sortOrder,
          limit: query.limit,
          offset: query.offset,
        });

        return result;
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list tasks',
        });
      }
    }
  );

  // Get task statistics for the authenticated user
  fastify.get('/tasks/stats', async (request, reply) => {
    try {
      const userId = request.user!.userId;
      const stats = await taskService.getTaskStats(userId);
      return stats;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get task statistics',
      });
    }
  });

  // Scan notes for tasks (preview)
  fastify.post(
    '/tasks/scan',
    {
      preHandler: validateBody(scanTasksSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const body = request.body as ScanTasksInput;

        const extractedTasks = await taskExtractionService.scanNotesForTasks(userId, {
          folderId: body.folderId,
          noteIds: body.noteIds,
        });

        return {
          tasks: extractedTasks,
          count: extractedTasks.length,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to scan notes for tasks',
        });
      }
    }
  );

  // Import tasks from notes
  fastify.post(
    '/tasks/import',
    {
      preHandler: validateBody(importTasksSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const body = request.body as ImportTasksInput;

        // Import tasks directly (no need to re-scan)
        const importedTasks = await taskExtractionService.importTasksFromNotes(
          userId,
          body.tasks
        );

        return {
          imported: importedTasks,
          count: importedTasks.length,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to import tasks from notes',
        });
      }
    }
  );

  // Get single task by ID
  fastify.get(
    '/tasks/:id',
    {
      preHandler: validateParams(taskIdParamSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof taskIdParamSchema>;

        const task = await taskService.getTaskById(params.id, userId);
        return task;
      } catch (error: any) {
        fastify.log.error(error);

        if (error.message === 'Task not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Task not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get task',
        });
      }
    }
  );

  // Create a new task
  fastify.post(
    '/tasks',
    {
      preHandler: validateBody(createTaskSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const body = request.body as CreateTaskInput;

        const task = await taskService.createTask(userId, body);
        return reply.status(201).send(task);
      } catch (error: any) {
        fastify.log.error(error);

        if (error.message === 'Folder not found' || error.message === 'Note not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: error.message,
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create task',
        });
      }
    }
  );

  // Update a task
  fastify.put(
    '/tasks/:id',
    {
      preHandler: [validateParams(taskIdParamSchema), validateBody(updateTaskSchema)],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof taskIdParamSchema>;
        const body = request.body as UpdateTaskInput;

        const task = await taskService.updateTask(params.id, userId, body);
        return task;
      } catch (error: any) {
        fastify.log.error(error);

        if (error.message === 'Task not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Task not found',
          });
        }

        if (error.message === 'Folder not found' || error.message === 'Note not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: error.message,
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to update task',
        });
      }
    }
  );

  // Quick update task status
  fastify.patch(
    '/tasks/:id/status',
    {
      preHandler: [validateParams(taskIdParamSchema), validateBody(updateTaskStatusSchema)],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof taskIdParamSchema>;
        const body = request.body as UpdateTaskStatusInput;

        const task = await taskService.updateTaskStatus(params.id, userId, body.status);
        return task;
      } catch (error: any) {
        fastify.log.error(error);

        if (error.message === 'Task not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Task not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to update task status',
        });
      }
    }
  );

  // Delete a task
  fastify.delete(
    '/tasks/:id',
    {
      preHandler: validateParams(taskIdParamSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof taskIdParamSchema>;

        await taskService.deleteTask(params.id, userId);
        return reply.status(204).send();
      } catch (error: any) {
        fastify.log.error(error);

        if (error.message === 'Task not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Task not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to delete task',
        });
      }
    }
  );

  // ============ Task Link Routes ============

  // Add a link to a task
  fastify.post(
    '/tasks/:id/links',
    {
      preHandler: [validateParams(taskIdParamSchema), validateBody(addTaskLinkSchema)],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof taskIdParamSchema>;
        const body = request.body as z.infer<typeof addTaskLinkSchema>;

        const link = await taskService.addTaskLink(params.id, userId, body);
        return reply.status(201).send(link);
      } catch (error: any) {
        fastify.log.error(error);

        if (error.message === 'Task not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Task not found',
          });
        }

        if (error.message === 'Maximum 10 links per task') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: error.message,
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to add link',
        });
      }
    }
  );

  // Update a task link
  fastify.patch(
    '/tasks/:id/links/:linkId',
    {
      preHandler: [validateParams(linkIdParamSchema), validateBody(updateTaskLinkSchema)],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof linkIdParamSchema>;
        const body = request.body as z.infer<typeof updateTaskLinkSchema>;

        const link = await taskService.updateTaskLink(params.id, params.linkId, userId, body);
        return link;
      } catch (error: any) {
        fastify.log.error(error);

        if (error.message === 'Link not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Link not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to update link',
        });
      }
    }
  );

  // Delete a task link
  fastify.delete(
    '/tasks/:id/links/:linkId',
    {
      preHandler: validateParams(linkIdParamSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof linkIdParamSchema>;

        await taskService.deleteTaskLink(params.id, params.linkId, userId);
        return reply.status(204).send();
      } catch (error: any) {
        fastify.log.error(error);

        if (error.message === 'Link not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Link not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to delete link',
        });
      }
    }
  );
}
