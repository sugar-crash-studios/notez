import { prisma } from '../lib/db.js';
import type { CreateTaskInput, UpdateTaskInput } from '../utils/validation.schemas.js';

/**
 * Build orderBy array for task queries based on sort options
 */
function buildTaskOrderBy(sortBy: string, sortOrder: 'asc' | 'desc'): any[] {
  const orderBy: any[] = [];

  // Primary sort based on user selection
  switch (sortBy) {
    case 'priority':
      // Priority: URGENT > HIGH > MEDIUM > LOW (desc = urgent first)
      orderBy.push({ priority: sortOrder });
      orderBy.push({ dueDate: 'asc' }); // Secondary: earliest due date
      break;
    case 'dueDate':
      // Due date: nulls last for asc, nulls first for desc
      orderBy.push({ dueDate: { sort: sortOrder, nulls: sortOrder === 'asc' ? 'last' : 'first' } });
      orderBy.push({ priority: 'desc' }); // Secondary: highest priority
      break;
    case 'createdAt':
      orderBy.push({ createdAt: sortOrder });
      break;
    case 'title':
      orderBy.push({ title: sortOrder });
      break;
    default:
      // Default: priority desc, then due date asc
      orderBy.push({ priority: 'desc' });
      orderBy.push({ dueDate: 'asc' });
  }

  // Always add createdAt as final tiebreaker
  if (sortBy !== 'createdAt') {
    orderBy.push({ createdAt: 'desc' });
  }

  return orderBy;
}

/**
 * Get task by ID
 * Only returns the task if it belongs to the requesting user
 */
