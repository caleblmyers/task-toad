import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from './logger.js';

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
  prisma.notification.create({
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
  }).catch((err: unknown) => {
    log.error({ err, type: params.type }, 'Failed to create notification');
  });
}
