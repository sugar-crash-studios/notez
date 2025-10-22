import { FastifyInstance } from 'fastify';
import { aiService } from '../services/ai/index.js';
import {
  AIProviderNotConfiguredError,
  AIProviderConnectionError,
  AIProviderRateLimitError,
  AIServiceError,
} from '../services/ai/types.js';
import {
  aiConfigSchema,
  aiSummarizeSchema,
  aiSuggestTitleSchema,
  aiSuggestTagsSchema,
  AISummarizeInput,
  AISuggestTitleInput,
  AISuggestTagsInput,
  AIConfigInput,
} from '../utils/validation.schemas.js';
import { validateBody } from '../middleware/validate.middleware.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { prisma } from '../lib/prisma.js';

/**
 * AI Routes
 *
 * Endpoints for AI provider configuration and AI-powered features
 */
export async function aiRoutes(fastify: FastifyInstance) {
  // All routes require authentication
  fastify.addHook('preHandler', authenticateToken);

  // ==================== User Settings Endpoints ====================

  /**
   * GET /api/ai/settings
   * Get current user's AI provider configuration
   */
  fastify.get('/settings', async (request, reply) => {
    try {
      const userId = request.user!.userId;
      const config = await aiService.getUserConfiguration(userId);

      if (!config) {
        return reply.send({
          configured: false,
          provider: null,
          model: null,
        });
      }

      // Don't send API key back to client
      return reply.send({
        configured: true,
        provider: config.provider,
        model: config.model || null,
      });
    } catch (error: any) {
      fastify.log.error(error);
      reply.status(500).send({ message: 'Failed to get AI settings' });
    }
  });

  /**
   * PUT /api/ai/settings
   * Update current user's AI provider configuration
   */
  fastify.put<{ Body: AIConfigInput }>(
    '/settings',
    {
      preHandler: [validateBody(aiConfigSchema)],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const config = request.body;

        // Test connection before saving
        const connectionOk = await aiService.testConnection(config);

        if (!connectionOk) {
          return reply.status(400).send({ message: 'Failed to connect to AI provider with provided credentials' });
        }

        // Save configuration for this user
        await aiService.saveUserConfiguration(userId, config);

        reply.send({ message: 'AI settings saved successfully', configured: true });
      } catch (error: any) {
        if (error instanceof AIProviderConnectionError) {
          return reply.status(400).send({ message: 'Invalid API key or connection failed' });
        }

        if (error instanceof AIProviderRateLimitError) {
          return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' });
        }

        if (error instanceof AIServiceError) {
          return reply.status(400).send({ message: error.message });
        }

        fastify.log.error(error);
        reply.status(500).send({ message: 'Failed to save AI settings' });
      }
    }
  );

  /**
   * POST /api/ai/test-connection
   * Test connection to AI provider with given credentials
   */
  fastify.post<{ Body: AIConfigInput }>(
    '/test-connection',
    {
      preHandler: [validateBody(aiConfigSchema)],
    },
    async (request, reply) => {
      try {
        const config = request.body;
        const connectionOk = await aiService.testConnection(config);

        if (connectionOk) {
          reply.send({ success: true, message: 'Connection successful' });
        } else {
          reply.status(400).send({ success: false, message: 'Connection failed' });
        }
      } catch (error: any) {
        if (error instanceof AIProviderConnectionError) {
          return reply.status(400).send({ success: false, message: 'Invalid API key or connection failed' });
        }

        if (error instanceof AIProviderRateLimitError) {
          return reply.status(429).send({ success: false, message: 'Rate limit exceeded' });
        }

        if (error instanceof AIServiceError) {
          return reply.status(400).send({ success: false, message: error.message });
        }

        fastify.log.error(error);
        reply.status(500).send({ success: false, message: 'Failed to test connection' });
      }
    }
  );

  /**
   * POST /api/ai/list-models
   * List available models for a provider using provided API key
   */
  fastify.post<{ Body: AIConfigInput }>(
    '/list-models',
    {
      preHandler: [validateBody(aiConfigSchema)],
    },
    async (request, reply) => {
      try {
        const config = request.body;
        const models = await aiService.listModels(config);

        reply.send({ success: true, models });
      } catch (error: any) {
        if (error instanceof AIProviderConnectionError) {
          return reply.status(400).send({ success: false, message: 'Invalid API key or connection failed', models: [] });
        }

        if (error instanceof AIProviderRateLimitError) {
          return reply.status(429).send({ success: false, message: 'Rate limit exceeded', models: [] });
        }

        if (error instanceof AIServiceError) {
          return reply.status(400).send({ success: false, message: error.message, models: [] });
        }

        fastify.log.error(error);
        reply.status(500).send({ success: false, message: 'Failed to list models', models: [] });
      }
    }
  );

  // ==================== AI Feature Endpoints ====================

  /**
   * POST /api/ai/summarize
   * Generate a summary of note content
   */
  fastify.post<{ Body: AISummarizeInput }>(
    '/summarize',
    {
      preHandler: [validateBody(aiSummarizeSchema)],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const { content, maxLength } = request.body;

        const summary = await aiService.summarize(userId, {
          content,
          maxLength,
        });

        reply.send({ summary });
      } catch (error: any) {
        if (error instanceof AIProviderNotConfiguredError) {
          return reply.status(400).send({ message: error.message });
        }

        if (error instanceof AIProviderConnectionError) {
          return reply.status(503).send({ message: 'Failed to connect to AI provider' });
        }

        if (error instanceof AIProviderRateLimitError) {
          return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' });
        }

        if (error instanceof AIServiceError) {
          return reply.status(500).send({ message: `AI error: ${error.message}` });
        }

        fastify.log.error(error);
        reply.status(500).send({ message: 'Failed to generate summary' });
      }
    }
  );

  /**
   * POST /api/ai/suggest-title
   * Suggest a title based on note content
   */
  fastify.post<{ Body: AISuggestTitleInput }>(
    '/suggest-title',
    {
      preHandler: [validateBody(aiSuggestTitleSchema)],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const { content, maxLength } = request.body;

        const title = await aiService.suggestTitle(userId, {
          content,
          maxLength,
        });

        reply.send({ title });
      } catch (error: any) {
        if (error instanceof AIProviderNotConfiguredError) {
          return reply.status(400).send({ message: error.message });
        }

        if (error instanceof AIProviderConnectionError) {
          return reply.status(503).send({ message: 'Failed to connect to AI provider' });
        }

        if (error instanceof AIProviderRateLimitError) {
          return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' });
        }

        if (error instanceof AIServiceError) {
          return reply.status(500).send({ message: `AI error: ${error.message}` });
        }

        fastify.log.error(error);
        reply.status(500).send({ message: 'Failed to suggest title' });
      }
    }
  );

  /**
   * POST /api/ai/suggest-tags
   * Suggest tags based on note content
   */
  fastify.post<{ Body: AISuggestTagsInput }>(
    '/suggest-tags',
    {
      preHandler: [validateBody(aiSuggestTagsSchema)],
    },
    async (request, reply) => {
      try {
        const userId = request.user!.userId;
        const { content, maxTags } = request.body;

        // Fetch user's existing tags to provide context to AI
        const existingTags = await prisma.tag.findMany({
          where: { userId },
          select: { name: true },
        });

        const existingTagNames = existingTags.map((tag) => tag.name);

        const tags = await aiService.suggestTags(userId, {
          content,
          maxTags,
          existingTags: existingTagNames,
        });

        reply.send({ tags });
      } catch (error: any) {
        if (error instanceof AIProviderNotConfiguredError) {
          return reply.status(400).send({ message: error.message });
        }

        if (error instanceof AIProviderConnectionError) {
          return reply.status(503).send({ message: 'Failed to connect to AI provider' });
        }

        if (error instanceof AIProviderRateLimitError) {
          return reply.status(429).send({ message: 'Rate limit exceeded. Please try again later.' });
        }

        if (error instanceof AIServiceError) {
          return reply.status(500).send({ message: `AI error: ${error.message}` });
        }

        fastify.log.error(error);
        reply.status(500).send({ message: 'Failed to suggest tags' });
      }
    }
  );
}
