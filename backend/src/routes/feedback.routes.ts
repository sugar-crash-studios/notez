import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as feedbackService from '../services/feedback.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody, validateParams, validateQuery } from '../middleware/validate.middleware.js';
import {
  createFeedbackSchema,
  updateFeedbackSchema,
  listFeedbackQuerySchema,
  type CreateFeedbackInput,
  type UpdateFeedbackInput,
} from '../utils/validation.schemas.js';

// Param schemas
const feedbackIdParamSchema = z.object({
  id: z.string().uuid('Invalid feedback ID format'),
});

// Pagination query schema for user's own feedback
const userFeedbackQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function feedbackRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  /**
   * Submit new feedback (bug report or feature request)
   * POST /api/feedback
   */
  fastify.post(
    '/feedback',
    {
      preHandler: validateBody(createFeedbackSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;

        // Check rate limit (10 per hour)
        const withinLimit = await feedbackService.checkRateLimit(userId, 10);
        if (!withinLimit) {
          return reply.status(429).send({
            error: 'Rate Limit Exceeded',
            message: 'You have submitted too many requests. Please try again later.',
          });
        }

        const feedback = await feedbackService.createFeedback(
          userId,
          request.body as CreateFeedbackInput
        );

        return reply.status(201).send({
          message: 'Feedback submitted successfully',
          feedback,
        });
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to submit feedback',
        });
      }
    }
  );

  /**
   * Get current user's feedback submissions
   * GET /api/feedback/mine
   */
  fastify.get(
    '/feedback/mine',
    {
      preHandler: validateQuery(userFeedbackQuerySchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const query = request.query as z.infer<typeof userFeedbackQuerySchema>;

        const result = await feedbackService.listUserFeedback(userId, {
          limit: query.limit,
          offset: query.offset,
        });

        return result;
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list feedback',
        });
      }
    }
  );

  /**
   * Get single feedback by ID (user can only see their own)
   * GET /api/feedback/:id
   */
  fastify.get(
    '/feedback/:id',
    {
      preHandler: validateParams(feedbackIdParamSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof feedbackIdParamSchema>;

        const feedback = await feedbackService.getFeedbackById(
          params.id,
          userId,
          false // not admin view
        );

        return { feedback };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message === 'Feedback not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Feedback not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get feedback',
        });
      }
    }
  );
}

/**
 * Admin feedback routes
 * All routes require admin role
 */
export async function adminFeedbackRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  // Check admin role
  fastify.addHook('preHandler', async (request, reply) => {
    if (request.user?.role !== 'admin') {
      return reply.status(403).send({
        error: 'Forbidden',
        message: 'Admin access required',
      });
    }
  });

  /**
   * List all feedback submissions (admin)
   * GET /api/admin/feedback
   */
  fastify.get(
    '/admin/feedback',
    {
      preHandler: validateQuery(listFeedbackQuerySchema),
    },
    async (request, reply) => {
      try {
        const query = request.query as z.infer<typeof listFeedbackQuerySchema>;
        const result = await feedbackService.listAllFeedback(query);
        return result;
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list feedback',
        });
      }
    }
  );

  /**
   * Get single feedback by ID (admin)
   * GET /api/admin/feedback/:id
   */
  fastify.get(
    '/admin/feedback/:id',
    {
      preHandler: validateParams(feedbackIdParamSchema),
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const params = request.params as z.infer<typeof feedbackIdParamSchema>;

        const feedback = await feedbackService.getFeedbackById(
          params.id,
          userId,
          true // admin view
        );

        return { feedback };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message === 'Feedback not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Feedback not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get feedback',
        });
      }
    }
  );

  /**
   * Update feedback (status, admin notes)
   * PATCH /api/admin/feedback/:id
   */
  fastify.patch(
    '/admin/feedback/:id',
    {
      preHandler: [validateParams(feedbackIdParamSchema), validateBody(updateFeedbackSchema)],
    },
    async (request, reply) => {
      try {
        const params = request.params as z.infer<typeof feedbackIdParamSchema>;
        const body = request.body as UpdateFeedbackInput;

        const feedback = await feedbackService.updateFeedback(params.id, body);

        return {
          message: 'Feedback updated successfully',
          feedback,
        };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message === 'Feedback not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Feedback not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to update feedback',
        });
      }
    }
  );

  /**
   * Delete feedback
   * DELETE /api/admin/feedback/:id
   */
  fastify.delete(
    '/admin/feedback/:id',
    {
      preHandler: validateParams(feedbackIdParamSchema),
    },
    async (request, reply) => {
      try {
        const params = request.params as z.infer<typeof feedbackIdParamSchema>;
        await feedbackService.deleteFeedback(params.id);

        return {
          message: 'Feedback deleted successfully',
        };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message === 'Feedback not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Feedback not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to delete feedback',
        });
      }
    }
  );

  /**
   * Mark feedback as shipped (for User Requested badge)
   * POST /api/admin/feedback/:id/ship
   */
  fastify.post(
    '/admin/feedback/:id/ship',
    {
      preHandler: validateParams(feedbackIdParamSchema),
    },
    async (request, reply) => {
      try {
        const params = request.params as z.infer<typeof feedbackIdParamSchema>;
        const feedback = await feedbackService.markAsShipped(params.id);

        return {
          message: 'Feedback marked as shipped',
          feedback,
        };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message === 'Feedback not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Feedback not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to mark feedback as shipped',
        });
      }
    }
  );

  /**
   * Unmark feedback as shipped
   * DELETE /api/admin/feedback/:id/ship
   */
  fastify.delete(
    '/admin/feedback/:id/ship',
    {
      preHandler: validateParams(feedbackIdParamSchema),
    },
    async (request, reply) => {
      try {
        const params = request.params as z.infer<typeof feedbackIdParamSchema>;
        const feedback = await feedbackService.unmarkAsShipped(params.id);

        return {
          message: 'Feedback unmarked as shipped',
          feedback,
        };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error && error.message === 'Feedback not found') {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Feedback not found',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to unmark feedback as shipped',
        });
      }
    }
  );

  /**
   * Get feedback statistics
   * GET /api/admin/feedback/stats
   */
  fastify.get('/admin/feedback/stats', async (_request, reply) => {
    try {
      const stats = await feedbackService.getFeedbackStats();
      return stats;
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get feedback statistics',
      });
    }
  });
}
