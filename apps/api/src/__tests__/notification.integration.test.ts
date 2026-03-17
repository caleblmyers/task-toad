import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { authMutations } from '../graphql/resolvers/auth.js';
import { notificationQueries, notificationMutations } from '../graphql/resolvers/notification.js';
import type { Context } from '../graphql/context.js';
import { createLoaders } from '../graphql/loaders.js';

// ── Helpers ──

let orgId: string;
let userId: string;

function makeContext(): Context {
  return {
    user: { userId, email: 'notif-test@example.com', orgId, role: 'org:admin', emailVerifiedAt: null },
    org: { orgId, name: 'Test Org', anthropicApiKeyEncrypted: null },
    prisma,
    loaders: createLoaders(prisma),
  };
}

async function createNotification(overrides: { isRead?: boolean; title?: string } = {}) {
  return prisma.notification.create({
    data: {
      orgId,
      userId,
      type: 'assigned',
      title: overrides.title ?? 'Test Notification',
      isRead: overrides.isRead ?? false,
    },
  });
}

// ── Setup ──

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();

  // Create user + org
  await authMutations.signup(null, { email: 'notif-test@example.com', password: 'Password123' }, {
    user: null, org: null, prisma, loaders: createLoaders(prisma),
  } as Context);

  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'notif-test@example.com' } });
  const org = await prisma.org.create({ data: { name: 'Test Org' } });
  await prisma.user.update({ where: { userId: user.userId }, data: { orgId: org.orgId, role: 'org:admin' } });

  orgId = org.orgId;
  userId = user.userId;
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('notifications query', () => {
  it('returns notifications for the authenticated user', async () => {
    await createNotification({ title: 'Notif 1' });
    await createNotification({ title: 'Notif 2' });

    const result = await notificationQueries.notifications(null, {}, makeContext());
    expect(result).toHaveLength(2);
  });

  it('filters to unread only when unreadOnly is true', async () => {
    await createNotification({ isRead: false, title: 'Unread' });
    await createNotification({ isRead: true, title: 'Read' });

    const result = await notificationQueries.notifications(null, { unreadOnly: true }, makeContext());
    expect(result).toHaveLength(1);
    expect(result[0].title).toBe('Unread');
  });

  it('respects limit parameter', async () => {
    await createNotification({ title: 'N1' });
    await createNotification({ title: 'N2' });
    await createNotification({ title: 'N3' });

    const result = await notificationQueries.notifications(null, { limit: 2 }, makeContext());
    expect(result).toHaveLength(2);
  });
});

describe('unreadNotificationCount', () => {
  it('returns correct count of unread notifications', async () => {
    await createNotification({ isRead: false });
    await createNotification({ isRead: false });
    await createNotification({ isRead: false });
    await createNotification({ isRead: true });
    await createNotification({ isRead: true });

    const count = await notificationQueries.unreadNotificationCount(null, {}, makeContext());
    expect(count).toBe(3);
  });
});

describe('markNotificationRead', () => {
  it('marks a notification as read', async () => {
    const notif = await createNotification({ isRead: false });

    const updated = await notificationMutations.markNotificationRead(
      null,
      { notificationId: notif.notificationId },
      makeContext(),
    );
    expect(updated.isRead).toBe(true);

    const dbNotif = await prisma.notification.findUnique({ where: { notificationId: notif.notificationId } });
    expect(dbNotif!.isRead).toBe(true);
  });

  it('throws NotFoundError for another user\'s notification', async () => {
    // Create another user
    await authMutations.signup(null, { email: 'other@example.com', password: 'Password123' }, {
      user: null, org: null, prisma, loaders: createLoaders(prisma),
    } as Context);
    const otherUser = await prisma.user.findUniqueOrThrow({ where: { email: 'other@example.com' } });
    await prisma.user.update({ where: { userId: otherUser.userId }, data: { orgId, role: 'org:member' } });

    // Create notification for the other user
    const notif = await prisma.notification.create({
      data: { orgId, userId: otherUser.userId, type: 'assigned', title: 'Other Notif' },
    });

    await expect(
      notificationMutations.markNotificationRead(null, { notificationId: notif.notificationId }, makeContext()),
    ).rejects.toThrow('Notification not found');
  });
});

describe('markAllNotificationsRead', () => {
  it('marks all unread notifications as read and returns count', async () => {
    await createNotification({ isRead: false });
    await createNotification({ isRead: false });
    await createNotification({ isRead: false });
    await createNotification({ isRead: false });
    await createNotification({ isRead: false });

    const count = await notificationMutations.markAllNotificationsRead(null, {}, makeContext());
    expect(count).toBe(5);

    // Verify all are now read
    const unread = await prisma.notification.count({
      where: { userId, orgId, isRead: false },
    });
    expect(unread).toBe(0);
  });
});

describe('notificationPreferences', () => {
  it('returns 6 default notification types', async () => {
    const prefs = await notificationQueries.notificationPreferences(null, {}, makeContext());
    expect(prefs).toHaveLength(6);
    const types = prefs.map((p: { notificationType: string }) => p.notificationType);
    expect(types).toContain('assigned');
    expect(types).toContain('status_changed');
    expect(types).toContain('commented');
    expect(types).toContain('mentioned');
    expect(types).toContain('due_date_reminder');
    expect(types).toContain('sprint_event');
  });

  it('persists preference update and returns it in subsequent query', async () => {
    // Update a preference
    await notificationMutations.updateNotificationPreference(
      null,
      { notificationType: 'assigned', inApp: false, email: true },
      makeContext(),
    );

    // Query preferences
    const prefs = await notificationQueries.notificationPreferences(null, {}, makeContext());
    const assignedPref = prefs.find((p: { notificationType: string }) => p.notificationType === 'assigned');
    expect(assignedPref).toBeDefined();
    expect(assignedPref!.inApp).toBe(false);
    expect(assignedPref!.email).toBe(true);
  });
});
