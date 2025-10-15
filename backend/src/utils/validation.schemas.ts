import { z } from 'zod';

// Password requirements: min 8 chars, 1 uppercase, 1 number, 1 special char
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

const usernameSchema = z
  .string()
  .min(3, 'Username must be at least 3 characters')
  .max(50, 'Username must not exceed 50 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens');

const emailSchema = z.string().email('Invalid email address');

// Auth schemas
export const setupSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
});

export const loginSchema = z.object({
  usernameOrEmail: z.string().min(1, 'Username or email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
});

// User management schemas (admin)
export const createUserSchema = z.object({
  username: usernameSchema,
  email: emailSchema,
  password: passwordSchema,
  role: z.enum(['admin', 'user']).default('user'),
});

export const updateUserSchema = z.object({
  isActive: z.boolean().optional(),
  mustChangePassword: z.boolean().optional(),
  role: z.enum(['admin', 'user']).optional(),
});

export const resetPasswordSchema = z.object({
  newPassword: passwordSchema,
});

// Note schemas
export const createNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must not exceed 500 characters'),
  content: z.string().optional(),
  folderId: z.string().uuid('Invalid folder ID').optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
});

export const updateNoteSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must not exceed 500 characters').optional(),
  content: z.string().optional(),
  folderId: z.string().uuid('Invalid folder ID').nullable().optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
});

export const listNotesQuerySchema = z.object({
  folderId: z.string().uuid('Invalid folder ID').optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Type exports
export type SetupInput = z.infer<typeof setupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;
export type ListNotesQuery = z.infer<typeof listNotesQuerySchema>;
