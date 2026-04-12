import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';

export interface McpSession {
  server: McpServer;
  transport: StreamableHTTPServerTransport;
  userId: string;
  clientId: string;
  scopes: string[];
  lastActivity: number;
}

// Caps per the unified plan (Flux INFRA-6)
const MAX_SESSIONS_PER_USER = 5;
const MAX_SESSIONS_GLOBAL = 100;
const SESSION_IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

/**
 * In-memory session store for remote MCP connections.
 * Single-instance assumption (same as webhook worker).
 */
export class McpSessionManager {
  private sessions = new Map<string, McpSession>();
  private userSessionCounts = new Map<string, number>();
  private reaperInterval: ReturnType<typeof setInterval> | null = null;

  start(): void {
    if (this.reaperInterval) return; // Guard against double-start
    // Run idle reaper every 60 seconds
    this.reaperInterval = setInterval(() => this.reapIdleSessions(), 60_000);
  }

  stop(): void {
    if (this.reaperInterval) {
      clearInterval(this.reaperInterval);
      this.reaperInterval = null;
    }
  }

  canCreateSession(userId: string): { allowed: boolean; reason?: string } {
    if (this.sessions.size >= MAX_SESSIONS_GLOBAL) {
      return { allowed: false, reason: 'Server at maximum MCP session capacity' };
    }

    const userCount = this.userSessionCounts.get(userId) || 0;
    if (userCount >= MAX_SESSIONS_PER_USER) {
      return { allowed: false, reason: 'Maximum sessions per user reached' };
    }

    return { allowed: true };
  }

  addSession(sessionId: string, session: McpSession): void {
    this.sessions.set(sessionId, session);
    const count = this.userSessionCounts.get(session.userId) || 0;
    this.userSessionCounts.set(session.userId, count + 1);
  }

  getSession(sessionId: string): McpSession | undefined {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = Date.now();
    }
    return session;
  }

  removeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      const count = this.userSessionCounts.get(session.userId) || 1;
      if (count <= 1) {
        this.userSessionCounts.delete(session.userId);
      } else {
        this.userSessionCounts.set(session.userId, count - 1);
      }
      this.sessions.delete(sessionId);
    }
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  /**
   * Close and remove all sessions for a given user.
   * Called when tokens are revoked to prevent orphaned sessions.
   */
  async closeUserSessions(userId: string): Promise<number> {
    const entries = Array.from(this.sessions.entries());
    let closed = 0;
    for (const [sessionId, session] of entries) {
      if (session.userId === userId) {
        try { await session.transport.close(); } catch { /* best-effort */ }
        this.removeSession(sessionId);
        closed++;
      }
    }
    return closed;
  }

  private reapIdleSessions(): void {
    const now = Date.now();
    // Snapshot entries to avoid modifying Map during iteration
    const entries = Array.from(this.sessions.entries());
    for (const [sessionId, session] of entries) {
      if (now - session.lastActivity > SESSION_IDLE_TIMEOUT_MS) {
        session.transport.close().catch(() => {});
        this.removeSession(sessionId);
      }
    }
  }

  async closeAll(): Promise<void> {
    // Snapshot entries to avoid modifying Map during iteration
    const entries = Array.from(this.sessions.entries());
    for (const [sessionId, session] of entries) {
      try {
        await session.transport.close();
      } catch {
        // best-effort cleanup
      }
      this.removeSession(sessionId);
    }
  }
}
