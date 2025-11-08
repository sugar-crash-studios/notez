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
  folderId: z.preprocess(
    (val) => (val === 'null' ? null : val),
    z.string().uuid('Invalid folder ID').nullable()
  ).optional(),
  tagId: z.string().uuid('Invalid tag ID').optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

// Folder schemas
export const createFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(255, 'Folder name must not exceed 255 characters'),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(255, 'Folder name must not exceed 255 characters'),
});

// AI schemas
export const aiConfigSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'gemini']),
  apiKey: z.string().min(1, 'API key is required'),
  model: z.string().optional(),
});

export const aiSummarizeSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  maxLength: z.number().int().min(10).max(1000).default(100).optional(),
});

export const aiSuggestTitleSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  maxLength: z.number().int().min(10).max(100).default(60).optional(),
});

export const aiSuggestTagsSchema = z.object({
  content: z.string().min(1, 'Content is required'),
  maxTags: z.number().int().min(1).max(20).default(5).optional(),
});

// Task schemas
export const createTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must not exceed 500 characters'),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).default('PENDING').optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM').optional(),
  dueDate: z.string().datetime().optional(),
  noteId: z.string().uuid('Invalid note ID').optional(),
  folderId: z.string().uuid('Invalid folder ID').optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1, 'Title is required').max(500, 'Title must not exceed 500 characters').optional(),
  description: z.string().optional(),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  noteId: z.string().uuid('Invalid note ID').nullable().optional(),
  folderId: z.string().uuid('Invalid folder ID').nullable().optional(),
  tags: z.array(z.string().min(1).max(100)).optional(),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
});

export const listTasksQuerySchema = z.object({
  status: z.union([
    z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']),
    z.array(z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])),
  ]).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  folderId: z.string().uuid('Invalid folder ID').optional(),
  noteId: z.string().uuid('Invalid note ID').optional(),
  tagId: z.string().uuid('Invalid tag ID').optional(),
  overdue: z.coerce.boolean().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export const importTasksSchema = z.object({
  folderId: z.string().uuid('Invalid folder ID').optional(),
  noteIds: z.array(z.string().uuid()).optional(),
});

// Tag schemas
export const renameTagSchema = z.object({
  name: z.string().min(1, 'Tag name is required').max(100, 'Tag name must not exceed 100 characters'),
});

export const tagSearchQuerySchema = z.object({
  q: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(10),
});

// UUID param schema (reusable)
export const uuidParamSchema = z.object({
  id: z.string().uuid('Invalid ID format'),
});

export const tagIdParamSchema = z.object({
  id: z.string().uuid('Invalid tag ID'),
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
export type CreateFolderInput = z.infer<typeof createFolderSchema>;
export type UpdateFolderInput = z.infer<typeof updateFolderSchema>;
export type AIConfigInput = z.infer<typeof aiConfigSchema>;
export type AISummarizeInput = z.infer<typeof aiSummarizeSchema>;
export type AISuggestTitleInput = z.infer<typeof aiSuggestTitleSchema>;
export type AISuggestTagsInput = z.infer<typeof aiSuggestTagsSchema>;
export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type ListTasksQuery = z.infer<typeof listTasksQuerySchema>;
export type ImportTasksInput = z.infer<typeof importTasksSchema>;
export type RenameTagInput = z.infer<typeof renameTagSchema>;
export type TagSearchQuery = z.infer<typeof tagSearchQuerySchema>;
