import crypto from 'crypto';
import { prisma } from '../lib/db.js';
import { hashPassword } from './auth.service.js';
import { createApiToken } from './token.service.js';
import type { CreateUserInput, UpdateUserInput } from '../utils/validation.schemas.js';
import { APP_VERSION, NODE_VERSION } from '../config/app.config.js';
import { AppError, BadRequestError } from '../utils/errors.js';

/** Common select fields for user queries */
const userSelect = {
  id: true,
  username: true,
  email: true,
  role: true,
  isActive: true,
  isServiceAccount: true,
  mustChangePassword: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * Get user by ID
 */
export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: userSelect,
  });

  if (!user) {
    throw new Error('User not found');
  }

  return user;
}

/**
 * Get user by username
 */
export async function getUserByUsername(username: string) {
  return prisma.user.findUnique({
    where: { username },
    select: userSelect,
  });
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: userSelect,
  });
}

/**
 * List all users (admin only)
 */
export async function listUsers(includeInactive = false) {
  return prisma.user.findMany({
    where: includeInactive ? undefined : { isActive: true },
    select: userSelect,
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Create a new user (admin only)
 * For service accounts: generates an unusable password hash and auto-creates an API token.
 * Returns user object with optional `apiToken` field (raw token, shown once).
 */
export async function createUser(data: CreateUserInput) {
  // Check if username or email already exists
  const orConditions: Array<{ username?: string; email?: string }> = [{ username: data.username }];
  if (data.email) {
    orConditions.push({ email: data.email });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: orConditions },
  });

  if (existing) {
    if (existing.username === data.username) {
      throw new Error('Username already exists');
    }
    if (data.email && existing.email === data.email) {
      throw new Error('Email already exists');
    }
  }

  const isServiceAccount = data.isServiceAccount || false;

  let passwordHash: string;
  if (isServiceAccount) {
    // Generate unusable password hash — bcrypt never produces hashes starting with '!'
    passwordHash = `!service-account-no-password:${crypto.randomBytes(16).toString('hex')}`;
  } else {
    passwordHash = await hashPassword(data.password!);
  }

  // Create user
  const user = await prisma.user.create({
    data: {
      username: data.username,
      email: data.email ?? null,
      passwordHash,
      role: data.role || 'user',
      isActive: true,
      isServiceAccount,
      mustChangePassword: isServiceAccount ? false : true,
    },
    select: userSelect,
  });

  // Auto-create API token for service accounts
  if (isServiceAccount) {
    const tokenResult = await createApiToken(user.id, {
      name: data.tokenName || 'Default',
      scopes: data.tokenScopes || ['read', 'write'],
      expiresIn: data.tokenExpiresIn ?? null,
    });

    return { ...user, apiToken: tokenResult.rawToken };
  }

  return user;
}

/**
 * Update user (admin only)
 * Note: isServiceAccount is deliberately excluded — it's immutable after creation.
 */
export async function updateUser(id: string, data: UpdateUserInput) {
  // Defensive strip: ensure isServiceAccount can never be changed via update
  const { isServiceAccount: _stripped, ...safeData } = data as UpdateUserInput & { isServiceAccount?: unknown };

  // Check if user exists
  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('User not found');
  }

  // If user is being deactivated, update user and invalidate sessions atomically
  if (safeData.isActive === false) {
    const [user] = await prisma.$transaction([
      prisma.user.update({
        where: { id },
        data: safeData,
        select: userSelect,
      }),
      prisma.session.deleteMany({
        where: { userId: id },
      }),
    ]);
    return user;
  }

  // Normal update without session invalidation
  return prisma.user.update({
    where: { id },
    data: safeData,
    select: userSelect,
  });
}

/**
 * Delete user (soft delete - deactivate)
 */
export async function deleteUser(id: string) {
  return updateUser(id, { isActive: false });
}

/**
 * Reset user password (admin only)
 */
export async function resetUserPassword(id: string, newPassword: string) {
  // Check if user is a service account
  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: { isServiceAccount: true },
  });

  if (!existingUser) {
    throw new Error('User not found');
  }

  if (existingUser.isServiceAccount) {
    throw new BadRequestError('Cannot reset password for service accounts. Use API tokens instead.');
  }

  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password and invalidate all sessions atomically
  const [user] = await prisma.$transaction([
    prisma.user.update({
      where: { id },
      data: {
        passwordHash,
        mustChangePassword: true,
      },
      select: userSelect,
    }),
    prisma.session.deleteMany({
      where: { userId: id },
    }),
  ]);

  return user;
}

