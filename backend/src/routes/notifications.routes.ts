import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as notificationService from '../services/notification.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateParams, validateQuery } from '../middleware/validate.middleware.js';

// Param schemas
const notificationIdParamSchema = z.object({
  id: z.string().uuid('Invalid notification ID format'),
});

// Query schemas
const listNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  unreadOnly: z.coerce.boolean().default(false),
});

export async function notificationsRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  /**
   * Get notifications for the current user
   * GET /api/notifications
   */
  fastify.get(
    '/notifications',
    {
      preHandler: validateQuery(listNotificationsQuerySchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const query = request.query as z.infer<typeof listNotificationsQuerySchema>;

        const result = await notificationService.getNotifications(userId, {
          limit: query.limit,
          offset: query.offset,
          unreadOnly: query.unreadOnly,
        });

        return result;
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get notifications',
        });
      }
    }
  );

  /**
   * Get unread notification count
   * GET /api/notifications/unread-count
   */
  fastify.get('/notifications/unread-count', async (request, reply) => {
    try {
      const userId = request.user!.userId;
      const count = await notificationService.getUnreadCount(userId);

      return { count };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get unread count',
      });
    }
  });

  /**
   * Mark a notification as read
   * PATCH /api/notifications/:id/read
   */
  fastify.patch(
    '/notifications/:id/read',
    {
      preHandler: validateParams(notificationIdParamSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof notificationIdParamSchema>;

        const notification = await notificationService.markAsRead(params.id, userId);

        return {
          message: 'Notification marked as read',
          notification,
        };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message === 'Notification not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Notification not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to mark notification as read',
        });
      }
    }
  );

  /**
   * Mark all notifications as read
   * POST /api/notifications/mark-all-read
   */
  fastify.post('/notifications/mark-all-read', async (request, reply) => {
    try {
      const userId = request.user!.userId;
      const result = await notificationService.markAllAsRead(userId);

      return {
        message: 'All notifications marked as read',
        count: result.count,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to mark notifications as read',
      });
    }
  });

  /**
   * Delete a notification
   * DELETE /api/notifications/:id
   */
  fastify.delete(
    '/notifications/:id',
    {
      preHandler: validateParams(notificationIdParamSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof notificationIdParamSchema>;

        await notificationService.deleteNotification(params.id, userId);

        return {
          message: 'Notification deleted',
        };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message === 'Notification not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Notification not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to delete notification',
        });
      }
    }
  );

  /**
   * Send new release notification to all users (admin only)
   * POST /api/admin/notifications/release
   */
  fastify.post(
    '/admin/notifications/release',
    async (request, reply) => {
      try {
        // Check if user is admin
        if (request.user!.role !== 'admin') {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Admin access required',
          });
        }

        const body = request.body as { version: string; highlights?: string };

        if (!body.version) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Version is required',
          });
        }

        const highlights = body.highlights || 'Check out the latest features and improvements!';

        const result = await notificationService.notifyAllUsers(
          'NEW_RELEASE',
          `🎉 Notez ${body.version} is here!`,
          'release',
          body.version,
          highlights
        );

        return {
          message: 'Release notification sent',
          count: result.count,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to send release notification',
        });
      }
    }
  );
}
