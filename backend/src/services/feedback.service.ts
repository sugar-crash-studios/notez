import { prisma } from '../lib/db.js';
import type { CreateFeedbackInput, UpdateFeedbackInput, ListFeedbackQuery } from '../utils/validation.schemas.js';
import type { FeedbackType, FeedbackStatus } from '@prisma/client';
import * as notificationService from './notification.service.js';

/**
 * Create a new feedback submission
 */
export async function createFeedback(userId: string, input: CreateFeedbackInput) {
  const feedback = await prisma.feedbackSubmission.create({
    data: {
      type: input.type as FeedbackType,
      title: input.title,
      description: input.description,
      category: input.category || null,
      priority: input.priority || null,
      userId,
    },
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  // Notify all admins about the new submission (don't block on errors)
  const typeLabel = input.type === 'BUG' ? 'bug report' : 'feature request';
  notificationService.notifyAdmins(
    'NEW_FEEDBACK',
    `New ${typeLabel}: ${input.title}`,
    'feedback',
    feedback.id,
    `${feedback.user.username} submitted a ${typeLabel}`
  ).catch(err => {
    console.error('Failed to notify admins:', err);
  });

  return feedback;
}

/**
 * Get feedback by ID
 * For regular users: only their own submissions
 * For admins: any submission
 */
export async function getFeedbackById(feedbackId: string, userId: string, isAdmin: boolean = false) {
  const where: any = { id: feedbackId };

  // Regular users can only see their own feedback
  if (!isAdmin) {
    where.userId = userId;
  }

  const feedback = await prisma.feedbackSubmission.findFirst({
    where,
    include: {
      user: {
        select: {
          id: true,
          username: true,
          email: true,
        },
      },
    },
  });

  if (!feedback) {
    throw new Error('Feedback not found');
  }

  return feedback;
}

/**
 * List feedback submissions for a user (their own)
 */
export async function listUserFeedback(
  userId: string,
  options?: {
    limit?: number;
    offset?: number;
  }
) {
  const { limit = 50, offset = 0 } = options || {};

  const [submissions, total] = await Promise.all([
    prisma.feedbackSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      select: {
        id: true,
        type: true,
        title: true,
        status: true,
        category: true,
        priority: true,
        shipped: true,
        githubIssueUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.feedbackSubmission.count({
      where: { userId },
    }),
  ]);

  return { submissions, total };
}

/**
 * List all feedback submissions (admin only)
 */
export async function listAllFeedback(options?: ListFeedbackQuery) {
  const { type, status, category, limit = 50, offset = 0 } = options || {};

  // Build where clause
  const where: any = {};

  if (type) {
    where.type = type;
  }

  if (status) {
    where.status = status;
  }

  if (category) {
    where.category = category;
  }

  const [submissions, total, newCount] = await Promise.all([
    prisma.feedbackSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        user: {
          select: {
            id: true,
            username: true,
          },
        },
      },
    }),
    prisma.feedbackSubmission.count({ where }),
    prisma.feedbackSubmission.count({ where: { status: 'NEW' } }),
  ]);

  return { submissions, total, newCount };
}

/**
 * Update feedback submission (admin only)
 */
export async function updateFeedback(feedbackId: string, input: UpdateFeedbackInput) {
  // First check if the feedback exists
  const existing = await prisma.feedbackSubmission.findUnique({
    where: { id: feedbackId },
  });

  if (!existing) {
    throw new Error('Feedback not found');
  }

  // Build update data
  const data: any = {};

  if (input.status !== undefined) {
    data.status = input.status as FeedbackStatus;

    // Set reviewedAt when first reviewed
    if (input.status !== 'NEW' && !existing.reviewedAt) {
      data.reviewedAt = new Date();
    }

    // Set publishedAt when published
    if (input.status === 'PUBLISHED' && !existing.publishedAt) {
      data.publishedAt = new Date();
    }
  }

  if (input.adminNotes !== undefined) {
    data.adminNotes = input.adminNotes;
  }

  const feedback = await prisma.feedbackSubmission.update({
    where: { id: feedbackId },
    data,
    include: {
      user: {
        select: {
          id: true,
          username: true,
        },
      },
    },
  });

  // Notify user if status changed (and it's a meaningful status change)
  if (input.status !== undefined && input.status !== existing.status) {
    const statusMessages: Record<string, string> = {
      REVIEWED: 'Your feedback has been reviewed by our team',
      APPROVED: 'Great news! Your feedback has been approved',
      DECLINED: 'Your feedback has been reviewed',
      PUBLISHED: 'Your feedback has been published',
    };

    const message = statusMessages[input.status];
    if (message) {
      const typeLabel = feedback.type === 'BUG' ? 'bug report' : 'feature request';
      notificationService.notifyUser(
        feedback.userId,
        'FEEDBACK_STATUS_CHANGE',
        `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} update: ${feedback.title}`,
        'feedback',
        feedback.id,
        message
      ).catch(err => {
        console.error('Failed to notify user of status change:', err);
      });
    }
  }

  return feedback;
}

