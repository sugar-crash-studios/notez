import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import 'dotenv/config';
import { authRoutes } from './routes/auth.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { notesRoutes } from './routes/notes.routes.js';
import { prisma, disconnectPrisma } from './lib/db.js';
const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
  },
});

// Register plugins
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
});

// Register cookie plugin with secret for signing
await fastify.register(cookie, {
  secret: process.env.COOKIE_SECRET || process.env.JWT_REFRESH_SECRET || 'change-me-in-production',
});

await fastify.register(jwt, {
  secret: process.env.JWT_ACCESS_SECRET || 'change-me-in-production',
  cookie: {
    cookieName: 'refreshToken',
    signed: true,
  },
});

// Health check endpoint
fastify.get('/health', async () => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  } catch (error) {
    return { status: 'error', database: 'disconnected' };
  }
});

// Root endpoint
fastify.get('/', async () => {
  return {
    name: 'Notez API',
    version: '1.0.0',
    status: 'running'
  };
});

// Register API routes
await fastify.register(authRoutes, { prefix: '/api' });
await fastify.register(usersRoutes, { prefix: '/api' });
await fastify.register(notesRoutes, { prefix: '/api' });

// Start server
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '3000', 10);
    const host = process.env.HOST || '0.0.0.0';

    await fastify.listen({ port, host });
    console.log(`🚀 Notez API server running on http://${host}:${port}`);
  } catch (err) {
    fastify.log.error(err);
    await disconnectPrisma();
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal: string) => {
  console.log(`\n${signal} received, closing server gracefully...`);
  try {
    await fastify.close();
    await disconnectPrisma();
    console.log('Server closed gracefully.');
    process.exit(0);
  } catch (err) {
    console.error('Error during graceful shutdown:', err);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

start();
