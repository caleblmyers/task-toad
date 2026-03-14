import type { Context } from '../context.js';
import { NotFoundError } from '../errors.js';
import { requireAuth, requireOrg } from './auth.js';

// ── Notification queries ──

export const notificationQueries = {
  notifications: async (_parent: unknown, args: { unreadOnly?: boolean | null; limit?: number | null }, context: Context) => {
    const user = requireOrg(context);
    return context.prisma.notification.findMany({
      where: {
        userId: user.userId,
        orgId: user.orgId,
        ...(args.unreadOnly ? { isRead: false } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: args.limit ?? 50,
    });
  },

  unreadNotificationCount: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);
    return context.prisma.notification.count({
      where: { userId: user.userId, orgId: user.orgId, isRead: false },
    });
  },
};

// ── Notification mutations ──

export const notificationMutations = {
  markNotificationRead: async (_parent: unknown, args: { notificationId: string }, context: Context) => {
    const user = requireAuth(context);
    const notification = await context.prisma.notification.findUnique({ where: { notificationId: args.notificationId } });
    if (!notification || notification.userId !== user.userId) {
      throw new NotFoundError('Notification not found');
    }
    return context.prisma.notification.update({
      where: { notificationId: args.notificationId },
      data: { isRead: true },
    });
  },

  markAllNotificationsRead: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);
    await context.prisma.notification.updateMany({
      where: { userId: user.userId, orgId: user.orgId, isRead: false },
      data: { isRead: true },
    });
    return true;
  },
};

// ── Notification field resolvers ──

export const notificationFieldResolvers = {
  Notification: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
};