/**
 * Delete feedback submission (admin only)
 */
export async function deleteFeedback(feedbackId: string) {
  const existing = await prisma.feedbackSubmission.findUnique({
    where: { id: feedbackId },
  });

  if (!existing) {
    throw new Error('Feedback not found');
  }

  await prisma.feedbackSubmission.delete({
    where: { id: feedbackId },
  });
}

/**
 * Mark feedback as shipped (admin only)
 * Used for the "User Requested" badge feature
 */
export async function markAsShipped(feedbackId: string) {
  const existing = await prisma.feedbackSubmission.findUnique({
    where: { id: feedbackId },
  });

  if (!existing) {
    throw new Error('Feedback not found');
  }

  const feedback = await prisma.feedbackSubmission.update({
    where: { id: feedbackId },
    data: {
      shipped: true,
      shippedAt: new Date(),
    },
  });

  return feedback;
}

/**
 * Unmark feedback as shipped (admin only)
 * Used to undo accidental ship marking
 */
export async function unmarkAsShipped(feedbackId: string) {
  const existing = await prisma.feedbackSubmission.findUnique({
    where: { id: feedbackId },
  });

  if (!existing) {
    throw new Error('Feedback not found');
  }

  const feedback = await prisma.feedbackSubmission.update({
    where: { id: feedbackId },
    data: {
      shipped: false,
      shippedAt: null,
    },
  });

  return feedback;
}

/**
 * Store GitHub issue information after publishing
 */
export async function setGitHubIssue(feedbackId: string, issueUrl: string, issueNumber: number) {
  const feedback = await prisma.feedbackSubmission.update({
    where: { id: feedbackId },
    data: {
      githubIssueUrl: issueUrl,
      githubIssueNumber: issueNumber,
      status: 'PUBLISHED',
      publishedAt: new Date(),
    },
  });

  return feedback;
}

/**
 * Store AI-enhanced content for a submission
 */
export async function setEnhancedContent(feedbackId: string, enhancedContent: any) {
  const feedback = await prisma.feedbackSubmission.update({
    where: { id: feedbackId },
    data: {
      enhancedContent,
    },
  });

  return feedback;
}

/**
 * Get feedback statistics
 */
export async function getFeedbackStats() {
  const [total, byStatus, byType] = await Promise.all([
    prisma.feedbackSubmission.count(),
    prisma.feedbackSubmission.groupBy({
      by: ['status'],
      _count: true,
    }),
    prisma.feedbackSubmission.groupBy({
      by: ['type'],
      _count: true,
    }),
  ]);

  return {
    total,
    byStatus: byStatus.reduce((acc, item) => {
      acc[item.status] = item._count;
      return acc;
    }, {} as Record<string, number>),
    byType: byType.reduce((acc, item) => {
      acc[item.type] = item._count;
      return acc;
    }, {} as Record<string, number>),
  };
}

/**
 * Check rate limit for user submissions
 * Returns true if user is within limit, false if exceeded
 */
export async function checkRateLimit(userId: string, maxPerHour: number = 10): Promise<boolean> {
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const recentCount = await prisma.feedbackSubmission.count({
    where: {
      userId,
      createdAt: {
        gte: oneHourAgo,
      },
    },
  });

  return recentCount < maxPerHour;
}
