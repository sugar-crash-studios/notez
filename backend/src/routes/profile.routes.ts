import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { storageService } from '../services/storage.service.js';
import { prisma } from '../lib/db.js';
import { validateImageContent, ALLOWED_IMAGE_MIME_TYPES } from '../utils/image.utils.js';

const MAX_AVATAR_SIZE = 5 * 1024 * 1024; // 5MB

// Rate limit config for avatar uploads
const avatarUploadRateLimitConfig = {
  max: 5, // 5 avatar uploads per 5 minutes
  timeWindow: '5 minutes',
  keyGenerator: (request: FastifyRequest) => {
    return request.user?.userId || request.ip;
  },
};

// 1x1 transparent PNG for missing avatars (avoids 404 console errors)
const TRANSPARENT_PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);

/**
 * Public profile routes (no authentication required)
 */
export async function profilePublicRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/profile/avatar/:userId
   * Get user avatar image (public endpoint - no auth required)
   * Returns a transparent 1x1 pixel if no avatar exists (to avoid 404 console errors)
   */
  fastify.get('/profile/avatar/:userId', async (request, reply) => {
    try {
      const { userId } = request.params as { userId: string };

      const avatar = await storageService.getAvatar(userId);

      if (!avatar) {
        // Return a transparent 1x1 pixel instead of 404
        // The X-Avatar-Status header lets the client know this is a placeholder
        reply.header('Content-Type', 'image/png');
        reply.header('Cache-Control', 'public, max-age=60'); // Short cache for placeholder
        reply.header('X-Avatar-Status', 'not-found');
        return reply.send(TRANSPARENT_PIXEL);
      }

      // Generate ETag from content hash for conditional requests
      const etag = `"${crypto.createHash('md5').update(avatar.buffer).digest('hex')}"`;

      // Check If-None-Match header for conditional GET
      const ifNoneMatch = request.headers['if-none-match'];
      if (ifNoneMatch === etag) {
        return reply.status(304).send();
      }

      reply.header('Content-Type', avatar.mimeType);
      reply.header('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
      reply.header('ETag', etag);
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
   * Upload user avatar (with rate limiting)
   */
  fastify.post(
    '/profile/avatar',
    {
      config: {
        rateLimit: avatarUploadRateLimitConfig,
      },
    },
    async (request, reply) => {
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

        // Check if stream was truncated due to fileSize limit (pre-buffer rejection)
        if (data.file.truncated) {
          return reply.status(413).send({
            error: 'Payload Too Large',
            message: 'File too large. Maximum size is 5MB',
          });
        }

        // Secondary size check (defense in depth)
        if (buffer.length > MAX_AVATAR_SIZE) {
          return reply.status(413).send({
            error: 'Payload Too Large',
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
    }
  );

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
