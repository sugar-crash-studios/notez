import { prisma } from '../lib/db.js';

export type NotificationType = 'NEW_FEEDBACK' | 'STATUS_CHANGE' | 'FEEDBACK_PUBLISHED';

export interface CreateNotificationInput {
  type: NotificationType;
  title: string;
  message?: string;
  linkType: string;
  linkId: string;
  userId: string;
}

/**
 * Create a new notification
 */
export async function createNotification(input: CreateNotificationInput) {
  const notification = await prisma.notification.create({
    data: {
      type: input.type,
      title: input.title,
      message: input.message || null,
      linkType: input.linkType,
      linkId: input.linkId,
      userId: input.userId,
    },
  });

  return notification;
}

/**
 * Create notifications for all admins
 * Used when a new feedback is submitted
 */
export async function notifyAdmins(
  type: NotificationType,
  title: string,
  linkType: string,
  linkId: string,
  message?: string
) {
  // Get all admin users
  const admins = await prisma.user.findMany({
    where: {
      role: 'admin',
      isActive: true,
    },
    select: {
      id: true,
    },
  });

  // Create a notification for each admin
  const notifications = await prisma.notification.createMany({
    data: admins.map((admin) => ({
      type,
      title,
      message: message || null,
      linkType,
      linkId,
      userId: admin.id,
    })),
  });

  return notifications;
}

/**
 * Get notifications for a user
 */
export async function getNotifications(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
    unreadOnly?: boolean;
  }
) {
  const { limit = 50, offset = 0, unreadOnly = false } = options || {};

  const where: any = { userId };

  if (unreadOnly) {
    where.isRead = false;
  }

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    }),
    prisma.notification.count({ where }),
  ]);

  return { notifications, total };
}

/**
 * Get unread notification count for a user
 */
export async function getUnreadCount(userId: string): Promise<number> {
  const count = await prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });

  return count;
}

/**
 * Mark a notification as read
 */
export async function markAsRead(notificationId: string, userId: string) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  const updated = await prisma.notification.update({
    where: { id: notificationId },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return updated;
}

/**
 * Mark all notifications as read for a user
 */
export async function markAllAsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: {
      userId,
      isRead: false,
    },
    data: {
      isRead: true,
      readAt: new Date(),
    },
  });

  return result;
}

/**
 * Delete a notification
 */
export async function deleteNotification(notificationId: string, userId: string) {
  const notification = await prisma.notification.findFirst({
    where: {
      id: notificationId,
      userId,
    },
  });

  if (!notification) {
    throw new Error('Notification not found');
  }

  await prisma.notification.delete({
    where: { id: notificationId },
  });
}

/**
 * Delete all read notifications older than specified days
 */
export async function cleanupOldNotifications(olderThanDays: number = 30) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

  const result = await prisma.notification.deleteMany({
    where: {
      isRead: true,
      createdAt: {
        lt: cutoffDate,
      },
    },
  });

  return result;
}
