import { prisma } from '../lib/db.js';
import type { CreateNoteInput, UpdateNoteInput } from '../utils/validation.schemas.js';

/**
 * Get note by ID
 * Only returns the note if it belongs to the requesting user
 */
export async function getNoteById(noteId: string, userId: string) {
  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      userId,
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!note) {
    throw new Error('Note not found');
  }

  // Transform tags to simpler format
  return {
    ...note,
    tags: note.tags.map((nt) => nt.tag),
  };
}

/**
 * List all notes for a user
 * Supports filtering by folder and search
 */
export async function listNotes(
  userId: string,
  options?: {
    folderId?: string | null;
    search?: string;
    limit?: number;
    offset?: number;
  }
) {
  const { folderId, search, limit = 50, offset = 0 } = options || {};

  // Build where clause
  const where: any = { userId };

  // Filter by folder (null means unfiled notes)
  if (folderId !== undefined) {
    where.folderId = folderId;
  }

  // Search in title and content
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [notes, total] = await Promise.all([
    prisma.note.findMany({
      where,
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        tags: {
          include: {
            tag: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: limit,
      skip: offset,
    }),
    prisma.note.count({ where }),
  ]);

  // Transform tags to simpler format
  const transformedNotes = notes.map((note) => ({
    ...note,
    tags: note.tags.map((nt) => nt.tag),
  }));

  return {
    notes: transformedNotes,
    total,
    limit,
    offset,
  };
}

/**
 * Create a new note
 */
export async function createNote(userId: string, data: CreateNoteInput) {
  // If folderId is provided, verify it belongs to the user
  if (data.folderId) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: data.folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }
  }

  // Handle tags if provided
  let tagConnections: any[] = [];
  if (data.tags && data.tags.length > 0) {
    // Find or create tags
    const tagPromises = data.tags.map(async (tagName) => {
      // Try to find existing tag
      let tag = await prisma.tag.findFirst({
        where: {
          name: tagName,
          userId,
        },
      });

      // Create tag if it doesn't exist
      if (!tag) {
        tag = await prisma.tag.create({
          data: {
            name: tagName,
            userId,
          },
        });
      }

      return tag;
    });

    const tags = await Promise.all(tagPromises);
    tagConnections = tags.map((tag) => ({
      tag: { connect: { id: tag.id } },
    }));
  }

  // Create note with tags
  const note = await prisma.note.create({
    data: {
      title: data.title,
      content: data.content || null,
      userId,
      folderId: data.folderId || null,
      tags: {
        create: tagConnections,
      },
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  // Transform tags to simpler format
  return {
    ...note,
    tags: note.tags.map((nt) => nt.tag),
  };
}

/**
 * Update a note
 */
export async function updateNote(noteId: string, userId: string, data: UpdateNoteInput) {
  // Verify note exists and belongs to user
  const existingNote = await prisma.note.findFirst({
    where: {
      id: noteId,
      userId,
    },
  });

  if (!existingNote) {
    throw new Error('Note not found');
  }

  // If folderId is being updated, verify it belongs to the user
  if (data.folderId !== undefined && data.folderId !== null) {
    const folder = await prisma.folder.findFirst({
      where: {
        id: data.folderId,
        userId,
      },
    });

    if (!folder) {
      throw new Error('Folder not found');
    }
  }

  // Handle tags if provided
  if (data.tags !== undefined) {
    // Remove existing tag associations
    await prisma.noteTag.deleteMany({
      where: { noteId },
    });

    // Add new tags
    if (data.tags.length > 0) {
      const tagPromises = data.tags.map(async (tagName) => {
        // Find or create tag
        let tag = await prisma.tag.findFirst({
          where: {
            name: tagName,
            userId,
          },
        });

        if (!tag) {
          tag = await prisma.tag.create({
            data: {
              name: tagName,
              userId,
            },
          });
        }

        // Create note-tag association
        await prisma.noteTag.create({
          data: {
            noteId,
            tagId: tag.id,
          },
        });

        return tag;
      });

      await Promise.all(tagPromises);
    }
  }

  // Update note
  const note = await prisma.note.update({
    where: { id: noteId },
    data: {
      title: data.title,
      content: data.content,
      folderId: data.folderId,
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
      tags: {
        include: {
          tag: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  // Transform tags to simpler format
  return {
    ...note,
    tags: note.tags.map((nt) => nt.tag),
  };
}

/**
 * Delete a note
 */
export async function deleteNote(noteId: string, userId: string) {
  // Verify note exists and belongs to user
  const note = await prisma.note.findFirst({
    where: {
      id: noteId,
      userId,
    },
  });

  if (!note) {
    throw new Error('Note not found');
  }

  // Delete note (tags will be cascade deleted via NoteTag relation)
  await prisma.note.delete({
    where: { id: noteId },
  });

  return { success: true };
}

/**
 * Get note statistics for a user
 */
export async function getNoteStats(userId: string) {
  const [totalNotes, unfiledNotes, foldersWithNotes] = await Promise.all([
    prisma.note.count({ where: { userId } }),
    prisma.note.count({ where: { userId, folderId: null } }),
    prisma.folder.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        _count: {
          select: { notes: true },
        },
      },
      orderBy: {
        name: 'asc',
      },
    }),
  ]);

  return {
    totalNotes,
    unfiledNotes,
    folders: foldersWithNotes,
  };
}