/**
 * Get user statistics
 */
export async function getUserStats() {
  const [totalUsers, activeUsers, adminUsers, serviceAccounts] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: 'admin', isActive: true } }),
    prisma.user.count({ where: { isServiceAccount: true, isActive: true } }),
  ]);

  return {
    totalUsers,
    activeUsers,
    inactiveUsers: totalUsers - activeUsers,
    adminUsers,
    serviceAccounts,
  };
}

/**
 * List all service account users
 */
export async function listServiceAccounts() {
  return prisma.user.findMany({
    where: { isServiceAccount: true },
    select: userSelect,
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * List all notes from service account users (admin read-only)
 */
export async function listServiceAccountNotes(options?: { limit?: number; offset?: number; userId?: string }) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const where = {
    user: { isServiceAccount: true },
    deleted: false as const,
    ...(options?.userId && { userId: options.userId }),
  };

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        folderId: true,
        user: { select: { id: true, username: true } },
        folder: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.note.count({ where }),
  ]);

  return { notes, total };
}

/**
 * Get a single note by ID from a service account (admin read-only, bypasses ownership check)
 */
export async function getServiceAccountNote(noteId: string) {
  const note = await prisma.note.findUnique({
    where: { id: noteId },
    select: {
      id: true,
      title: true,
      content: true,
      createdAt: true,
      updatedAt: true,
      folderId: true,
      user: { select: { id: true, username: true, isServiceAccount: true } },
      folder: { select: { id: true, name: true } },
      tags: {
        select: {
          tag: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!note) {
    throw new Error('Note not found');
  }

  // Only allow access to notes owned by service accounts
  if (!note.user.isServiceAccount) {
    throw new Error('Note does not belong to a service account');
  }

  return note;
}

/**
 * List all tasks from service account users (admin read-only)
 */
export async function listServiceAccountTasks(options?: { limit?: number; offset?: number }) {
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const where = { user: { isServiceAccount: true } };

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        noteId: true,
        noteTitle: true,
        folderId: true,
        createdAt: true,
        updatedAt: true,
        completedAt: true,
        user: { select: { id: true, username: true } },
        folder: { select: { id: true, name: true } },
        tags: { select: { tag: { select: { id: true, name: true } } } },
        links: { select: { id: true, url: true, title: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.task.count({ where }),
  ]);

  return { tasks, total };
}

/**
 * Verify a user ID belongs to a service account. Throws if not found or not a service account.
 */
async function verifyServiceAccountUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isServiceAccount: true },
  });
  if (!user) {
    throw new AppError('Service account not found', 404);
  }
  if (!user.isServiceAccount) {
    throw new AppError('User is not a service account', 400);
  }
}

/**
 * Get folders for a specific service account (admin read-only)
 */
export async function getServiceAccountFolders(userId: string) {
  await verifyServiceAccountUser(userId);
  const folders = await prisma.folder.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      icon: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { notes: { where: { deleted: false } } },
      },
    },
    orderBy: { name: 'asc' },
  });

  // Also count unfiled notes (no folder)
  const unfiledCount = await prisma.note.count({
    where: { userId, folderId: null, deleted: false },
  });

  return {
    folders: folders.map((f) => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      createdAt: f.createdAt,
      updatedAt: f.updatedAt,
      noteCount: f._count.notes,
    })),
    unfiledCount,
  };
}

/**
 * Get notes for a specific service account, filtered by folder (admin read-only)
 */
