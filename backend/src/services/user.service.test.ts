import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the service
vi.mock('../lib/db.js', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    session: {
      deleteMany: vi.fn(),
    },
    note: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    folder: {
      count: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
    },
    tag: {
      count: vi.fn(),
      findMany: vi.fn(),
    },
    task: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    apiToken: {
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
    $queryRaw: vi.fn(),
  },
}));

// Mock auth service for hashPassword
vi.mock('./auth.service.js', () => ({
  hashPassword: vi.fn().mockResolvedValue('hashed-password'),
}));

// Mock token service for createApiToken
vi.mock('./token.service.js', () => ({
  createApiToken: vi.fn().mockResolvedValue({
    id: 'token-1',
    name: 'Default',
    prefix: 'ntez_xxxx',
    scopes: ['read', 'write'],
    expiresAt: null,
    createdAt: new Date(),
    rawToken: 'ntez_test-raw-token',
  }),
}));

// Mock app config
vi.mock('../config/app.config.js', () => ({
  APP_VERSION: '1.2.3',
  NODE_VERSION: 'v18.0.0',
}));

import {
  getUserById,
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  getUserStats,
  getSystemInfo,
  listServiceAccounts,
  listServiceAccountNotes,
  getServiceAccountNote,
  listServiceAccountTasks,
  getServiceAccountStats,
  getServiceAccountFolders,
  getServiceAccountNotes,
  getServiceAccountTags,
} from './user.service.js';
import { prisma } from '../lib/db.js';

const mockPrisma = vi.mocked(prisma);

