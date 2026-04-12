import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../lib/db.js', () => ({
  prisma: {
    oAuthClient: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
      deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    oAuthAuthorizationCode: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    oAuthAccessToken: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), create: vi.fn(), findUnique: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    oAuthUserConsent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }), findUnique: vi.fn(), upsert: vi.fn() },
  },
}));

vi.mock('bcrypt', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2b$10$hashedvalue'),
    compare: vi.fn().mockResolvedValue(true),
  },
}));

import { prisma } from '../lib/db.js';
import { cleanupExpiredOAuthData } from './oauth.service.js';

const mockPrisma = vi.mocked(prisma);

describe('cleanupExpiredOAuthData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls deleteMany on all four tables (codes, tokens, consents, stale clients)', async () => {
    await cleanupExpiredOAuthData();

    expect(mockPrisma.oAuthAuthorizationCode.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.oAuthAccessToken.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.oAuthUserConsent.deleteMany).toHaveBeenCalledTimes(1);
    expect(mockPrisma.oAuthClient.deleteMany).toHaveBeenCalledTimes(1);
  });

  it('uses correct date filters for auth code cleanup', async () => {
    const before = Date.now();
    await cleanupExpiredOAuthData();
    const after = Date.now();

    const call = mockPrisma.oAuthAuthorizationCode.deleteMany.mock.calls[0][0]!;
    const threshold = (call.where as any).expiresAt.lt as Date;
    // Should be about 1 hour in the past
    const hourAgo = before - 60 * 60 * 1000;
    expect(threshold.getTime()).toBeGreaterThanOrEqual(hourAgo - 1000);
    expect(threshold.getTime()).toBeLessThanOrEqual(after);
  });

  it('uses correct date filters for consent cleanup', async () => {
    const before = Date.now();
    await cleanupExpiredOAuthData();

    const call = mockPrisma.oAuthUserConsent.deleteMany.mock.calls[0][0]!;
    const threshold = (call.where as any).expiresAt.lt as Date;
    // Should be approximately now
    expect(threshold.getTime()).toBeGreaterThanOrEqual(before - 1000);
  });
});
