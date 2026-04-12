import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { IncomingMessage } from 'node:http';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { AuthInfo } from '@modelcontextprotocol/sdk/server/auth/types.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { McpSessionManager } from './session-manager.js';
import { verifyAccessToken, OAuthError } from './oauth.service.js';
import { registerNotezTools } from './tools.js';

// Configurable origin allowlist (Slag CHAIN-3 mitigation)
const ALLOWED_ORIGINS = (process.env.MCP_ALLOWED_ORIGINS || 'https://claude.ai,https://www.claude.ai')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

const sessionManager = new McpSessionManager();

/**
 * MCP Streamable HTTP transport routes.
 * Handles POST (JSON-RPC), GET (SSE stream), DELETE (session close) at /mcp.
 */
export async function mcpTransportRoutes(fastify: FastifyInstance) {
  sessionManager.start();

  // Cleanup on server shutdown
  fastify.addHook('onClose', async () => {
    sessionManager.stop();
    await sessionManager.closeAll();
  });

  // Origin validation hook for all /mcp routes
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const origin = request.headers.origin;
    if (origin && !ALLOWED_ORIGINS.some((allowed) => origin === allowed || origin.endsWith(`.${new URL(allowed).hostname}`))) {
      return reply.code(403).send({ error: 'Forbidden', message: 'Origin not allowed' });
    }
  });

  // CORS for /mcp
  fastify.addHook('onSend', async (request, reply) => {
    const origin = request.headers.origin;
    if (origin && ALLOWED_ORIGINS.some((allowed) => origin === allowed)) {
      reply.header('Access-Control-Allow-Origin', origin);
      reply.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Mcp-Session-Id, Last-Event-ID');
      reply.header('Access-Control-Expose-Headers', 'Mcp-Session-Id');
      reply.header('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
    }
  });

  // OPTIONS preflight
  fastify.options('/mcp', async (_request, reply) => {
    return reply.code(204).send();
  });

  // Bearer auth middleware for MCP routes
  async function authenticateMcpToken(request: FastifyRequest, reply: FastifyReply): Promise<AuthInfo | null> {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Bearer token required' });
      return null;
    }

    const token = authHeader.substring(7);
    if (token.length > 500) {
      reply.code(401).send({ error: 'Unauthorized', message: 'Token too long' });
      return null;
    }

    try {
      return await verifyAccessToken(token);
    } catch (error) {
      if (error instanceof OAuthError) {
        reply.code(401).send({ error: 'Unauthorized', message: error.message });
      } else {
        reply.code(401).send({ error: 'Unauthorized', message: 'Invalid token' });
      }
      return null;
    }
  }

  // Rate limit for MCP transport
  const mcpRateLimit = {
    rateLimit: {
      max: 60,
      timeWindow: '1 minute',
      keyGenerator: (request: FastifyRequest) => {
        const auth = request.headers.authorization || '';
        return `mcp-transport:${auth.substring(0, 20)}:${request.ip}`;
      },
    },
  };

  // POST /mcp - JSON-RPC messages (initialize, tool calls, etc.)
  fastify.post('/mcp', { config: mcpRateLimit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authInfo = await authenticateMcpToken(request, reply);
    if (!authInfo) return; // reply already sent

    try {
      const sessionId = request.headers['mcp-session-id'] as string | undefined;
      let session = sessionId ? sessionManager.getSession(sessionId) : undefined;

      if (session) {
        // Verify session belongs to this token's user (Slag CHAIN-3)
        if (session.userId !== (authInfo.extra?.userId as string)) {
          return reply.code(403).send({
            jsonrpc: '2.0',
            error: { code: -32000, message: 'Session does not belong to this token' },
            id: null,
          });
        }

        // Attach auth info and delegate to transport
        (request.raw as IncomingMessage & { auth?: AuthInfo }).auth = authInfo;
        await session.transport.handleRequest(request.raw, reply.raw, request.body);
        return;
      }

      if (!sessionId && isInitializeRequest(request.body as Record<string, unknown>)) {
        // New session
        const userId = authInfo.extra?.userId as string;
        const check = sessionManager.canCreateSession(userId);
        if (!check.allowed) {
          return reply.code(429).send({
            jsonrpc: '2.0',
            error: { code: -32000, message: check.reason },
            id: null,
          });
        }

        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (newSessionId: string) => {
            sessionManager.addSession(newSessionId, {
              server,
              transport,
              userId,
              clientId: authInfo.clientId,
              scopes: authInfo.scopes,
              lastActivity: Date.now(),
            });
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) sessionManager.removeSession(sid);
        };

        // Create a per-session MCP server with tools scoped to this user
        const server = new McpServer({
          name: 'notez',
          version: '1.23.0',
        });

        // Register tools based on granted scopes (v1.18: read-only)
        const allowedScopes = authInfo.scopes.filter(
          (s): s is 'mcp:read' | 'mcp:write' => s === 'mcp:read' || s === 'mcp:write'
        );
        registerNotezTools(server, () => userId, allowedScopes);

        await server.connect(transport);

        (request.raw as IncomingMessage & { auth?: AuthInfo }).auth = authInfo;
        await transport.handleRequest(request.raw, reply.raw, request.body);
        return;
      }

      // No valid session and not an init request
      return reply.code(400).send({
        jsonrpc: '2.0',
        error: { code: -32000, message: 'Bad Request: No valid session ID provided' },
        id: null,
      });
    } catch (error) {
      fastify.log.error(error, 'Error handling MCP POST');
      if (!reply.sent) {
        return reply.code(500).send({
          jsonrpc: '2.0',
          error: { code: -32603, message: 'Internal server error' },
          id: null,
        });
      }
    }
  });

  // GET /mcp - SSE stream for server-to-client notifications
  fastify.get('/mcp', { config: mcpRateLimit }, async (request: FastifyRequest, reply: FastifyReply) => {
    const authInfo = await authenticateMcpToken(request, reply);
    if (!authInfo) return;

    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    if (!sessionId) {
      return reply.code(400).send({ error: 'Missing Mcp-Session-Id header' });
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    if (session.userId !== (authInfo.extra?.userId as string)) {
      return reply.code(403).send({ error: 'Session does not belong to this token' });
    }

    (request.raw as IncomingMessage & { auth?: AuthInfo }).auth = authInfo;
    await session.transport.handleRequest(request.raw, reply.raw);
  });

  // DELETE /mcp - Session termination
  fastify.delete('/mcp', async (request: FastifyRequest, reply: FastifyReply) => {
    const authInfo = await authenticateMcpToken(request, reply);
    if (!authInfo) return;

    const sessionId = request.headers['mcp-session-id'] as string | undefined;
    if (!sessionId) {
      return reply.code(400).send({ error: 'Missing Mcp-Session-Id header' });
    }

    const session = sessionManager.getSession(sessionId);
    if (!session) {
      return reply.code(404).send({ error: 'Session not found' });
    }

    if (session.userId !== (authInfo.extra?.userId as string)) {
      return reply.code(403).send({ error: 'Session does not belong to this token' });
    }

    (request.raw as IncomingMessage & { auth?: AuthInfo }).auth = authInfo;
    await session.transport.handleRequest(request.raw, reply.raw);
  });

  // Health check for MCP subsystem
  fastify.get('/mcp/health', async () => {
    return {
      status: 'ok',
      activeSessions: sessionManager.getSessionCount(),
    };
  });
}

export { sessionManager };
