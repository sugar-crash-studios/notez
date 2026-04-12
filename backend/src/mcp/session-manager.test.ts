import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { McpSessionManager } from './session-manager.js';

describe('McpSessionManager', () => {
  let manager: McpSessionManager;

  beforeEach(() => {
    manager = new McpSessionManager();
  });

  afterEach(() => {
    manager.stop();
  });

  function mockSession(userId: string, clientId = 'client-1') {
    return {
      server: {} as any,
      transport: { close: vi.fn().mockResolvedValue(undefined) } as any,
      userId,
      clientId,
      scopes: ['mcp:read'],
      lastActivity: Date.now(),
    };
  }

  it('adds and retrieves sessions', () => {
    const session = mockSession('user-1');
    manager.addSession('sess-1', session);

    expect(manager.getSession('sess-1')).toBe(session);
    expect(manager.getSessionCount()).toBe(1);
  });

  it('returns undefined for unknown sessions', () => {
    expect(manager.getSession('nonexistent')).toBeUndefined();
  });

  it('removes sessions and updates counts', () => {
    const session = mockSession('user-1');
    manager.addSession('sess-1', session);
    manager.removeSession('sess-1');

    expect(manager.getSession('sess-1')).toBeUndefined();
    expect(manager.getSessionCount()).toBe(0);
  });

  it('enforces per-user session cap (5)', () => {
    for (let i = 0; i < 5; i++) {
      manager.addSession(`sess-${i}`, mockSession('user-1'));
    }

    const check = manager.canCreateSession('user-1');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('per user');
  });

  it('allows different users up to the cap independently', () => {
    for (let i = 0; i < 5; i++) {
      manager.addSession(`sess-a-${i}`, mockSession('user-a'));
    }
    // user-b should still be allowed
    expect(manager.canCreateSession('user-b').allowed).toBe(true);
  });

  it('enforces global session cap (100)', () => {
    for (let i = 0; i < 100; i++) {
      manager.addSession(`sess-${i}`, mockSession(`user-${i}`));
    }

    const check = manager.canCreateSession('user-new');
    expect(check.allowed).toBe(false);
    expect(check.reason).toContain('capacity');
  });

  it('updates lastActivity on getSession', () => {
    const session = mockSession('user-1');
    session.lastActivity = 1000;
    manager.addSession('sess-1', session);

    const before = Date.now();
    manager.getSession('sess-1');
    expect(session.lastActivity).toBeGreaterThanOrEqual(before);
  });

  it('closeAll closes all transports and clears state', async () => {
    const s1 = mockSession('user-1');
    const s2 = mockSession('user-2');
    manager.addSession('sess-1', s1);
    manager.addSession('sess-2', s2);

    await manager.closeAll();

    expect(s1.transport.close).toHaveBeenCalled();
    expect(s2.transport.close).toHaveBeenCalled();
    expect(manager.getSessionCount()).toBe(0);
  });

  it('closeUserSessions closes only the target user sessions', async () => {
    const s1 = mockSession('user-1');
    const s2 = mockSession('user-1');
    const s3 = mockSession('user-2');
    manager.addSession('sess-1', s1);
    manager.addSession('sess-2', s2);
    manager.addSession('sess-3', s3);

    const closed = await manager.closeUserSessions('user-1');

    expect(closed).toBe(2);
    expect(s1.transport.close).toHaveBeenCalled();
    expect(s2.transport.close).toHaveBeenCalled();
    expect(s3.transport.close).not.toHaveBeenCalled();
    expect(manager.getSessionCount()).toBe(1);
    expect(manager.getSession('sess-3')).toBe(s3);
  });

  it('closeUserSessions returns 0 for unknown user', async () => {
    manager.addSession('sess-1', mockSession('user-1'));
    const closed = await manager.closeUserSessions('user-999');
    expect(closed).toBe(0);
    expect(manager.getSessionCount()).toBe(1);
  });
});
