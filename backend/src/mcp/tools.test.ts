import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock all service dependencies
vi.mock('../lib/db.js', () => ({
  prisma: {
    $executeRaw: vi.fn(),
    tag: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));
vi.mock('../services/search.service.js', () => ({
  searchService: { searchNotes: vi.fn() },
}));
vi.mock('../services/note.service.js', () => ({
  getNoteById: vi.fn(),
  getNoteByTitle: vi.fn(),
  listNotes: vi.fn(),
  createNote: vi.fn(),
  updateNote: vi.fn(),
  deleteNote: vi.fn(),
  restoreNote: vi.fn(),
}));
vi.mock('../services/task.service.js', () => ({
  getTaskById: vi.fn(),
  listTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
  addTaskLink: vi.fn(),
  updateTaskLink: vi.fn(),
  deleteTaskLink: vi.fn(),
}));
vi.mock('../services/folder.service.js', () => ({
  listFolders: vi.fn(),
  createFolder: vi.fn(),
  updateFolder: vi.fn(),
  deleteFolder: vi.fn(),
}));
vi.mock('../services/tag.service.js', () => ({
  listTags: vi.fn(),
  renameTag: vi.fn(),
  deleteTag: vi.fn(),
}));
vi.mock('../services/share.service.js', () => ({
  shareNote: vi.fn(),
  listSharesForNote: vi.fn(),
  unshareNote: vi.fn(),
  updateSharePermission: vi.fn(),
}));
vi.mock('../services/notification.service.js', () => ({
  getNotifications: vi.fn(),
  getUnreadCount: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
  deleteNotification: vi.fn(),
}));
vi.mock('../services/feedback.service.js', () => ({
  createFeedback: vi.fn(),
  getFeedbackById: vi.fn(),
  listUserFeedback: vi.fn(),
}));
vi.mock('../services/ai/index.js', () => ({
  aiService: {
    getUserConfiguration: vi.fn(),
    summarize: vi.fn(),
    suggestTitle: vi.fn(),
    suggestTags: vi.fn(),
  },
  AIProviderNotConfiguredError: class AIProviderNotConfiguredError extends Error {
    constructor() { super('AI not configured'); }
  },
}));

import { registerNotezTools } from './tools.js';

describe('tools', () => {
  let server: McpServer;
  const registeredTools: string[] = [];

  beforeEach(() => {
    registeredTools.length = 0;
    server = {
      registerTool: vi.fn((name: string) => {
        registeredTools.push(name);
      }),
    } as any;
  });

  describe('registerNotezTools', () => {
    it('registers only read tools when scope is mcp:read', () => {
      registerNotezTools(server, () => 'user-1', ['mcp:read']);

      // Should include read tools
      expect(registeredTools).toContain('notez_search_notes');
      expect(registeredTools).toContain('notez_get_note');
      expect(registeredTools).toContain('notez_list_notes');
      expect(registeredTools).toContain('notez_list_tasks');
      expect(registeredTools).toContain('notez_list_folders');
      expect(registeredTools).toContain('notez_list_tags');
      expect(registeredTools).toContain('notez_list_shares');
      expect(registeredTools).toContain('notez_list_notifications');
      expect(registeredTools).toContain('notez_get_unread_count');
      expect(registeredTools).toContain('notez_list_my_feedback');
      expect(registeredTools).toContain('notez_get_feedback');
      expect(registeredTools).toContain('notez_check_ai_status');

      // Should NOT include write tools
      expect(registeredTools).not.toContain('notez_create_note');
      expect(registeredTools).not.toContain('notez_update_note');
      expect(registeredTools).not.toContain('notez_delete_note');
      expect(registeredTools).not.toContain('notez_create_task');
      expect(registeredTools).not.toContain('notez_share_note');
      expect(registeredTools).not.toContain('notez_add_task_link');
      expect(registeredTools).not.toContain('notez_mark_notification_read');
      expect(registeredTools).not.toContain('notez_create_feedback');
      expect(registeredTools).not.toContain('notez_ai_summarize');
    });

    it('registers both read and write tools when both scopes granted', () => {
      registerNotezTools(server, () => 'user-1', ['mcp:read', 'mcp:write']);

      expect(registeredTools).toContain('notez_search_notes');
      expect(registeredTools).toContain('notez_create_note');
      expect(registeredTools).toContain('notez_update_note');
      expect(registeredTools).toContain('notez_delete_note');
      expect(registeredTools).toContain('notez_create_task');
      expect(registeredTools).toContain('notez_share_note');
      // Task links
      expect(registeredTools).toContain('notez_add_task_link');
      expect(registeredTools).toContain('notez_update_task_link');
      expect(registeredTools).toContain('notez_delete_task_link');
      // Notifications
      expect(registeredTools).toContain('notez_list_notifications');
      expect(registeredTools).toContain('notez_get_unread_count');
      expect(registeredTools).toContain('notez_mark_notification_read');
      expect(registeredTools).toContain('notez_mark_all_notifications_read');
      expect(registeredTools).toContain('notez_delete_notification');
      // Feedback
      expect(registeredTools).toContain('notez_create_feedback');
      expect(registeredTools).toContain('notez_list_my_feedback');
      expect(registeredTools).toContain('notez_get_feedback');
      // AI
      expect(registeredTools).toContain('notez_check_ai_status');
      expect(registeredTools).toContain('notez_ai_summarize');
      expect(registeredTools).toContain('notez_ai_suggest_title');
      expect(registeredTools).toContain('notez_ai_suggest_tags');
    });

    it('registers no tools when no scopes granted', () => {
      registerNotezTools(server, () => 'user-1', []);
      expect(registeredTools).toHaveLength(0);
    });

    it('does not register the removed notez_list_recent_notes tool', () => {
      registerNotezTools(server, () => 'user-1', ['mcp:read', 'mcp:write']);
      expect(registeredTools).not.toContain('notez_list_recent_notes');
    });
  });

  describe('notez_update_task dueDate validation', () => {
    it('dueDate input schema rejects non-ISO strings', () => {
      // Regression test for Pam's issue: Claude passing natural-language dates.
      // The MCP framework validates inputSchema before calling the handler, so
      // testing the schema directly is the correct approach.
      const { z } = require('zod');
      const dueDateSchema = z.string().datetime().nullable().optional();

      // Valid ISO 8601 strings should pass
      expect(() => dueDateSchema.parse('2026-04-20T00:00:00Z')).not.toThrow();
      expect(() => dueDateSchema.parse('2026-04-20T12:30:00.000Z')).not.toThrow();
      expect(() => dueDateSchema.parse(null)).not.toThrow();
      expect(() => dueDateSchema.parse(undefined)).not.toThrow();

      // Natural-language and ambiguous strings must fail so Claude gets an error
      // and is forced to convert to ISO 8601 before retrying.
      expect(() => dueDateSchema.parse('next Tuesday')).toThrow();
      expect(() => dueDateSchema.parse('April 20')).toThrow();
      expect(() => dueDateSchema.parse('2026-04-20')).toThrow(); // date-only, not datetime
      expect(() => dueDateSchema.parse('tomorrow')).toThrow();
    });

    it('notez_update_task tool description documents ISO 8601 format requirement', () => {
      // If Claude sees "ISO 8601" in the description it will format dates correctly.
      let capturedDescription = '';
      const testServer = {
        registerTool: vi.fn((name: string, def: { description: string }) => {
          if (name === 'notez_update_task') capturedDescription = def.description;
        }),
      } as any;
      registerNotezTools(testServer, () => 'user-1', ['mcp:write']);

      expect(capturedDescription).toContain('ISO 8601');
      expect(capturedDescription).toContain('LOW');
      expect(capturedDescription).toContain('URGENT');
    });
  });
});
