import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import jwt from '@fastify/jwt';
import fastifyStatic from '@fastify/static';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import 'dotenv/config';
import { getDatabaseUrl, getDatabaseUrlSafe } from './lib/database-url.js';
import { authRoutes } from './routes/auth.routes.js';
import { usersRoutes } from './routes/users.routes.js';
import { notesRoutes } from './routes/notes.routes.js';
import { foldersRoutes } from './routes/folders.routes.js';
import { tagRoutes } from './routes/tags.routes.js';
import { tasksRoutes } from './routes/tasks.routes.js';
import { aiRoutes } from './routes/ai.routes.js';
import { searchRoutes } from './routes/search.routes.js';
import { prisma, disconnectPrisma } from './lib/db.js';

// Configure DATABASE_URL from components if not explicitly set
// This allows using POSTGRES_USER, POSTGRES_PASSWORD, etc. instead of hardcoded URL
if (!process.env.DATABASE_URL) {
  try {
    process.env.DATABASE_URL = getDatabaseUrl();
    console.log(`📊 Database URL configured from components: ${getDatabaseUrlSafe()}`);
  } catch (error) {
    console.error('❌ Failed to configure database URL:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}
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

// Register API routes
await fastify.register(authRoutes, { prefix: '/api' });
await fastify.register(usersRoutes, { prefix: '/api' });
await fastify.register(notesRoutes, { prefix: '/api' });
await fastify.register(foldersRoutes, { prefix: '/api' });
await fastify.register(tagRoutes, { prefix: '/api/tags' });
await fastify.register(tasksRoutes, { prefix: '/api' });
await fastify.register(aiRoutes, { prefix: '/api/ai' });
await fastify.register(searchRoutes, { prefix: '/api/search' });

// Serve frontend static files (in production)
// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// In production, serve the built frontend from /app/frontend/dist
// In development, this path won't exist and that's okay - frontend runs separately
const frontendDistPath = join(__dirname, '../../frontend/dist');

await fastify.register(fastifyStatic, {
  root: frontendDistPath,
  prefix: '/', // Serve from root
});

// Fallback route for SPA - send index.html for all non-API routes
fastify.setNotFoundHandler(async (request, reply) => {
  // Don't handle API routes or health check
  if (request.url.startsWith('/api') || request.url.startsWith('/health')) {
    reply.code(404).send({ error: 'Not found' });
    return;
  }

  // For all other routes, serve index.html (SPA fallback)
  return reply.sendFile('index.html');
});

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
