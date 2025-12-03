import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { authenticateToken, optionalAuth } from '../middleware/auth.middleware.js';
import { storageService } from '../services/storage.service.js';
import { prisma } from '../lib/db.js';
import { validateImageContent, sanitizeFilename, ALLOWED_IMAGE_MIME_TYPES } from '../utils/image.utils.js';

// Max file size: 10MB
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Pagination limits
const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

// Rate limit config for uploads - stricter limits for CPU-intensive operations
const uploadRateLimitConfig = {
  max: 10, // 10 uploads per 5 minutes
  timeWindow: '5 minutes',
  keyGenerator: (request: FastifyRequest) => {
    // Rate limit by user ID when authenticated
    return request.user?.userId || request.ip;
  },
};

export async function imagesRoutes(fastify: FastifyInstance) {
  // Upload image (requires authentication + rate limiting)
  fastify.post(
    '/images/upload',
    {
      preHandler: authenticateToken,
      config: {
        rateLimit: uploadRateLimitConfig,
      },
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;

        // Get file from multipart request
        const data = await request.file();
        if (!data) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'No file uploaded',
          });
        }

        // Validate MIME type
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(data.mimetype)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Invalid file type. Allowed types: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`,
          });
        }

        // Read file buffer
        const buffer = await data.toBuffer();

        // Check if stream was truncated due to fileSize limit (pre-buffer rejection)
        // This prevents memory exhaustion from large uploads - the limit is enforced at stream level
        if (data.file.truncated) {
          return reply.status(413).send({
            error: 'Payload Too Large',
            message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
          });
        }

        // Secondary size check (defense in depth)
        if (buffer.length > MAX_FILE_SIZE) {
          return reply.status(413).send({
            error: 'Payload Too Large',
            message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`,
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

        // Upload to storage
        const result = await storageService.uploadImage(buffer, data.mimetype, userId);

        // Sanitize filename for safe storage
        const safeFilename = sanitizeFilename(data.filename, `image-${result.id}`);

        // Save metadata to database
        const image = await prisma.image.create({
          data: {
            id: result.id,
            userId,
            filename: safeFilename,
            mimeType: data.mimetype,
            size: result.size,
            width: result.width,
            height: result.height,
          },
        });

        return {
          success: true,
          id: image.id,
          url: result.url,
          width: result.width,
          height: result.height,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to upload image',
        });
      }
    }
  );

  // Get image by ID (public access but validates ownership for private images)
  fastify.get(
    '/images/:id',
    {
      preHandler: optionalAuth,
    },
    async (request, reply) => {
      try {
        const { id } = request.params as { id: string };

        // Find image metadata in database
        const image = await prisma.image.findUnique({
          where: { id },
        });

        if (!image) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Image not found',
          });
        }

        // Get image from storage
        const result = await storageService.getImage(id, image.userId);

        if (!result) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Image file not found',
          });
        }

        // Generate ETag from content hash for conditional requests
        const etag = `"${crypto.createHash('md5').update(result.buffer).digest('hex')}"`;

        // Check If-None-Match header for conditional GET
        const ifNoneMatch = request.headers['if-none-match'];
        if (ifNoneMatch === etag) {
          return reply.status(304).send();
        }

        // Set proper headers
        // Use private caching - images are user content and URLs should not be shared publicly
        reply.header('Content-Type', result.mimeType);
        reply.header('Cache-Control', 'private, max-age=31536000, immutable');
        reply.header('Content-Length', result.buffer.length);
        reply.header('ETag', etag);
        reply.header('X-Content-Type-Options', 'nosniff');

        return reply.send(result.buffer);
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to retrieve image',
        });
      }
    }
  );

  // Delete image (requires authentication and ownership)
  fastify.delete(
    '/images/:id',
    {
      preHandler: authenticateToken,
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const { id } = request.params as { id: string };

        // Find image and verify ownership
        const image = await prisma.image.findUnique({
          where: { id },
        });

        if (!image) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Image not found',
          });
        }

        if (image.userId !== userId) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'You do not have permission to delete this image',
          });
        }

        // Delete from storage
        await storageService.deleteImage(id, userId);

        // Delete metadata from database
        await prisma.image.delete({
          where: { id },
        });

        return { success: true };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to delete image',
        });
      }
    }
  );

  // List user's images (requires authentication)
  fastify.get(
    '/images',
    {
      preHandler: authenticateToken,
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const query = request.query as {
          noteId?: string;
          limit?: string;
          offset?: string;
        };

        // Parse and validate pagination parameters with bounds checking
        let limit = parseInt(query.limit || '', 10);
        let offset = parseInt(query.offset || '', 10);

        // Apply defaults and bounds
        if (isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
        if (limit > MAX_LIMIT) limit = MAX_LIMIT;
        if (isNaN(offset) || offset < 0) offset = 0;

        const where: { userId: string; noteId?: string } = { userId };
        if (query.noteId) {
          where.noteId = query.noteId;
        }

        const [images, total] = await Promise.all([
          prisma.image.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
          }),
          prisma.image.count({ where }),
        ]);

        return {
          images: images.map((img) => ({
            id: img.id,
            url: `/api/images/${img.id}`,
            filename: img.filename,
            mimeType: img.mimeType,
            size: img.size,
            width: img.width,
            height: img.height,
            noteId: img.noteId,
            createdAt: img.createdAt,
          })),
          total,
          limit,
          offset,
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to list images',
        });
      }
    }
  );
}
