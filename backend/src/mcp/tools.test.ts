import { describe, it, expect, vi, beforeEach } from 'vitest';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Mock all service dependencies
vi.mock('../lib/db.js', () => ({
  prisma: { $executeRaw: vi.fn() },
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

      // Should NOT include write tools
      expect(registeredTools).not.toContain('notez_create_note');
      expect(registeredTools).not.toContain('notez_update_note');
      expect(registeredTools).not.toContain('notez_delete_note');
      expect(registeredTools).not.toContain('notez_create_task');
      expect(registeredTools).not.toContain('notez_share_note');
    });

    it('registers both read and write tools when both scopes granted', () => {
      registerNotezTools(server, () => 'user-1', ['mcp:read', 'mcp:write']);

      expect(registeredTools).toContain('notez_search_notes');
      expect(registeredTools).toContain('notez_create_note');
      expect(registeredTools).toContain('notez_update_note');
      expect(registeredTools).toContain('notez_delete_note');
      expect(registeredTools).toContain('notez_create_task');
      expect(registeredTools).toContain('notez_share_note');
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
});