export async function getServiceAccountNotes(
  userId: string,
  options?: { folderId?: string | null; limit?: number; offset?: number }
) {
  await verifyServiceAccountUser(userId);
  const limit = options?.limit ?? 50;
  const offset = options?.offset ?? 0;

  const where: {
    userId: string;
    deleted: boolean;
    folderId?: string | null;
  } = { userId, deleted: false };

  if (options?.folderId === 'unfiled') {
    where.folderId = null;
  } else if (options?.folderId) {
    where.folderId = options.folderId;
  }

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        folderId: true,
        folder: { select: { id: true, name: true } },
        tags: { select: { tag: { select: { id: true, name: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.note.count({ where }),
  ]);

  return {
    notes: notes.map((n) => ({
      ...n,
      tags: n.tags.map((nt) => nt.tag),
    })),
    total,
  };
}

/**
 * Get tags for a specific service account with usage counts (admin read-only)
 */
export async function getServiceAccountTags(userId: string) {
  await verifyServiceAccountUser(userId);
  const tags = await prisma.tag.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      createdAt: true,
      _count: {
        select: {
          notes: true,
          taskTags: true,
        },
      },
    },
    orderBy: { name: 'asc' },
  });

  return tags.map((t) => ({
    id: t.id,
    name: t.name,
    createdAt: t.createdAt,
    noteCount: t._count.notes,
    taskCount: t._count.taskTags,
    usageCount: t._count.notes + t._count.taskTags,
  }));
}

/**
 * Get per-account stats for all service accounts (dashboard)
 * Returns counts, last activity, recent notes, and token health per account.
 */
/**
 * Get activity timeline for a specific service account.
 * Merges notes, tasks, and folders into a reverse-chronological stream.
 * Action derived from timestamps: created (createdAt ~= updatedAt within 1s) vs updated.
 */
