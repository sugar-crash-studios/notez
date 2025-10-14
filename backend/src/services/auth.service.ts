import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';
import { generateTokenPair, verifyRefreshToken, type TokenPayload } from '../utils/jwt.utils.js';
import type { SetupInput, LoginInput, ChangePasswordInput } from '../utils/validation.schemas.js';

const prisma = new PrismaClient();
const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if this is the first user (for initial setup)
 */
export async function isFirstUser(): Promise<boolean> {
  const userCount = await prisma.user.count();
  return userCount === 0;
}

/**
 * Create the first admin user (initial setup)
 */
export async function setupFirstUser(data: SetupInput) {
  // Verify this is the first user
  const isFirst = await isFirstUser();
  if (!isFirst) {
    throw new Error('Setup has already been completed');
  }

  // Check if username or email already exists (shouldn't happen, but defensive)
  const existing = await prisma.user.findFirst({
    where: {
      OR: [{ username: data.username }, { email: data.email }],
    },
  });

  if (existing) {
    throw new Error('Username or email already exists');
  }

  // Hash password
  const passwordHash = await hashPassword(data.password);

  // Create admin user
  const user = await prisma.user.create({
    data: {
      username: data.username,
      email: data.email,
      passwordHash,
      role: 'admin',
      isActive: true,
      mustChangePassword: false,
    },
  });

  // Generate tokens
  const tokens = generateTokenPair({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  // Store refresh token in database
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt,
    },
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    tokens,
  };
}

/**
 * Login with username or email
 */
export async function login(data: LoginInput) {
  // Find user by username or email
  const user = await prisma.user.findFirst({
    where: {
      OR: [{ username: data.usernameOrEmail }, { email: data.usernameOrEmail }],
    },
  });

  if (!user) {
    throw new Error('Invalid credentials');
  }

  // Check if user is active
  if (!user.isActive) {
    throw new Error('Account is deactivated');
  }

  // Verify password
  const isValidPassword = await verifyPassword(data.password, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Invalid credentials');
  }

  // Generate tokens
  const tokens = generateTokenPair({
    userId: user.id,
    username: user.username,
    role: user.role,
  });

  // Store refresh token
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: tokens.refreshToken,
      expiresAt,
    },
  });

  return {
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
    tokens,
  };
}

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(refreshToken: string) {
  // Verify refresh token
  let payload: TokenPayload;
  try {
    payload = verifyRefreshToken(refreshToken);
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }

  // Check if refresh token exists in database
  const session = await prisma.session.findUnique({
    where: { refreshToken },
    include: { user: true },
  });

  if (!session) {
    throw new Error('Invalid refresh token');
  }

  // Check if session is expired
  if (session.expiresAt < new Date()) {
    // Delete expired session
    await prisma.session.delete({ where: { id: session.id } });
    throw new Error('Refresh token expired');
  }

  // Check if user is still active
  if (!session.user.isActive) {
    throw new Error('Account is deactivated');
  }

  // Generate new token pair
  const tokens = generateTokenPair({
    userId: session.user.id,
    username: session.user.username,
    role: session.user.role,
  });

  // Update session with new refresh token
  const newExpiresAt = new Date();
  newExpiresAt.setDate(newExpiresAt.getDate() + 7);

  await prisma.session.update({
    where: { id: session.id },
    data: {
      refreshToken: tokens.refreshToken,
      expiresAt: newExpiresAt,
    },
  });

  return {
    user: {
      id: session.user.id,
      username: session.user.username,
      email: session.user.email,
      role: session.user.role,
      mustChangePassword: session.user.mustChangePassword,
    },
    tokens,
  };
}

/**
 * Logout (invalidate refresh token)
 */
export async function logout(refreshToken: string) {
  await prisma.session.deleteMany({
    where: { refreshToken },
  });
}

/**
 * Change user's own password
 */
export async function changePassword(userId: string, data: ChangePasswordInput) {
  // Get user
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw new Error('User not found');
  }

  // Verify current password
  const isValidPassword = await verifyPassword(data.currentPassword, user.passwordHash);
  if (!isValidPassword) {
    throw new Error('Current password is incorrect');
  }

  // Hash new password
  const newPasswordHash = await hashPassword(data.newPassword);

  // Update password and clear mustChangePassword flag
  await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash: newPasswordHash,
      mustChangePassword: false,
    },
  });
}

/**
 * Clean up expired sessions (should be run periodically)
 */
export async function cleanupExpiredSessions() {
  const result = await prisma.session.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}
