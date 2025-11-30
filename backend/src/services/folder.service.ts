import { prisma } from '../lib/db.js';
import type { CreateFolderInput, UpdateFolderInput } from '../utils/validation.schemas.js';
import { NotFoundError, ConflictError } from '../utils/errors.js';

/**
 * Get folder by ID
 * Only returns the folder if it belongs to the requesting user
 */
export async function getFolderById(folderId: string, userId: string) {
  const folder = await prisma.folder.findFirst({
    where: {
      id: folderId,
      userId,
    },
    include: {
      _count: {
        select: { notes: true },
      },
    },
  });

  if (!folder) {
    throw new NotFoundError('Folder not found');
  }

  return {
    ...folder,
    noteCount: folder._count.notes,
    _count: undefined,
  };
}

/**
 * List all folders for a user
 * Returns folders with note counts, sorted by name
 */
export async function listFolders(userId: string) {
  const folders = await prisma.folder.findMany({
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

  return folders.map((folder: any) => ({
    ...folder,
    noteCount: folder._count.notes,
    _count: undefined,
  }));
}

/**
 * Create a new folder
 */
export async function createFolder(userId: string, data: CreateFolderInput) {
  return prisma.$transaction(async (tx: any) => {
    // Check if folder with same name already exists for this user
    const existing = await tx.folder.findFirst({
      where: {
        userId,
        name: data.name,
      },
    });

    if (existing) {
      throw new ConflictError('A folder with this name already exists');
    }

    // Create folder
    const folder = await tx.folder.create({
      data: {
        name: data.name,
        icon: data.icon || 'folder',
        userId,
      },
      include: {
        _count: {
          select: { notes: true },
        },
      },
    });

    return {
      ...folder,
      noteCount: folder._count.notes,
      _count: undefined,
    };
  });
}

/**
 * Update a folder (rename)
 */
export async function updateFolder(folderId: string, userId: string, data: UpdateFolderInput) {
  return prisma.$transaction(async (tx: any) => {
    // Verify folder exists and belongs to user
    const existingFolder = await tx.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
    });

    if (!existingFolder) {
      throw new NotFoundError('Folder not found');
    }

    // If name is being changed, check for duplicates
    if (data.name && data.name !== existingFolder.name) {
      const duplicate = await tx.folder.findFirst({
        where: {
          userId,
          name: data.name,
          id: { not: folderId },
        },
      });

      if (duplicate) {
        throw new ConflictError('A folder with this name already exists');
      }
    }

    // Update folder
    const folder = await tx.folder.update({
      where: { id: folderId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.icon && { icon: data.icon }),
      },
      include: {
        _count: {
          select: { notes: true },
        },
      },
    });

    return {
      ...folder,
      noteCount: folder._count.notes,
      _count: undefined,
    };
  });
}

/**
 * Delete a folder
 * Notes in the folder will become unfiled (folderId set to null) due to onDelete: SetNull
 */
export async function deleteFolder(folderId: string, userId: string) {
  return prisma.$transaction(async (tx: any) => {
    // Verify folder exists and belongs to user
    const folder = await tx.folder.findFirst({
      where: {
        id: folderId,
        userId,
      },
      include: {
        _count: {
          select: { notes: true },
        },
      },
    });

    if (!folder) {
      throw new NotFoundError('Folder not found');
    }

    const noteCount = folder._count.notes;

    // Delete folder (notes will be set to null automatically)
    await tx.folder.delete({
      where: { id: folderId },
    });

    return {
      success: true,
      message: noteCount > 0
        ? `Folder deleted. ${noteCount} note(s) moved to unfiled.`
        : 'Folder deleted.',
      noteCount,
    };
  });
}

/**
 * Get folder statistics for a user
 */
export async function getFolderStats(userId: string) {
  const foldersWithCounts = await prisma.folder.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      icon: true,
      _count: {
        select: { notes: true },
      },
    },
    orderBy: {
      name: 'asc',
    },
  });

  const totalFolders = foldersWithCounts.length;
  const emptyFolders = foldersWithCounts.filter((f: any) => f._count.notes === 0).length;
  const totalNotes = foldersWithCounts.reduce((sum: any, f: any) => sum + f._count.notes, 0);

  return {
    totalFolders,
    emptyFolders,
    totalNotes,
    folders: foldersWithCounts.map((f: any) => ({
      id: f.id,
      name: f.name,
      icon: f.icon,
      noteCount: f._count.notes,
    })),
  };
}
