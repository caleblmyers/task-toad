import type { Context } from '../context.js';
import { NotFoundError } from '../errors.js';
import { requireAuth, requireOrg } from './auth.js';

export type { Notification as SharedNotification } from '@tasktoad/shared-types';

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

  notificationPreferences: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);
    const prefs = await context.prisma.notificationPreference.findMany({
      where: { userId: user.userId, orgId: user.orgId },
    });

    const defaultTypes = ['assigned', 'status_changed', 'commented', 'mentioned', 'due_date_reminder', 'sprint_event'];
    const prefMap = new Map(prefs.map(p => [p.notificationType, p]));

    return defaultTypes.map(type => {
      const existing = prefMap.get(type);
      if (existing) return existing;
      return { id: `default-${type}`, notificationType: type, inApp: true, email: false };
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
    const result = await context.prisma.notification.updateMany({
      where: { userId: user.userId, orgId: user.orgId, isRead: false },
      data: { isRead: true },
    });
    return result.count;
  },

  updateNotificationPreference: async (
    _parent: unknown,
    args: { notificationType: string; inApp?: boolean | null; email?: boolean | null },
    context: Context,
  ) => {
    const user = requireOrg(context);
    return context.prisma.notificationPreference.upsert({
      where: {
        userId_orgId_notificationType: {
          userId: user.userId,
          orgId: user.orgId,
          notificationType: args.notificationType,
        },
      },
      create: {
        userId: user.userId,
        orgId: user.orgId,
        notificationType: args.notificationType,
        inApp: args.inApp ?? true,
        email: args.email ?? false,
      },
      update: {
        ...(args.inApp != null ? { inApp: args.inApp } : {}),
        ...(args.email != null ? { email: args.email } : {}),
      },
    });
  },
};

// ── Notification field resolvers ──

export const notificationFieldResolvers = {
  Notification: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
};
