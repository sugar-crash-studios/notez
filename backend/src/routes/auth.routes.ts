import type { FastifyInstance, FastifyRequest } from 'fastify';
import * as authService from '../services/auth.service.js';
import { authenticateToken } from '../middleware/auth.middleware.js';
import { validateBody } from '../middleware/validate.middleware.js';
import {
  setupSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../utils/validation.schemas.js';
import { prisma } from '../lib/db.js';

// Rate limit configuration for auth endpoints
// These are stricter than the global rate limit to prevent brute force attacks
const authRateLimitConfig = {
  max: 5, // 5 attempts
  timeWindow: '15 minutes', // per 15 minutes
  // Use IP + attempted username/email as key for login-related endpoints
  keyGenerator: (request: FastifyRequest) => {
    const body = request.body as { username?: string; email?: string } | undefined;
    const identifier = body?.username || body?.email || '';
    return `${request.ip}:${identifier}`;
  },
};

// Stricter rate limit for password reset (prevent email enumeration timing attacks)
const passwordResetRateLimitConfig = {
  max: 3, // 3 attempts
  timeWindow: '15 minutes', // per 15 minutes
  keyGenerator: (request: FastifyRequest) => {
    return request.ip;
  },
};

export async function authRoutes(fastify: FastifyInstance) {
  // Check if setup is needed
  fastify.get('/auth/setup-needed', async (_request, reply) => {
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
          sameSite: 'lax',
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
      config: {
        rateLimit: authRateLimitConfig,
      },
      preHandler: validateBody(loginSchema),
    },
    async (request, reply) => {
      try {
        const result = await authService.login(request.body as any);

        // Set refresh token as httpOnly cookie
        reply.setCookie('refreshToken', result.tokens.refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
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
        // Clear invalid cookie
        reply.clearCookie('refreshToken', { path: '/' });
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid refresh token signature',
        });
      }

      const result = await authService.refreshAccessToken(token.value!);

      // Update refresh token cookie with improved security settings
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
          // Clear invalid/expired cookie
          reply.clearCookie('refreshToken', { path: '/' });
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

        // Fetch full user details from database
        const user = await prisma.user.findUnique({
          where: { id: request.user.userId },
          select: {
            id: true,
            username: true,
            email: true,
            role: true,
            mustChangePassword: true,
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
            mustChangePassword: user.mustChangePassword,
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

  // Request password reset
  fastify.post(
    '/auth/forgot-password',
    {
      config: {
        rateLimit: passwordResetRateLimitConfig,
      },
      preHandler: validateBody(forgotPasswordSchema),
    },
    async (request, _reply) => {
      try {
        const { email } = request.body as { email: string };

        // Always return success to prevent email enumeration
        await authService.requestPasswordReset(email);

        return {
          message: 'If an account with that email exists, a password reset link has been sent.',
        };
      } catch (error) {
        fastify.log.error(error);
        // Still return success to prevent email enumeration
        return {
          message: 'If an account with that email exists, a password reset link has been sent.',
        };
      }
    }
  );

  // Reset password with token
  fastify.post(
    '/auth/reset-password',
    {
      config: {
        rateLimit: passwordResetRateLimitConfig,
      },
      preHandler: validateBody(resetPasswordSchema),
    },
    async (request, reply) => {
      try {
        const { token, newPassword } = request.body as { token: string; newPassword: string };

        await authService.resetPassword(token, newPassword);

        return {
          message: 'Password has been reset successfully. You can now log in with your new password.',
        };
      } catch (error) {
        fastify.log.error(error);

        // Return generic error message for all token-related errors
        // to prevent information leakage about token state
        if (error instanceof Error && error.message.includes('reset token')) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Invalid or expired reset token',
          });
        }

        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to reset password',
        });
      }
    }
  );

  // Validate reset token (for frontend to check if token is valid before showing form)
  fastify.get('/auth/validate-reset-token', async (request, reply) => {
    try {
      const { token } = request.query as { token?: string };

      if (!token) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Token is required',
        });
      }

      const isValid = await authService.validateResetToken(token);

      return { valid: isValid };
    } catch (error) {
      fastify.log.error(error);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to validate token',
        valid: false,
      });
    }
  });
}