export async function getServiceAccountActivity(
  userId: string,
  options?: { limit?: number; before?: string }
) {
  await verifyServiceAccountUser(userId);

  const limit = Math.min(options?.limit ?? 50, 100);
  const beforeDate = options?.before ? new Date(options.before) : undefined;

  // Build date filter for cursor pagination
  const dateFilter = beforeDate ? { lt: beforeDate } : undefined;

  // Fetch notes, tasks, and folders in parallel
  const [notes, tasks, folders] = await Promise.all([
    prisma.note.findMany({
      where: {
        userId,
        deleted: false,
        ...(dateFilter && { updatedAt: dateFilter }),
      },
      select: {
        id: true,
        title: true,
        createdAt: true,
        updatedAt: true,
        folderId: true,
        folder: { select: { id: true, name: true } },
        tags: { select: { tag: { select: { id: true, name: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1, // fetch one extra to check hasMore
    }),
    prisma.task.findMany({
      where: {
        userId,
        ...(dateFilter && { updatedAt: dateFilter }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        folderId: true,
        folder: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
    }),
    prisma.folder.findMany({
      where: {
        userId,
        ...(dateFilter && { updatedAt: dateFilter }),
      },
      select: {
        id: true,
        name: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
      take: limit + 1,
    }),
  ]);

  // Derive action: created if createdAt ~= updatedAt (within 1 second)
  function deriveAction(createdAt: Date, updatedAt: Date): 'created' | 'updated' {
    return Math.abs(createdAt.getTime() - updatedAt.getTime()) < 1000 ? 'created' : 'updated';
  }

  // Merge into unified timeline
  type ActivityItem = {
    type: 'note' | 'task' | 'folder';
    action: 'created' | 'updated';
    id: string;
    title: string;
    folder: { id: string; name: string } | null;
    timestamp: string;
    tags?: Array<{ id: string; name: string }>;
    status?: string;
  };

  const items: ActivityItem[] = [
    ...notes.map((n) => ({
      type: 'note' as const,
      action: deriveAction(n.createdAt, n.updatedAt),
      id: n.id,
      title: n.title,
      folder: n.folder,
      timestamp: n.updatedAt.toISOString(),
      tags: n.tags.map((nt) => nt.tag),
    })),
    ...tasks.map((t) => ({
      type: 'task' as const,
      action: deriveAction(t.createdAt, t.updatedAt),
      id: t.id,
      title: t.title,
      folder: t.folder,
      timestamp: t.updatedAt.toISOString(),
      status: t.status,
    })),
    ...folders.map((f) => ({
      type: 'folder' as const,
      action: deriveAction(f.createdAt, f.updatedAt),
      id: f.id,
      title: f.name,
      folder: null,
      timestamp: f.updatedAt.toISOString(),
    })),
  ];

  // Sort by timestamp descending
  items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Apply limit and determine hasMore
  const trimmed = items.slice(0, limit);
  const hasMore = items.length > limit;
  const nextCursor = trimmed.length > 0 ? trimmed[trimmed.length - 1].timestamp : null;

  return { items: trimmed, hasMore, nextCursor };
}

export async function getServiceAccountStats() {
  // TODO: If account count grows beyond ~20, consolidate per-account queries
  // into raw SQL aggregates to avoid the N+1 pattern below (5 queries per account).
  const accounts = await prisma.user.findMany({
    where: { isServiceAccount: true },
    select: {
      id: true,
      username: true,
      _count: {
        select: {
          notes: { where: { deleted: false } },
          folders: true,
          tags: true,
          tasks: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  const stats = await Promise.all(
    accounts.map(async (account) => {
      // Get most recent updatedAt across notes, tasks, and folders
      const [latestNote, latestTask, latestFolder] = await Promise.all([
        prisma.note.findFirst({
          where: { userId: account.id, deleted: false },
          select: { updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.task.findFirst({
          where: { userId: account.id },
          select: { updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.folder.findFirst({
          where: { userId: account.id },
          select: { updatedAt: true },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

      const timestamps = [
        latestNote?.updatedAt,
        latestTask?.updatedAt,
        latestFolder?.updatedAt,
      ].filter(Boolean) as Date[];
      const lastActivity = timestamps.length > 0
        ? new Date(Math.max(...timestamps.map((t) => t.getTime())))
        : null;

      // Get 3 most recent notes for preview
      const recentNotes = await prisma.note.findMany({
        where: { userId: account.id, deleted: false },
        select: { id: true, title: true, updatedAt: true },
        orderBy: { updatedAt: 'desc' },
        take: 3,
      });

      // Token health: active tokens, earliest expiry, last used
      const now = new Date();
      const activeTokens = await prisma.apiToken.findMany({
        where: {
          userId: account.id,
          revokedAt: null,
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: now } },
          ],
        },
        select: { expiresAt: true, lastUsedAt: true },
      });

      const tokenCount = activeTokens.length;
      const expiringTokens = activeTokens
        .filter((t) => t.expiresAt !== null)
        .map((t) => t.expiresAt!.getTime());
      const earliestTokenExpiry = expiringTokens.length > 0
        ? new Date(Math.min(...expiringTokens))
        : null;

      const tokenLastUsed = activeTokens
        .filter((t) => t.lastUsedAt !== null)
        .map((t) => t.lastUsedAt!.getTime());
      const lastTokenUsedAt = tokenLastUsed.length > 0
        ? new Date(Math.max(...tokenLastUsed))
        : null;

      return {
        id: account.id,
        username: account.username,
        noteCount: account._count.notes,
        folderCount: account._count.folders,
        tagCount: account._count.tags,
        taskCount: account._count.tasks,
        lastActivity: lastActivity?.toISOString() ?? null,
        recentNotes,
        tokenCount,
        earliestTokenExpiry: earliestTokenExpiry?.toISOString() ?? null,
        lastTokenUsedAt: lastTokenUsedAt?.toISOString() ?? null,
      };
    })
  );

  return stats;
}

/**
 * Get system information
 */
export async function getSystemInfo() {
  // Check database connection
  let databaseStatus = 'connected';
  let databaseInfo = 'PostgreSQL';

  try {
    await prisma.$queryRaw`SELECT 1`;

    // Try to get database version
    try {
      const result = await prisma.$queryRaw<Array<{ version: string }>>`SELECT version()`;
      if (result && result.length > 0) {
        // Extract PostgreSQL version from version string
        const versionMatch = result[0].version.match(/PostgreSQL ([\d.]+)/);
        if (versionMatch) {
          databaseInfo = `PostgreSQL ${versionMatch[1]}`;
        }
      }
    } catch {
      // Ignore version query errors
    }
  } catch {
    databaseStatus = 'disconnected';
  }

  // Get content statistics
  const [totalNotes, totalFolders, totalTags] = await Promise.all([
    prisma.note.count(),
    prisma.folder.count(),
    prisma.tag.count(),
  ]);

  // Calculate uptime
  const uptimeSeconds = process.uptime();
  const uptimeHours = Math.floor(uptimeSeconds / 3600);
  const uptimeMinutes = Math.floor((uptimeSeconds % 3600) / 60);
  const uptime = `${uptimeHours}h ${uptimeMinutes}m`;

  return {
    version: APP_VERSION,
    nodeVersion: NODE_VERSION,
    database: {
      status: databaseStatus,
      info: databaseInfo,
    },
    uptime,
    statistics: {
      totalNotes,
      totalFolders,
      totalTags,
    },
  };
}