const baseUser = {
  id: 'user-1',
  username: 'alice',
  email: 'alice@test.com',
  role: 'user',
  isActive: true,
  isServiceAccount: false,
  mustChangePassword: false,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('user.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getUserById ──────────────────────────────────────────────────────
  describe('getUserById', () => {
    it('should return user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser as any);

      const result = await getUserById('user-1');

      expect(result.id).toBe('user-1');
      expect(result.username).toBe('alice');
    });

    it('should throw when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(getUserById('user-999')).rejects.toThrow('User not found');
    });

    it('should query by id', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser as any);

      await getUserById('user-42');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'user-42' } })
      );
    });

    it('should include isServiceAccount in select', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(baseUser as any);

      await getUserById('user-1');

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({
          select: expect.objectContaining({ isServiceAccount: true }),
        })
      );
    });
  });

  // ─── listUsers ────────────────────────────────────────────────────────
  describe('listUsers', () => {
    it('should return only active users by default', async () => {
      mockPrisma.user.findMany.mockResolvedValue([baseUser] as any);

      await listUsers();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } })
      );
    });

    it('should return all users when includeInactive is true', async () => {
      mockPrisma.user.findMany.mockResolvedValue([baseUser] as any);

      await listUsers(true);

      // When includeInactive=true, where should be undefined (no filter)
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: undefined })
      );
    });

    it('should return empty array when no users exist', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await listUsers();

      expect(result).toEqual([]);
    });
  });

  // ─── createUser ───────────────────────────────────────────────────────
  describe('createUser', () => {
    const newUserData = {
      username: 'bob',
      email: 'bob@test.com',
      password: 'Password1!',
    };

    it('should create user and return without passwordHash', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...baseUser,
        id: 'user-new',
        username: 'bob',
        email: 'bob@test.com',
        mustChangePassword: true,
      } as any);

      const result = await createUser(newUserData);

      expect(result.username).toBe('bob');
      expect(result.email).toBe('bob@test.com');
      expect((result as any).passwordHash).toBeUndefined();
    });

    it('should throw when username already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'existing',
        username: 'bob',
        email: 'other@test.com',
      } as any);

      await expect(createUser(newUserData)).rejects.toThrow('Username already exists');
    });

    it('should throw when email already exists', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        id: 'existing',
        username: 'other',
        email: 'bob@test.com',
      } as any);

      await expect(createUser(newUserData)).rejects.toThrow('Email already exists');
    });

    it('should hash the password before creating user', async () => {
      const { hashPassword } = await import('./auth.service.js');
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...baseUser } as any);

      await createUser(newUserData);

      expect(hashPassword).toHaveBeenCalledWith('Password1!');
      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ passwordHash: 'hashed-password' }),
        })
      );
    });

    it('should set mustChangePassword to true on creation', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...baseUser } as any);

      await createUser(newUserData);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ mustChangePassword: true }),
        })
      );
    });

    it('should use provided role, defaulting to user', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...baseUser } as any);

      await createUser({ ...newUserData, role: 'admin' });

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ role: 'admin' }),
        })
      );
    });

    it('should pass isServiceAccount to Prisma create', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({
        ...baseUser,
        isServiceAccount: true,
      } as any);

      await createUser({ ...newUserData, isServiceAccount: true } as any);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isServiceAccount: true }),
        })
      );
    });

    it('should default isServiceAccount to false', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue({ ...baseUser } as any);

      await createUser(newUserData);

      expect(mockPrisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ isServiceAccount: false }),
        })
      );
    });

    describe('service account creation', () => {
      const serviceAccountData = {
        username: 'bot-agent',
        isServiceAccount: true,
      } as any;

      it('should generate unusable password hash for service accounts', async () => {
        const { hashPassword } = await import('./auth.service.js');
        mockPrisma.user.findFirst.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({
          ...baseUser,
          id: 'sa-1',
          isServiceAccount: true,
        } as any);

        await createUser(serviceAccountData);

        // hashPassword should NOT be called for service accounts
        expect(hashPassword).not.toHaveBeenCalled();
        // The password hash should start with the unusable prefix
        expect(mockPrisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({
              passwordHash: expect.stringMatching(/^!service-account-no-password:/),
            }),
          })
        );
      });

      it('should set mustChangePassword to false for service accounts', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({
          ...baseUser,
          isServiceAccount: true,
        } as any);

        await createUser(serviceAccountData);

        expect(mockPrisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ mustChangePassword: false }),
          })
        );
      });

      it('should auto-create API token and return it', async () => {
        const { createApiToken } = await import('./token.service.js');
        mockPrisma.user.findFirst.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({
          ...baseUser,
          id: 'sa-1',
          isServiceAccount: true,
        } as any);

        const result = await createUser(serviceAccountData);

        expect(createApiToken).toHaveBeenCalledWith('sa-1', {
          name: 'Default',
          scopes: ['read', 'write'],
          expiresIn: null,
        });
        expect((result as any).apiToken).toBe('ntez_test-raw-token');
      });

      it('should skip email in duplicate check when email is undefined', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({
          ...baseUser,
          id: 'sa-2',
          isServiceAccount: true,
          email: null,
        } as any);

        await createUser({ username: 'bot-no-email', isServiceAccount: true } as any);

        // The OR clause should only contain username, not email
        expect(mockPrisma.user.findFirst).toHaveBeenCalledWith({
          where: {
            OR: [{ username: 'bot-no-email' }],
          },
        });
      });

      it('should pass null email to Prisma for service accounts without email', async () => {
        mockPrisma.user.findFirst.mockResolvedValue(null);
        mockPrisma.user.create.mockResolvedValue({
          ...baseUser,
          id: 'sa-3',
          isServiceAccount: true,
          email: null,
        } as any);

        await createUser({ username: 'bot-null-email', isServiceAccount: true } as any);

        expect(mockPrisma.user.create).toHaveBeenCalledWith(
          expect.objectContaining({
            data: expect.objectContaining({ email: null }),
          })
        );
      });
    });
  });

  // ─── updateUser ───────────────────────────────────────────────────────
  describe('updateUser', () => {
    it('should throw when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(updateUser('user-999', { role: 'admin' })).rejects.toThrow('User not found');
    });

    it('should update user normally when isActive is not false', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      mockPrisma.user.update.mockResolvedValue({ ...baseUser, role: 'admin' } as any);

      const result = await updateUser('user-1', { role: 'admin' });

      expect(result.role).toBe('admin');
      expect(mockPrisma.user.update).toHaveBeenCalled();
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });

    it('should use $transaction to update and delete sessions when deactivating', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      const deactivatedUser = { ...baseUser, isActive: false };
      mockPrisma.user.update.mockResolvedValue(deactivatedUser as any);
      mockPrisma.$transaction.mockResolvedValue([deactivatedUser, { count: 2 }] as any);

      const result = await updateUser('user-1', { isActive: false });

      expect(result.isActive).toBe(false);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should strip isServiceAccount from update data (immutability guard)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      mockPrisma.user.update.mockResolvedValue({ ...baseUser } as any);

      // Pass isServiceAccount in update data — it should be stripped
      await updateUser('user-1', { role: 'admin', isServiceAccount: true } as any);

      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({ isServiceAccount: expect.anything() }),
        })
      );
    });
  });

  // ─── deleteUser ───────────────────────────────────────────────────────
  describe('deleteUser', () => {
    it('should deactivate user (soft delete)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1' } as any);
      const deactivatedUser = { ...baseUser, isActive: false };
      mockPrisma.$transaction.mockResolvedValue([deactivatedUser, { count: 1 }] as any);

      const result = await deleteUser('user-1');

      expect(result.isActive).toBe(false);
    });

    it('should throw if user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(deleteUser('user-999')).rejects.toThrow('User not found');
    });
  });

  // ─── resetUserPassword ────────────────────────────────────────────────
  describe('resetUserPassword', () => {
    it('should hash new password and use $transaction', async () => {
      const { hashPassword } = await import('./auth.service.js');
      mockPrisma.user.findUnique.mockResolvedValue({ isServiceAccount: false } as any);
      const updatedUser = { ...baseUser, mustChangePassword: true };
      mockPrisma.$transaction.mockResolvedValue([updatedUser, { count: 1 }] as any);

      const result = await resetUserPassword('user-1', 'NewPass1!');

      expect(hashPassword).toHaveBeenCalledWith('NewPass1!');
      expect(result.mustChangePassword).toBe(true);
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('should set mustChangePassword to true after reset', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isServiceAccount: false } as any);
      const updatedUser = { ...baseUser, mustChangePassword: true };
      mockPrisma.$transaction.mockResolvedValue([updatedUser, { count: 0 }] as any);

      const result = await resetUserPassword('user-1', 'AnyPass1!');

      expect(result.mustChangePassword).toBe(true);
    });

    it('should throw when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(resetUserPassword('user-999', 'Pass1!')).rejects.toThrow('User not found');
    });

    it('should throw for service accounts', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isServiceAccount: true } as any);

      await expect(resetUserPassword('sa-1', 'Pass1!')).rejects.toThrow(
        'Cannot reset password for service accounts'
      );
    });
  });

  // ─── getUserStats ─────────────────────────────────────────────────────
  describe('getUserStats', () => {
    it('should return correct stats including serviceAccounts', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(10) // totalUsers
        .mockResolvedValueOnce(8)  // activeUsers
        .mockResolvedValueOnce(2)  // adminUsers
        .mockResolvedValueOnce(1); // serviceAccounts

      const result = await getUserStats();

      expect(result.totalUsers).toBe(10);
      expect(result.activeUsers).toBe(8);
      expect(result.inactiveUsers).toBe(2);
      expect(result.adminUsers).toBe(2);
      expect(result.serviceAccounts).toBe(1);
    });

    it('should compute inactiveUsers as total minus active', async () => {
      mockPrisma.user.count
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(0);

      const result = await getUserStats();

      expect(result.inactiveUsers).toBe(2);
    });
  });

  // ─── listServiceAccounts ──────────────────────────────────────────────
  describe('listServiceAccounts', () => {
    it('should query for service account users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { ...baseUser, isServiceAccount: true, username: 'claude-agent' },
      ] as any);

      const result = await listServiceAccounts();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isServiceAccount: true },
        })
      );
      expect(result).toHaveLength(1);
      expect(result[0].username).toBe('claude-agent');
    });

    it('should return empty array when no service accounts', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await listServiceAccounts();

      expect(result).toEqual([]);
    });
  });

  // ─── listServiceAccountNotes ──────────────────────────────────────────
  describe('listServiceAccountNotes', () => {
    it('should return empty when no notes exist', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      const result = await listServiceAccountNotes();

      expect(result).toEqual({ notes: [], total: 0 });
    });

    it('should fetch notes from service account users using nested filter', async () => {
      mockPrisma.note.findMany.mockResolvedValue([
        { id: 'note-1', title: 'Agent Note', user: { id: 'sa-1', username: 'claude-agent' } },
      ] as any);
      mockPrisma.note.count.mockResolvedValue(1);

      const result = await listServiceAccountNotes();

      expect(result.notes).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { isServiceAccount: true }, deleted: false },
        })
      );
    });

    it('should filter by userId when provided', async () => {
      mockPrisma.note.findMany.mockResolvedValue([
        { id: 'note-1', title: 'Agent Note', user: { id: 'sa-1', username: 'claude-agent' } },
      ] as any);
      mockPrisma.note.count.mockResolvedValue(1);

      await listServiceAccountNotes({ userId: 'sa-1' });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: 'sa-1',
            user: { isServiceAccount: true },
            deleted: false,
          }),
        })
      );
    });

    it('should not include userId in where when not provided', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await listServiceAccountNotes({ limit: 50, offset: 0 });

      const callArgs = mockPrisma.note.findMany.mock.calls[0][0];
      expect(callArgs.where).not.toHaveProperty('userId');
    });
  });

  // ─── getServiceAccountNote ────────────────────────────────────────────
  describe('getServiceAccountNote', () => {
    it('should throw when note not found', async () => {
      mockPrisma.note.findUnique.mockResolvedValue(null);

      await expect(getServiceAccountNote('note-999')).rejects.toThrow('Note not found');
    });

    it('should throw when note does not belong to service account', async () => {
      mockPrisma.note.findUnique.mockResolvedValue({
        id: 'note-1',
        user: { id: 'user-1', username: 'alice', isServiceAccount: false },
      } as any);

      await expect(getServiceAccountNote('note-1')).rejects.toThrow(
        'Note does not belong to a service account'
      );
    });

    it('should return note when owned by service account', async () => {
      const mockNote = {
        id: 'note-1',
        title: 'Agent Note',
        content: 'some content',
        user: { id: 'sa-1', username: 'claude-agent', isServiceAccount: true },
        tags: [],
        folder: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      mockPrisma.note.findUnique.mockResolvedValue(mockNote as any);

      const result = await getServiceAccountNote('note-1');

      expect(result.id).toBe('note-1');
      expect(result.title).toBe('Agent Note');
    });
  });

  // ─── listServiceAccountTasks ──────────────────────────────────────────
  describe('listServiceAccountTasks', () => {
    it('should return empty when no tasks exist', async () => {
      mockPrisma.task.findMany.mockResolvedValue([]);
      mockPrisma.task.count.mockResolvedValue(0);

      const result = await listServiceAccountTasks();

      expect(result).toEqual({ tasks: [], total: 0 });
    });

    it('should fetch tasks from service account users using nested filter', async () => {
      mockPrisma.task.findMany.mockResolvedValue([
        { id: 'task-1', title: 'Agent Task', user: { id: 'sa-1', username: 'claude-agent' } },
      ] as any);
      mockPrisma.task.count.mockResolvedValue(1);

      const result = await listServiceAccountTasks();

      expect(result.tasks).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockPrisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { user: { isServiceAccount: true } },
        })
      );
    });
  });

  // ─── getServiceAccountStats ────────────────────────────────────────────
  describe('getServiceAccountStats', () => {
    const mockAccount = {
      id: 'sa-1',
      username: 'claude-agent',
      createdAt: new Date('2025-01-01'),
      _count: { notes: 5, folders: 2, tags: 3, tasks: 4 },
    };

    function setupStatsDefaults() {
      mockPrisma.user.findMany.mockResolvedValue([mockAccount] as any);
      // Latest timestamps for activity
      mockPrisma.note.findFirst.mockResolvedValue({ updatedAt: new Date('2026-04-05T14:00:00Z') } as any);
      mockPrisma.task.findFirst.mockResolvedValue({ updatedAt: new Date('2026-04-04T10:00:00Z') } as any);
      (mockPrisma.folder as any).findFirst.mockResolvedValue({ updatedAt: new Date('2026-04-03T08:00:00Z') } as any);
      // Recent notes
      mockPrisma.note.findMany.mockResolvedValue([
        { id: 'n1', title: 'Recent Note 1', updatedAt: new Date('2026-04-05T14:00:00Z') },
        { id: 'n2', title: 'Recent Note 2', updatedAt: new Date('2026-04-04T12:00:00Z') },
      ] as any);
      // Token health
      (mockPrisma.apiToken as any).findMany.mockResolvedValue([
        { expiresAt: new Date('2026-04-10T00:00:00Z'), lastUsedAt: new Date('2026-04-05T13:00:00Z') },
      ]);
    }

    it('should return stats for each service account', async () => {
      setupStatsDefaults();

      const result = await getServiceAccountStats();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('sa-1');
      expect(result[0].username).toBe('claude-agent');
      expect(result[0].noteCount).toBe(5);
      expect(result[0].folderCount).toBe(2);
      expect(result[0].tagCount).toBe(3);
      expect(result[0].taskCount).toBe(4);
    });

    it('should compute lastActivity as the most recent timestamp across content types', async () => {
      setupStatsDefaults();

      const result = await getServiceAccountStats();

      // Note has the latest updatedAt (2026-04-05T14:00:00Z)
      expect(result[0].lastActivity).toBe(new Date('2026-04-05T14:00:00Z').toISOString());
    });

    it('should return null lastActivity when account has no content', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockAccount] as any);
      mockPrisma.note.findFirst.mockResolvedValue(null);
      mockPrisma.task.findFirst.mockResolvedValue(null);
      (mockPrisma.folder as any).findFirst.mockResolvedValue(null);
      mockPrisma.note.findMany.mockResolvedValue([]);
      (mockPrisma.apiToken as any).findMany.mockResolvedValue([]);

      const result = await getServiceAccountStats();

      expect(result[0].lastActivity).toBeNull();
      expect(result[0].recentNotes).toEqual([]);
    });

    it('should return recent notes for card preview', async () => {
      setupStatsDefaults();

      const result = await getServiceAccountStats();

      expect(result[0].recentNotes).toHaveLength(2);
      expect(result[0].recentNotes[0].title).toBe('Recent Note 1');
    });

    it('should return token health data', async () => {
      setupStatsDefaults();

      const result = await getServiceAccountStats();

      expect(result[0].tokenCount).toBe(1);
      expect(result[0].earliestTokenExpiry).toBe(new Date('2026-04-10T00:00:00Z').toISOString());
      expect(result[0].lastTokenUsedAt).toBe(new Date('2026-04-05T13:00:00Z').toISOString());
    });

    it('should return null token dates when no active tokens exist', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockAccount] as any);
      mockPrisma.note.findFirst.mockResolvedValue(null);
      mockPrisma.task.findFirst.mockResolvedValue(null);
      (mockPrisma.folder as any).findFirst.mockResolvedValue(null);
      mockPrisma.note.findMany.mockResolvedValue([]);
      (mockPrisma.apiToken as any).findMany.mockResolvedValue([]);

      const result = await getServiceAccountStats();

      expect(result[0].tokenCount).toBe(0);
      expect(result[0].earliestTokenExpiry).toBeNull();
      expect(result[0].lastTokenUsedAt).toBeNull();
    });

    it('should return empty array when no service accounts exist', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await getServiceAccountStats();

      expect(result).toEqual([]);
    });

    it('should pick earliest expiry from multiple tokens', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockAccount] as any);
      mockPrisma.note.findFirst.mockResolvedValue(null);
      mockPrisma.task.findFirst.mockResolvedValue(null);
      (mockPrisma.folder as any).findFirst.mockResolvedValue(null);
      mockPrisma.note.findMany.mockResolvedValue([]);
      (mockPrisma.apiToken as any).findMany.mockResolvedValue([
        { expiresAt: new Date('2026-05-01T00:00:00Z'), lastUsedAt: new Date('2026-04-01T00:00:00Z') },
        { expiresAt: new Date('2026-04-10T00:00:00Z'), lastUsedAt: new Date('2026-04-05T00:00:00Z') },
        { expiresAt: null, lastUsedAt: null }, // never-expiring token
      ]);

      const result = await getServiceAccountStats();

      expect(result[0].tokenCount).toBe(3);
      // Earliest expiry should be Apr 10, ignoring the null (never-expiring) token
      expect(result[0].earliestTokenExpiry).toBe(new Date('2026-04-10T00:00:00Z').toISOString());
      // Most recent lastUsedAt should be Apr 5
      expect(result[0].lastTokenUsedAt).toBe(new Date('2026-04-05T00:00:00Z').toISOString());
    });

    it('should return null earliestTokenExpiry when all tokens are non-expiring', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockAccount] as any);
      mockPrisma.note.findFirst.mockResolvedValue(null);
      mockPrisma.task.findFirst.mockResolvedValue(null);
      (mockPrisma.folder as any).findFirst.mockResolvedValue(null);
      mockPrisma.note.findMany.mockResolvedValue([]);
      (mockPrisma.apiToken as any).findMany.mockResolvedValue([
        { expiresAt: null, lastUsedAt: new Date('2026-04-05T00:00:00Z') },
      ]);

      const result = await getServiceAccountStats();

      expect(result[0].tokenCount).toBe(1);
      expect(result[0].earliestTokenExpiry).toBeNull();
      expect(result[0].lastTokenUsedAt).toBe(new Date('2026-04-05T00:00:00Z').toISOString());
    });

    it('should query only service account users', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      await getServiceAccountStats();

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isServiceAccount: true },
        })
      );
    });
  });

  // ─── getServiceAccountFolders ──────────────────────────────────────────
  describe('getServiceAccountFolders', () => {
    beforeEach(() => {
      // All per-account methods now verify the user is a service account
      mockPrisma.user.findUnique.mockResolvedValue({ isServiceAccount: true } as any);
    });

    it('should return folders with note counts', async () => {
      (mockPrisma.folder as any).findMany.mockResolvedValue([
        { id: 'f1', name: 'Research', icon: 'folder', createdAt: new Date(), updatedAt: new Date(), _count: { notes: 3 } },
        { id: 'f2', name: 'Daily Logs', icon: 'calendar', createdAt: new Date(), updatedAt: new Date(), _count: { notes: 7 } },
      ]);
      mockPrisma.note.count.mockResolvedValue(2); // unfiled

      const result = await getServiceAccountFolders('sa-1');

      expect(result.folders).toHaveLength(2);
      expect(result.folders[0].name).toBe('Research');
      expect(result.folders[0].noteCount).toBe(3);
      expect(result.unfiledCount).toBe(2);
    });

    it('should return empty folders and zero unfiled', async () => {
      (mockPrisma.folder as any).findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      const result = await getServiceAccountFolders('sa-1');

      expect(result.folders).toEqual([]);
      expect(result.unfiledCount).toBe(0);
    });

    it('should filter by userId', async () => {
      (mockPrisma.folder as any).findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await getServiceAccountFolders('sa-42');

      expect((mockPrisma.folder as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'sa-42' } })
      );
    });

    it('should throw 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(getServiceAccountFolders('nonexistent')).rejects.toThrow('Service account not found');
    });

    it('should throw 400 for non-service-account user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isServiceAccount: false } as any);

      await expect(getServiceAccountFolders('regular-user')).rejects.toThrow('User is not a service account');
    });
  });

  // ─── getServiceAccountNotes ───────────────────────────────────────────
  describe('getServiceAccountNotes', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ isServiceAccount: true } as any);
    });

    it('should return notes with tags mapped', async () => {
      mockPrisma.note.findMany.mockResolvedValue([
        {
          id: 'n1', title: 'Note 1', createdAt: new Date(), updatedAt: new Date(),
          folderId: 'f1', folder: { id: 'f1', name: 'Research' },
          tags: [{ tag: { id: 't1', name: 'security' } }],
        },
      ] as any);
      mockPrisma.note.count.mockResolvedValue(1);

      const result = await getServiceAccountNotes('sa-1');

      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].tags).toEqual([{ id: 't1', name: 'security' }]);
      expect(result.total).toBe(1);
    });

    it('should filter by folderId when provided', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await getServiceAccountNotes('sa-1', { folderId: 'f1' });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ folderId: 'f1' }),
        })
      );
    });

    it('should filter unfiled notes (folderId=null) when folderId is "unfiled"', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await getServiceAccountNotes('sa-1', { folderId: 'unfiled' });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ folderId: null }),
        })
      );
    });

    it('should apply pagination', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await getServiceAccountNotes('sa-1', { limit: 25, offset: 50 });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 25, skip: 50 })
      );
    });

    it('should throw 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(getServiceAccountNotes('nonexistent')).rejects.toThrow('Service account not found');
    });
  });

  // ─── getServiceAccountTags ────────────────────────────────────────────
  describe('getServiceAccountTags', () => {
    beforeEach(() => {
      mockPrisma.user.findUnique.mockResolvedValue({ isServiceAccount: true } as any);
    });

    it('should return tags with split and combined usage counts', async () => {
      (mockPrisma.tag as any).findMany.mockResolvedValue([
        { id: 't1', name: 'security', createdAt: new Date(), _count: { notes: 3, taskTags: 2 } },
        { id: 't2', name: 'architecture', createdAt: new Date(), _count: { notes: 1, taskTags: 0 } },
      ]);

      const result = await getServiceAccountTags('sa-1');

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('security');
      expect(result[0].noteCount).toBe(3);
      expect(result[0].taskCount).toBe(2);
      expect(result[0].usageCount).toBe(5); // 3 + 2
      expect(result[1].noteCount).toBe(1);
      expect(result[1].taskCount).toBe(0);
      expect(result[1].usageCount).toBe(1); // 1 + 0
    });

    it('should return empty array when no tags', async () => {
      (mockPrisma.tag as any).findMany.mockResolvedValue([]);

      const result = await getServiceAccountTags('sa-1');

      expect(result).toEqual([]);
    });

    it('should filter by userId', async () => {
      (mockPrisma.tag as any).findMany.mockResolvedValue([]);

      await getServiceAccountTags('sa-42');

      expect((mockPrisma.tag as any).findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { userId: 'sa-42' } })
      );
    });

    it('should throw 404 for non-existent user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(getServiceAccountTags('nonexistent')).rejects.toThrow('Service account not found');
    });

    it('should throw 400 for non-service-account user', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ isServiceAccount: false } as any);

      await expect(getServiceAccountTags('regular-user')).rejects.toThrow('User is not a service account');
    });
  });

  // ─── getSystemInfo ────────────────────────────────────────────────────
  describe('getSystemInfo', () => {
    it('should return version and node version from config', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ version: 'PostgreSQL 15.2 on x86_64' }] as any);
      mockPrisma.note.count.mockResolvedValue(100);
      mockPrisma.folder.count.mockResolvedValue(10);
      mockPrisma.tag.count.mockResolvedValue(20);

      const result = await getSystemInfo();

      expect(result.version).toBe('1.2.3');
      expect(result.nodeVersion).toBe('v18.0.0');
    });

    it('should return database as connected when query succeeds', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ version: 'PostgreSQL 15.2 on x86_64' }] as any);
      mockPrisma.note.count.mockResolvedValue(0);
      mockPrisma.folder.count.mockResolvedValue(0);
      mockPrisma.tag.count.mockResolvedValue(0);

      const result = await getSystemInfo();

      expect(result.database.status).toBe('connected');
    });

    it('should return database as disconnected when query fails', async () => {
      mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
      mockPrisma.note.count.mockResolvedValue(0);
      mockPrisma.folder.count.mockResolvedValue(0);
      mockPrisma.tag.count.mockResolvedValue(0);

      const result = await getSystemInfo();

      expect(result.database.status).toBe('disconnected');
    });

    it('should return statistics from counts', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ version: 'PostgreSQL 15.2' }] as any);
      mockPrisma.note.count.mockResolvedValue(50);
      mockPrisma.folder.count.mockResolvedValue(5);
      mockPrisma.tag.count.mockResolvedValue(15);

      const result = await getSystemInfo();

      expect(result.statistics.totalNotes).toBe(50);
      expect(result.statistics.totalFolders).toBe(5);
      expect(result.statistics.totalTags).toBe(15);
    });

    it('should return uptime string', async () => {
      mockPrisma.$queryRaw.mockResolvedValue([{ version: 'PostgreSQL 15.2' }] as any);
      mockPrisma.note.count.mockResolvedValue(0);
      mockPrisma.folder.count.mockResolvedValue(0);
      mockPrisma.tag.count.mockResolvedValue(0);

      const result = await getSystemInfo();

      expect(result.uptime).toMatch(/\d+h \d+m/);
    });
  });
});
