import { PrismaClient } from '@prisma/client';
import { hashPassword } from './auth.service.js';
import type { CreateUserInput, UpdateUserInput } from '../utils/validation.schemas.js';

const prisma = new PrismaClient();

/**
 * Get user by ID
 */
export async function getUserById(id: string) {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
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
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string) {
  return prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

/**
 * List all users (admin only)
 */
export async function listUsers(includeInactive = false) {
  return prisma.user.findMany({
    where: includeInactive ? undefined : { isActive: true },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
}

/**
 * Create a new user (admin only)
 */
export async function createUser(data: CreateUserInput) {
  // Check if username or email already exists
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: data.username }, { email: data.email }],
    },
  });

  if (existing) {
    if (existing.username === data.username) {
      throw new Error('Username already exists');
    }
    if (existing.email === data.email) {
      throw new Error('Email already exists');
    }
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create user
  const user = await prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      passwordHash,
      role: data.role || 'user',
      isActive: true,
      mustChangePassword: true, // Force password change on first login
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return user;
}

/**
 * Update user (admin only)
 */
export async function updateUser(id: string, data: UpdateUserInput) {
  // Check if user exists
  const existing = await prisma.user.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new Error('User not found');
  }

  // Update user
  const user = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // If user is being deactivated, invalidate all their sessions
  if (data.isActive === false) {
    await prisma.session.deleteMany({
      where: { userId: id },
    });
  }

  return user;
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
  // Hash new password
  const passwordHash = await hashPassword(newPassword);

  // Update password and force change on next login
  const user = await prisma.user.update({
    where: { id },
    data: {
      passwordHash,
      mustChangePassword: true,
    },
    select: {
      id: true,
      username: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // Invalidate all user sessions
  await prisma.session.deleteMany({
    where: { userId: id },
  });

  return user;
}

/**
 * Get user statistics
 */
export async function getUserStats() {
  const [totalUsers, activeUsers, adminUsers] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { isActive: true } }),
    prisma.user.count({ where: { role: 'admin', isActive: true } }),
  ]);

  return {
    totalUsers,
    activeUsers,
    inactiveUsers: totalUsers - activeUsers,
    adminUsers,
  };
}
