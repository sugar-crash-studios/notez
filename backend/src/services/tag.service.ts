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

  return tags.map((tag) => ({
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
 */
export async function renameTag(tagId: string, userId: string, newName: string) {
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

  // Check if another tag with the same name already exists
  const existingTag = await prisma.tag.findUnique({
    where: {
      userId_name: {
        userId,
        name: newName,
      },
    },
  });

  if (existingTag && existingTag.id !== tagId) {
    throw new Error('A tag with this name already exists');
  }

  // Rename the tag
  const updatedTag = await prisma.tag.update({
    where: { id: tagId },
    data: { name: newName },
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
