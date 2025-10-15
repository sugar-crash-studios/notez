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
  return prisma.$transaction(async (tx) => {
    // If folderId is provided, verify it belongs to the user
    if (data.folderId) {
      const folder = await tx.folder.findFirst({
        where: {
          id: data.folderId,
          userId,
        },
      });

      if (!folder) {
        throw new Error('Folder not found');
      }
    }

    // Handle tags if provided - use upsert to prevent race conditions
    let tagConnections: any[] = [];
    if (data.tags && data.tags.length > 0) {
      const tagUpserts = data.tags.map((tagName) =>
        tx.tag.upsert({
          where: { userId_name: { userId, name: tagName } },
          update: {},
          create: { name: tagName, userId },
        })
      );

      const tags = await Promise.all(tagUpserts);
      tagConnections = tags.map((tag) => ({
        tag: { connect: { id: tag.id } },
      }));
    }

    // Create note with tags
    const note = await tx.note.create({
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
  });
}

/**
 * Update a note
 */
export async function updateNote(noteId: string, userId: string, data: UpdateNoteInput) {
  return prisma.$transaction(async (tx) => {
    // Verify note exists and belongs to user
    const existingNote = await tx.note.findFirst({
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
      const folder = await tx.folder.findFirst({
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
      await tx.noteTag.deleteMany({
        where: { noteId },
      });

      // Add new tags using upsert to prevent race conditions
      if (data.tags.length > 0) {
        const tagUpserts = data.tags.map((tagName) =>
          tx.tag.upsert({
            where: { userId_name: { userId, name: tagName } },
            update: {},
            create: { name: tagName, userId },
          })
        );
        const tags = await Promise.all(tagUpserts);

        // Create note-tag associations
        await tx.noteTag.createMany({
          data: tags.map((tag) => ({
            noteId,
            tagId: tag.id,
          })),
        });
      }
    }

    // Update note
    const note = await tx.note.update({
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
  });
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
