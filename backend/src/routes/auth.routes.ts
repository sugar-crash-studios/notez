import type { FastifyInstance } from 'fastify';
import * as authService from '../services/auth.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  setupSchema,
  loginSchema,
  changePasswordSchema,
} from '../utils/validation.schemas.js';

export async function authRoutes(fastify: FastifyInstance) {
  // Check if setup is needed
  fastify.get('/auth/setup-needed', async (request, reply) => {
    try {
      const isFirst = await authService.isFirstUser();
      return { setupNeeded: isFirst };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to check setup status',
      });
    }
  });

  // Initial setup - create first admin user
  fastify.post(
    '/auth/setup',
    {
      preHandler: validateBody(setupSchema),
    },
    async (request, reply) => {
      try {
        const result = await authService.setupFirstUser(request.body as any);

        // Set refresh token as httpOnly cookie
        reply.setCookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
          path: '/',
          signed: true,
        });

        return {
          message: 'Setup completed successfully',
          user: result.user,
          accessToken: result.tokens.accessToken,
        };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error) {
          if (error.message.includes('already')) {
            return reply.status(409).send({
              error: 'Conflict',
              message: error.message,
            });
          }
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to complete setup',
        });
      }
    }
  );

  // Login
  fastify.post(
    '/auth/login',
    {
      preHandler: validateBody(loginSchema),
    },
    async (request, reply) => {
      try {
        const result = await authService.login(request.body as any);

        // Set refresh token as httpOnly cookie
        reply.setCookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60,
          path: '/',
          signed: true,
        });

        return {
          message: 'Login successful',
          user: result.user,
          accessToken: result.tokens.accessToken,
        };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error) {
          if (
            error.message.includes('Invalid credentials') ||
            error.message.includes('deactivated')
          ) {
            return reply.status(401).send({
              error: 'Unauthorized',
              message: error.message,
            });
          }
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Login failed',
        });
      }
    }
  );

  // Refresh access token
  fastify.post('/auth/refresh', async (request, reply) => {
    try {
      // Get refresh token from cookie
      const refreshToken = request.cookies.refreshToken;

      if (!refreshToken) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Refresh token not found',
        });
      }

      // Unsign the cookie if using signed cookies
      const token = request.unsignCookie(refreshToken);
      if (!token.valid) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid refresh token signature',
        });
      }

      const result = await authService.refreshAccessToken(token.value!);

      // Update refresh token cookie
      reply.setCookie('refreshToken', result.tokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60,
        path: '/',
        signed: true,
      });

      return {
        message: 'Token refreshed successfully',
        user: result.user,
        accessToken: result.tokens.accessToken,
      };
    } catch (error) {
      fastify.log.error(error);

      if (error instanceof Error) {
        if (error.message.includes('Invalid') || error.message.includes('expired')) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: error.message,
          });
        }
      }

      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Token refresh failed',
      });
    }
  });

  // Logout
  fastify.post(
    '/auth/logout',
    {
      preHandler: authenticateToken,
    },
    async (request, reply) => {
      try {
        const refreshToken = request.cookies.refreshToken;

        if (refreshToken) {
          const token = request.unsignCookie(refreshToken);
          if (token.valid && token.value) {
            await authService.logout(token.value);
          }
        }

        // Clear refresh token cookie
        reply.clearCookie('refreshToken', {
          path: '/',
        });

        return { message: 'Logout successful' };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Logout failed',
        });
      }
    }
  );

  // Change password
  fastify.post(
    '/auth/change-password',
    {
      preHandler: [authenticateToken, validateBody(changePasswordSchema)],
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Authentication required',
          });
        }

        await authService.changePassword(request.user.userId, request.body as any);

        return { message: 'Password changed successfully' };
      } catch (error) {
        fastify.log.error(error);

        if (error instanceof Error) {
          if (error.message.includes('incorrect')) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: error.message,
            });
          }
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to change password',
        });
      }
    }
  );

  // Get current user info
  fastify.get(
    '/auth/me',
    {
      preHandler: authenticateToken,
    },
    async (request, reply) => {
      try {
        if (!request.user) {
          return reply.status(401).send({
            error: 'Unauthorized',
            message: 'Authentication required',
          });
        }

        return {
          user: {
            userId: request.user.userId,
            username: request.user.username,
            role: request.user.role,
          },
        };
      } catch (error) {
        fastify.log.error(error);
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get user info',
        });
      }
    }
  );
}
