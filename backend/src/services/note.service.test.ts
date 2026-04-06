import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma
vi.mock('../lib/db.js', () => ({
  prisma: {
    note: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    noteShare: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    folder: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      count: vi.fn(),
    },
    tag: {
      upsert: vi.fn(),
      count: vi.fn(),
    },
    noteTag: {
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}));

// Mock share service
vi.mock('./share.service.js', () => ({
  checkNoteAccess: vi.fn(),
  isNoteShared: vi.fn(),
}));

// Mock notelink service
vi.mock('./notelink.service.js', () => ({
  syncNoteLinks: vi.fn().mockResolvedValue(undefined),
}));

import {
  getNoteById,
  listNotes,
  deleteNote,
  restoreNote,
  permanentlyDeleteNote,
  listDeletedNotes,
  getNoteStats,
} from './note.service.js';
import { prisma } from '../lib/db.js';
import { checkNoteAccess, isNoteShared } from './share.service.js';

const mockPrisma = vi.mocked(prisma);
const mockCheckAccess = vi.mocked(checkNoteAccess);
const mockIsShared = vi.mocked(isNoteShared);

describe('note.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getNoteById ──────────────────────────────────────────────────────
  describe('getNoteById', () => {
    it('should throw if user has no access', async () => {
      mockCheckAccess.mockResolvedValue({ hasAccess: false, permission: null });

      await expect(getNoteById('note-1', 'user-1')).rejects.toThrow(
        'Note not found'
      );
    });

    it('should return note with owner permission', async () => {
      mockCheckAccess.mockResolvedValue({
        hasAccess: true,
        permission: 'OWNER',
      });
      mockPrisma.note.findUnique.mockResolvedValue({
        id: 'note-1',
        title: 'Test Note',
        userId: 'user-1',
        user: { id: 'user-1', username: 'alice' },
        folder: { id: 'folder-1', name: 'Work' },
        tags: [{ tag: { id: 'tag-1', name: 'js' } }],
      } as any);
      mockIsShared.mockResolvedValue(false);

      const result = await getNoteById('note-1', 'user-1');

      expect(result.title).toBe('Test Note');
      expect(result.permission).toBe('OWNER');
      expect(result.isShared).toBe(false);
      expect(result.tags).toEqual([{ id: 'tag-1', name: 'js' }]);
      expect(result.owner).toEqual({ id: 'user-1', username: 'alice' });
    });

    it('should return note with EDIT permission for shared user', async () => {
      mockCheckAccess.mockResolvedValue({
        hasAccess: true,
        permission: 'EDIT',
      });
      mockPrisma.note.findUnique.mockResolvedValue({
        id: 'note-1',
        title: 'Shared Note',
        userId: 'owner-1',
        user: { id: 'owner-1', username: 'owner' },
        folder: null,
        tags: [],
      } as any);
      mockIsShared.mockResolvedValue(true);

      const result = await getNoteById('note-1', 'user-2');

      expect(result.permission).toBe('EDIT');
      expect(result.isShared).toBe(true);
    });

    it('should throw if note not found in database (deleted)', async () => {
      mockCheckAccess.mockResolvedValue({
        hasAccess: true,
        permission: 'OWNER',
      });
      mockPrisma.note.findUnique.mockResolvedValue(null);

      await expect(getNoteById('deleted-note', 'user-1')).rejects.toThrow(
        'Note not found'
      );
    });
  });

  // ─── listNotes ────────────────────────────────────────────────────────
  describe('listNotes', () => {
    it('should return paginated notes with defaults', async () => {
      mockPrisma.note.findMany.mockResolvedValue([
        {
          id: 'note-1',
          title: 'Note 1',
          tags: [{ tag: { id: 'tag-1', name: 'js' } }],
          shares: [],
        },
      ] as any);
      mockPrisma.note.count.mockResolvedValue(1);

      const result = await listNotes('user-1');

      expect(result.notes).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.limit).toBe(50);
      expect(result.offset).toBe(0);
      // Tags should be flattened
      expect(result.notes[0].tags).toEqual([{ id: 'tag-1', name: 'js' }]);
    });

    it('should add isShared flag based on shares array', async () => {
      mockPrisma.note.findMany.mockResolvedValue([
        {
          id: 'note-1',
          title: 'Shared',
          tags: [],
          shares: [{ id: 'share-1' }],
        },
        {
          id: 'note-2',
          title: 'Not shared',
          tags: [],
          shares: [],
        },
      ] as any);
      mockPrisma.note.count.mockResolvedValue(2);

      const result = await listNotes('user-1');

      expect(result.notes[0].isShared).toBe(true);
      expect(result.notes[1].isShared).toBe(false);
      // shares array should be stripped from response
      expect((result.notes[0] as any).shares).toBeUndefined();
    });

    it('should respect pagination parameters', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(25);

      const result = await listNotes('user-1', { limit: 10, offset: 20 });

      expect(result.limit).toBe(10);
      expect(result.offset).toBe(20);
      expect(result.total).toBe(25);
      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 10, skip: 20 })
      );
    });

    it('should filter by folderId', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await listNotes('user-1', { folderId: 'folder-1' });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ folderId: 'folder-1' }),
        })
      );
    });

    it('should filter by null folderId (unfiled notes)', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await listNotes('user-1', { folderId: null });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ folderId: null }),
        })
      );
    });

    it('should filter by tagId', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await listNotes('user-1', { tagId: 'tag-1' });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            tags: { some: { tagId: 'tag-1' } },
          }),
        })
      );
    });

    it('should search in title and content', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await listNotes('user-1', { search: 'hello' });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            AND: [
              {
                OR: [
                  { title: { contains: 'hello', mode: 'insensitive' } },
                  { content: { contains: 'hello', mode: 'insensitive' } },
                ],
              },
            ],
          }),
        })
      );
    });

    it('should always exclude deleted notes', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await listNotes('user-1');

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ deleted: false }),
        })
      );
    });

    it('should filter by createdByTokenId', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await listNotes('user-1', { createdByTokenId: 'token-abc' });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdByTokenId: 'token-abc',
          }),
        })
      );
    });

    it('should filter agentCreated=true via relation', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await listNotes('user-1', { agentCreated: true });

      expect(mockPrisma.note.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdByToken: { isAgent: true },
          }),
        })
      );
    });

    it('should filter agentCreated=false using AND to avoid clobbering search', async () => {
      mockPrisma.note.findMany.mockResolvedValue([]);
      mockPrisma.note.count.mockResolvedValue(0);

      await listNotes('user-1', { agentCreated: false, search: 'hello' });

      const call = mockPrisma.note.findMany.mock.calls[0][0];
      // Both filters should be in AND array, not clobbering each other
      expect(call.where.AND).toBeDefined();
      expect(call.where.AND).toHaveLength(2);
      // One AND entry is the agentCreated=false OR
      expect(call.where.AND).toEqual(
        expect.arrayContaining([
          {
            OR: [
              { createdByTokenId: null },
              { createdByToken: { isAgent: false } },
            ],
          },
          {
            OR: [
              { title: { contains: 'hello', mode: 'insensitive' } },
              { content: { contains: 'hello', mode: 'insensitive' } },
            ],
          },
        ])
      );
    });
  });

  // ─── deleteNote (soft delete) ─────────────────────────────────────────
  describe('deleteNote', () => {
    it('should throw if note not found or not owned', async () => {
      mockPrisma.note.findFirst.mockResolvedValue(null);

      await expect(deleteNote('note-1', 'user-1')).rejects.toThrow(
        'Note not found'
      );
    });

    it('should soft-delete by setting deleted flag', async () => {
      mockPrisma.note.findFirst.mockResolvedValue({
        id: 'note-1',
        userId: 'user-1',
      } as any);
      mockPrisma.note.update.mockResolvedValue({} as any);

      const result = await deleteNote('note-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.note.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: {
          deleted: true,
          deletedAt: expect.any(Date),
        },
      });
    });
  });

  // ─── restoreNote ──────────────────────────────────────────────────────
  describe('restoreNote', () => {
    it('should throw if note not found in trash', async () => {
      mockPrisma.note.findFirst.mockResolvedValue(null);

      await expect(restoreNote('note-1', 'user-1')).rejects.toThrow(
        'Note not found in trash'
      );
    });

    it('should restore note by clearing deleted flag', async () => {
      mockPrisma.note.findFirst.mockResolvedValue({
        id: 'note-1',
        userId: 'user-1',
        deleted: true,
      } as any);
      mockPrisma.note.update.mockResolvedValue({} as any);

      const result = await restoreNote('note-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.note.update).toHaveBeenCalledWith({
        where: { id: 'note-1' },
        data: { deleted: false, deletedAt: null },
      });
    });
  });

  // ─── permanentlyDeleteNote ────────────────────────────────────────────
  describe('permanentlyDeleteNote', () => {
    it('should throw if note not found', async () => {
      mockPrisma.note.findFirst.mockResolvedValue(null);

      await expect(
        permanentlyDeleteNote('note-1', 'user-1')
      ).rejects.toThrow('Note not found');
    });

    it('should permanently delete the note', async () => {
      mockPrisma.note.findFirst.mockResolvedValue({
        id: 'note-1',
        userId: 'user-1',
      } as any);
      mockPrisma.note.delete.mockResolvedValue({} as any);

      const result = await permanentlyDeleteNote('note-1', 'user-1');

      expect(result).toEqual({ success: true });
      expect(mockPrisma.note.delete).toHaveBeenCalledWith({
        where: { id: 'note-1' },
      });
    });
  });

  // ─── listDeletedNotes ─────────────────────────────────────────────────
  describe('listDeletedNotes', () => {
    it('should return deleted notes for user', async () => {
      mockPrisma.note.findMany.mockResolvedValue([
        {
          id: 'note-1',
          title: 'Trashed',
          deleted: true,
          tags: [{ tag: { id: 'tag-1', name: 'old' } }],
        },
      ] as any);
      mockPrisma.note.count.mockResolvedValue(1);

      const result = await listDeletedNotes('user-1');

      expect(result.notes).toHaveLength(1);
      expect(result.notes[0].tags).toEqual([{ id: 'tag-1', name: 'old' }]);
      expect(result.total).toBe(1);
    });
  });

  // ─── getNoteStats ─────────────────────────────────────────────────────
  describe('getNoteStats', () => {
    it('should return all stats', async () => {
      mockPrisma.$transaction.mockResolvedValue([
        10, // totalNotes
        3, // unfiledNotes
        2, // deletedNotes
        [
          { id: 'f1', name: 'Work', _count: { notes: 5 } },
          { id: 'f2', name: 'Personal', _count: { notes: 2 } },
        ], // folders
        4, // sharedByMeCount
        1, // sharedWithMeCount
      ]);

      const stats = await getNoteStats('user-1');

      expect(stats.totalNotes).toBe(10);
      expect(stats.unfiledNotes).toBe(3);
      expect(stats.deletedNotes).toBe(2);
      expect(stats.folders).toHaveLength(2);
      expect(stats.sharedByMeCount).toBe(4);
      expect(stats.sharedWithMeCount).toBe(1);
    });
  });
});
