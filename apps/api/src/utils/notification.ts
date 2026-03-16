import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from './logger.js';
import { sendEmail } from './email.js';

const log = createChildLogger('notification');

interface CreateNotificationParams {
  orgId: string;
  userId: string;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  relatedTaskId?: string | null;
  relatedProjectId?: string | null;
}

export function createNotification(prisma: PrismaClient, params: CreateNotificationParams): void {
  // Fire-and-forget like logActivity
  doCreateNotification(prisma, params).catch((err: unknown) => {
    log.error({ err, type: params.type }, 'Failed to create notification');
  });
}

async function doCreateNotification(prisma: PrismaClient, params: CreateNotificationParams): Promise<void> {
  await prisma.notification.create({
    data: {
      orgId: params.orgId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      linkUrl: params.linkUrl ?? null,
      relatedTaskId: params.relatedTaskId ?? null,
      relatedProjectId: params.relatedProjectId ?? null,
    },
  });

  // Check if user wants email for this notification type
  const user = await prisma.user.findUnique({
    where: { userId: params.userId },
    select: { email: true, emailNotificationsEnabled: true },
  });
  if (!user || !user.emailNotificationsEnabled) return;

  const pref = await prisma.notificationPreference.findUnique({
    where: {
      userId_orgId_notificationType: {
        userId: params.userId,
        orgId: params.orgId,
        notificationType: params.type,
      },
    },
  });
  // Default: email is off unless explicitly enabled
  if (!pref?.email) return;

  const html = `<h3>${params.title}</h3>${params.body ? `<p>${params.body}</p>` : ''}`;
  await sendEmail(user.email, `TaskToad: ${params.title}`, html);
}
