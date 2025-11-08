import { prisma } from '../lib/db.js';

/**
 * List all tags for a user
 * Returns tags with note counts
 */
export async function listTags(userId: string) {
  const tags = await prisma.tag.findMany({
    where: { userId },
    include: {
      _count: {
        select: { notes: true },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  return tags.map((tag: any) => ({
    id: tag.id,
    name: tag.name,
    noteCount: tag._count.notes,
    createdAt: tag.createdAt,
  }));
}

/**
 * Get a single tag by ID with note count
 */
export async function getTagById(tagId: string, userId: string) {
  const tag = await prisma.tag.findFirst({
    where: {
      id: tagId,
      userId,
    },
    include: {
      _count: {
        select: { notes: true },
      },
    },
  });

  if (!tag) {
    throw new Error('Tag not found');
  }

  return {
    id: tag.id,
    name: tag.name,
    noteCount: tag._count.notes,
    createdAt: tag.createdAt,
  };
}

/**
 * Rename a tag
 * Uses database unique constraint to prevent duplicates atomically
 */
export async function renameTag(tagId: string, userId: string, newName: string) {
  // Trim the new name to prevent whitespace issues
  const trimmedName = newName.trim();

  if (trimmedName.length === 0) {
    throw new Error('Tag name cannot be empty');
  }

  // Check if tag exists and belongs to user
  const tag = await prisma.tag.findFirst({
    where: {
      id: tagId,
      userId,
    },
  });

  if (!tag) {
    throw new Error('Tag not found');
  }

  try {
    // Rename the tag - let database constraint handle duplicate check atomically
    const updatedTag = await prisma.tag.update({
      where: { id: tagId },
      data: { name: trimmedName },
      include: {
        _count: {
          select: { notes: true },
        },
      },
    });

    return {
      id: updatedTag.id,
      name: updatedTag.name,
      noteCount: updatedTag._count.notes,
      createdAt: updatedTag.createdAt,
    };
  } catch (error: any) {
    // Handle unique constraint violation
    // Prisma returns target as an array like ['userId', 'name']
    const target = error.meta?.target;
    if (error.code === 'P2002' && Array.isArray(target) && target.includes('userId') && target.includes('name')) {
      throw new Error('A tag with this name already exists');
    }
    // Re-throw other errors
    throw error;
  }
}

/**
 * Delete a tag
 * This will remove the tag from all notes
 */
export async function deleteTag(tagId: string, userId: string) {
  // Check if tag exists and belongs to user
  const tag = await prisma.tag.findFirst({
    where: {
      id: tagId,
      userId,
    },
  });

  if (!tag) {
    throw new Error('Tag not found');
  }

  // Delete tag (cascade will remove NoteTag associations)
  await prisma.tag.delete({
    where: { id: tagId },
  });

  return { success: true };
}

/**
 * Get tag statistics for a user
 */
export async function getTagStats(userId: string) {
  const [totalTags, unusedTags] = await Promise.all([
    prisma.tag.count({ where: { userId } }),
    prisma.tag.count({
      where: {
        userId,
        notes: {
          none: {},
        },
      },
    }),
  ]);

  return {
    totalTags,
    unusedTags,
    usedTags: totalTags - unusedTags,
  };
}

/**
 * Search/autocomplete tags by name
 */
export async function searchTags(userId: string, query: string, limit: number = 10) {
  const tags = await prisma.tag.findMany({
    where: {
      userId,
      name: {
        contains: query,
        mode: 'insensitive',
      },
    },
    select: {
      id: true,
      name: true,
    },
    orderBy: {
      name: 'asc',
    },
    take: limit,
  });

  return tags;
}
