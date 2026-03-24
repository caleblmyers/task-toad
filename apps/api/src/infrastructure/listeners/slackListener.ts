import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import { dispatchSlackNotifications } from '../../utils/notificationUtils.js';
import { isPremiumEnabled } from '../../utils/license.js';

async function isOrgPremium(prisma: PrismaClient, orgId: string): Promise<boolean> {
  const org = await prisma.org.findUnique({ where: { orgId }, select: { plan: true } });
  return isPremiumEnabled(org?.plan);
}

export function register(bus: EventBus, prisma: PrismaClient): void {
  bus.on('task.created', async (e) => {
    if (!(await isOrgPremium(prisma, e.orgId))) return;
    dispatchSlackNotifications(prisma, e.orgId, 'task.created', { task: e.task });
  });

  bus.on('task.updated', async (e) => {
    if (!(await isOrgPremium(prisma, e.orgId))) return;
    if (Object.keys(e.changes).length > 0) {
      dispatchSlackNotifications(prisma, e.orgId, 'task.updated', { task: e.task, changes: e.changes });
    }
  });

  bus.on('sprint.created', async (e) => {
    if (!(await isOrgPremium(prisma, e.orgId))) return;
    dispatchSlackNotifications(prisma, e.orgId, 'sprint.created', { sprint: e.sprint });
  });

  bus.on('sprint.closed', async (e) => {
    if (!(await isOrgPremium(prisma, e.orgId))) return;
    dispatchSlackNotifications(prisma, e.orgId, 'sprint.closed', { sprint: e.sprint });
  });
}
