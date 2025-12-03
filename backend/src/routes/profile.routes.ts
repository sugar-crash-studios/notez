import type { FastifyInstance } from 'fastify';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { storageService } from '../services/storage.service.js';
import { prisma } from '../lib/db.js';
import { validateImageContent, ALLOWED_IMAGE_MIME_TYPES } from '../utils/image.utils.js';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

/**
 * Public profile routes (no authentication required)
 */
export async function profilePublicRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/profile/avatar/:userId
   * Get user avatar image (public endpoint - no auth required)
   */
  fastify.get('/profile/avatar/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };

      const avatar = await storageService.getAvatar(userId);

      if (!avatar) {
        // Return 404 - client should use default avatar
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Avatar not found',
        });
      }

      reply.header('Content-Type', avatar.mimeType);
      reply.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      reply.header('X-Content-Type-Options', 'nosniff');

      return reply.send(avatar.buffer);
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get avatar',
      });
    }
  });
}

/**
 * Protected profile routes (authentication required)
 */
export async function profileRoutes(fastify: FastifyInstance) {
  // All routes in this plugin require authentication
  fastify.addHook('preHandler', authenticateToken);

  /**
   * GET /api/profile/me
   * Get current user's full profile (same as /auth/me but with avatar)
   */
  fastify.get('/profile/me', async (request, reply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const user = await prisma.user.findUnique({
        where: { id: request.user.userId },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          avatarUrl: true,
          mustChangePassword: true,
          createdAt: true,
        },
      });

      if (!user) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found',
        });
      }

      return {
        user: {
          userId: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          mustChangePassword: user.mustChangePassword,
          createdAt: user.createdAt,
        },
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to get profile',
      });
    }
  });

  /**
   * POST /api/profile/avatar
   * Upload user avatar
   */
  fastify.post('/profile/avatar', async (request, reply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No file uploaded',
        });
      }

      // Validate mime type
      if (!ALLOWED_IMAGE_MIME_TYPES.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
        });
      }

      // Read file buffer
      const buffer = await data.toBuffer();

      // Validate file size
      if (buffer.length > MAX_AVATAR_SIZE) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'File too large. Maximum size is 5MB',
        });
      }

      // Validate actual image content (prevents content-type spoofing)
      const contentValidation = await validateImageContent(buffer);
      if (!contentValidation.valid) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid image file. File content does not match a supported image format.',
        });
      }

      // Upload avatar
      const result = await storageService.uploadAvatar(buffer, request.user.userId);

      // Update user record with avatar URL
      await prisma.user.update({
        where: { id: request.user.userId },
        data: { avatarUrl: result.url },
      });

      return {
        message: 'Avatar uploaded successfully',
        avatarUrl: result.url,
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to upload avatar',
      });
    }
  });

  /**
   * DELETE /api/profile/avatar
   * Delete user avatar
   */
  fastify.delete('/profile/avatar', async (request, reply) => {
    try {
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Authentication required',
        });
      }

      // Delete from storage
      await storageService.deleteAvatar(request.user.userId);

      // Update user record to remove avatar URL
      await prisma.user.update({
        where: { id: request.user.userId },
        data: { avatarUrl: null },
      });

      return {
        message: 'Avatar deleted successfully',
      };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete avatar',
      });
    }
  });
}