export async function getTaskById(taskId: string, userId: string) {
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
    include: {
      folder: {
        select: {
          id: true,
          name: true,
        },
      },
      note: {
        select: {
          id: true,
          title: true,
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
      links: {
        select: {
          id: true,
          url: true,
          title: true,
          createdAt: true,
        },
        orderBy: {
          createdAt: 'asc',
        },
      },
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Transform tags to simpler format
  return {
    ...task,
    tags: task.tags.map((tt: any) => tt.tag),
  };
}

/**
 * List all tasks for a user
 * Supports filtering by status, priority, folder, note, tag, and due date
 */
export async function listTasks(
  userId: string,
  options?: {
    status?: string | string[];
    priority?: string;
    folderId?: string;
    noteId?: string;
    tagId?: string;
    overdue?: boolean;
    sortBy?: 'priority' | 'dueDate' | 'createdAt' | 'title';
    sortOrder?: 'asc' | 'desc';
    limit?: number;
    offset?: number;
  }
) {
  const { status, priority, folderId, noteId, tagId, overdue, sortBy = 'priority', sortOrder = 'desc', limit = 50, offset = 0 } = options || {};

  // Build where clause
  const where: any = { userId };

  // Filter by status (can be single or array)
  if (status) {
    if (Array.isArray(status)) {
      where.status = { in: status };
    } else {
      where.status = status;
    }
  }

  // Filter by priority
  if (priority) {
    where.priority = priority;
  }

  // Filter by folder
  if (folderId !== undefined) {
    where.folderId = folderId;
  }

  // Filter by note
  if (noteId !== undefined) {
    where.noteId = noteId;
  }

  // Filter by tag
  if (tagId) {
    where.tags = {
      some: {
        tagId,
      },
    };
  }

  // Filter by overdue tasks
  if (overdue) {
    where.dueDate = {
      lt: new Date(),
    };
    where.status = {
      notIn: ['COMPLETED', 'CANCELLED'],
    };
  }

  const [tasks, total] = await Promise.all([
    prisma.task.findMany({
      where,
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        note: {
          select: {
            id: true,
            title: true,
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
        links: {
          select: {
            id: true,
            url: true,
            title: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
      orderBy: buildTaskOrderBy(sortBy, sortOrder),
      take: limit,
      skip: offset,
    }),
    prisma.task.count({ where }),
  ]);

  // Transform tags to simpler format
  const transformedTasks = tasks.map((task: any) => ({
    ...task,
    tags: task.tags.map((tt: any) => tt.tag),
  }));

  return {
    tasks: transformedTasks,
    total,
    limit,
    offset,
  };
}

/**
 * Create a new task
 */
export async function createTask(userId: string, data: CreateTaskInput) {
  return prisma.$transaction(async (tx: any) => {
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

    // If noteId is provided, verify it belongs to the user
    let noteTitle: string | undefined;
    if (data.noteId) {
      const note = await tx.note.findFirst({
        where: {
          id: data.noteId,
          userId,
        },
      });

      if (!note) {
        throw new Error('Note not found');
      }

      noteTitle = note.title;
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

    // Prepare links if provided
    let linkConnections: any[] = [];
    if (data.links && data.links.length > 0) {
      linkConnections = data.links.map((link) => ({
        url: link.url,
        title: link.title || null,
      }));
    }

    // Create task with tags and links
    const task = await tx.task.create({
      data: {
        title: data.title,
        description: data.description || null,
        status: data.status || 'PENDING',
        priority: data.priority || 'MEDIUM',
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        userId,
        noteId: data.noteId || null,
        noteTitle: noteTitle || null,
        folderId: data.folderId || null,
        tags: {
          create: tagConnections,
        },
        links: {
          create: linkConnections,
        },
      },
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        note: {
          select: {
            id: true,
            title: true,
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
        links: {
          select: {
            id: true,
            url: true,
            title: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Transform tags to simpler format
    return {
      ...task,
      tags: task.tags.map((tt: any) => tt.tag),
    };
  });
}

/**
 * Update a task
 */
export async function updateTask(taskId: string, userId: string, data: UpdateTaskInput) {
  return prisma.$transaction(async (tx: any) => {
    // Verify task exists and belongs to user
    const existingTask = await tx.task.findFirst({
      where: {
        id: taskId,
        userId,
      },
    });

    if (!existingTask) {
      throw new Error('Task not found');
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

    // If noteId is being updated, verify it belongs to the user
    let noteTitle: string | undefined | null = undefined;
    if (data.noteId !== undefined) {
      if (data.noteId === null) {
        noteTitle = null;
      } else {
        const note = await tx.note.findFirst({
          where: {
            id: data.noteId,
            userId,
          },
        });

        if (!note) {
          throw new Error('Note not found');
        }

        noteTitle = note.title;
      }
    }

    // Handle tags if provided
    if (data.tags !== undefined) {
      // Remove existing tag associations
      await tx.taskTag.deleteMany({
        where: { taskId },
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

        // Create task-tag associations
        await tx.taskTag.createMany({
          data: tags.map((tag) => ({
            taskId,
            tagId: tag.id,
          })),
        });
      }
    }

    // Handle links if provided (replace all)
    if (data.links !== undefined) {
      // Remove existing links
      await tx.taskLink.deleteMany({
        where: { taskId },
      });

      // Add new links
      if (data.links.length > 0) {
        await tx.taskLink.createMany({
          data: data.links.map((link) => ({
            taskId,
            url: link.url,
            title: link.title || null,
          })),
        });
      }
    }

    // Prepare update data
    const updateData: any = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.status !== undefined) {
      updateData.status = data.status;
      // Set completedAt timestamp when marking as completed
      if (data.status === 'COMPLETED') {
        updateData.completedAt = new Date();
      } else if (existingTask.completedAt) {
        // Clear completedAt if task is moved back to non-completed status
        updateData.completedAt = null;
      }
    }
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
    }
    if (data.folderId !== undefined) updateData.folderId = data.folderId;
    if (data.noteId !== undefined) updateData.noteId = data.noteId;
    if (noteTitle !== undefined) updateData.noteTitle = noteTitle;

    // Update task
    const task = await tx.task.update({
      where: { id: taskId },
      data: updateData,
      include: {
        folder: {
          select: {
            id: true,
            name: true,
          },
        },
        note: {
          select: {
            id: true,
            title: true,
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
        links: {
          select: {
            id: true,
            url: true,
            title: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Transform tags to simpler format
    return {
      ...task,
      tags: task.tags.map((tt: any) => tt.tag),
    };
  });
}

/**
 * Quick update task status
 */
export async function updateTaskStatus(taskId: string, userId: string, status: string) {
  // Prepare update data
  const updateData: any = { status };
  if (status === 'COMPLETED') {
    updateData.completedAt = new Date();
  } else {
    // Clear completedAt if task is moved back to non-completed status
    updateData.completedAt = null;
  }

  // Use updateMany for atomic operation that verifies ownership
  const result = await prisma.task.updateMany({
    where: {
      id: taskId,
      userId,
    },
    data: updateData,
  });

  // Check if task was found and updated
  if (result.count === 0) {
    throw new Error('Task not found');
  }

  // Fetch and return the updated task
  const updatedTask = await prisma.task.findUnique({
    where: { id: taskId },
  });

  return updatedTask!;
}

/**
 * Delete a task
 */
export async function deleteTask(taskId: string, userId: string) {
  // Verify task exists and belongs to user
  const task = await prisma.task.findFirst({
    where: {
      id: taskId,
      userId,
    },
  });

  if (!task) {
    throw new Error('Task not found');
  }

  // Permanently delete task (tags will be cascade deleted via TaskTag relation)
  await prisma.task.delete({
    where: { id: taskId },
  });

  return { success: true };
}

/**
 * Get task statistics for a user
 */
export async function getTaskStats(userId: string) {
  const now = new Date();

  const [totalTasks, pendingTasks, inProgressTasks, completedTasks, overdueTasks] =
    await prisma.$transaction([
      prisma.task.count({ where: { userId } }),
      prisma.task.count({ where: { userId, status: 'PENDING' } }),
      prisma.task.count({ where: { userId, status: 'IN_PROGRESS' } }),
      prisma.task.count({ where: { userId, status: 'COMPLETED' } }),
      prisma.task.count({
        where: {
          userId,
          status: { notIn: ['COMPLETED', 'CANCELLED'] },
          dueDate: { lt: now },
        },
      }),
    ]);

  return {
    totalTasks,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    overdueTasks,
  };
}

/**
 * Add a link to a task
 * Uses a transaction to prevent race conditions on link limit
 */
export async function addTaskLink(
  taskId: string,
  userId: string,
  data: { url: string; title?: string }
) {
  return prisma.$transaction(async (tx) => {
    // Verify task exists and belongs to user, with lock for update
    const task = await tx.task.findFirst({
      where: {
        id: taskId,
        userId,
      },
      include: {
        _count: {
          select: { links: true },
        },
      },
    });

    if (!task) {
      throw new Error('Task not found');
    }

    // Check link limit (max 10) within transaction
    if (task._count.links >= 10) {
      throw new Error('Maximum 10 links per task');
    }

    // Create the link within transaction
    const link = await tx.taskLink.create({
      data: {
        taskId,
        url: data.url,
        title: data.title || null,
      },
      select: {
        id: true,
        url: true,
        title: true,
        createdAt: true,
      },
    });

    return link;
  });
}

/**
 * Update a task link
 * Verifies the link belongs to the specified task and user
 */
export async function updateTaskLink(
  taskId: string,
  linkId: string,
  userId: string,
  data: { url?: string; title?: string | null }
) {
  // Verify link exists, belongs to the specified task, and the task belongs to the user
  const link = await prisma.taskLink.findFirst({
    where: {
      id: linkId,
      taskId, // Verify link belongs to the specified task
      task: {
        userId, // Verify task belongs to the user
      },
    },
  });

  if (!link) {
    throw new Error('Link not found');
  }

  // Update the link
  const updateData: any = {};
  if (data.url !== undefined) updateData.url = data.url;
  if (data.title !== undefined) updateData.title = data.title;

  const updatedLink = await prisma.taskLink.update({
    where: { id: linkId },
    data: updateData,
    select: {
      id: true,
      url: true,
      title: true,
      createdAt: true,
    },
  });

  return updatedLink;
}

/**
 * Delete a task link
 * Verifies the link belongs to the specified task and user
 */
export async function deleteTaskLink(taskId: string, linkId: string, userId: string) {
  // Verify link exists, belongs to the specified task, and the task belongs to the user
  const link = await prisma.taskLink.findFirst({
    where: {
      id: linkId,
      taskId, // Verify link belongs to the specified task
      task: {
        userId, // Verify task belongs to the user
      },
    },
  });

  if (!link) {
    throw new Error('Link not found');
  }

  await prisma.taskLink.delete({
    where: { id: linkId },
  });

  return { success: true };
}
