import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../utils/logger.js';
import { createNotification } from '../../utils/notification.js';
import { getEventBus } from '../eventbus/index.js';

const log = createChildLogger('health-monitor');

/** Threshold for plans stuck in 'executing' state (30 minutes). */
const STUCK_EXECUTING_MS = 30 * 60_000;

/** Threshold for plans stuck in 'approved' state (10 minutes). */
const STALE_APPROVED_MS = 10 * 60_000;

/** Minimum interval between duplicate alerts for the same plan (1 hour). */
const DEDUP_WINDOW_MS = 60 * 60_000;

export function createHandler(prisma: PrismaClient) {
  return async () => {
    await runHealthCheck(prisma);
  };
}

async function runHealthCheck(prisma: PrismaClient): Promise<void> {
  const now = new Date();

  const [stuckPlans, stalePlans] = await Promise.all([
    prisma.taskActionPlan.findMany({
      where: {
        status: 'executing',
        updatedAt: { lt: new Date(now.getTime() - STUCK_EXECUTING_MS) },
      },
      include: { task: { select: { taskId: true, title: true, projectId: true, orgId: true } } },
    }),
    prisma.taskActionPlan.findMany({
      where: {
        status: 'approved',
        updatedAt: { lt: new Date(now.getTime() - STALE_APPROVED_MS) },
      },
      include: { task: { select: { taskId: true, title: true, projectId: true, orgId: true } } },
    }),
  ]);

  log.debug(
    { stuckExecuting: stuckPlans.length, staleApproved: stalePlans.length },
    'Health check completed',
  );

  const allProblematic = [
    ...stuckPlans.map((p) => ({ plan: p, reason: 'executing' as const })),
    ...stalePlans.map((p) => ({ plan: p, reason: 'approved' as const })),
  ];

  if (allProblematic.length === 0) return;

  // Collect plan IDs to check for recent alerts
  const planIds = allProblematic.map((p) => p.plan.id);
  const recentAlerts = await prisma.notification.findMany({
    where: {
      type: 'health_alert',
      createdAt: { gt: new Date(now.getTime() - DEDUP_WINDOW_MS) },
    },
    select: { relatedTaskId: true, body: true },
  });

  // Build a set of planIds that were recently alerted
  const recentlyAlertedPlanIds = new Set<string>();
  for (const alert of recentAlerts) {
    // We store planId in the body as a marker: "planId:<id>"
    if (alert.body) {
      const match = alert.body.match(/planId:([a-f0-9-]+)/);
      if (match && planIds.includes(match[1])) {
        recentlyAlertedPlanIds.add(match[1]);
      }
    }
  }

  let alertCount = 0;
  const bus = getEventBus();

  for (const { plan, reason } of allProblematic) {
    if (recentlyAlertedPlanIds.has(plan.id)) continue;

    const minutesStuck = Math.round((now.getTime() - plan.updatedAt.getTime()) / 60_000);
    const statusLabel = reason === 'executing' ? 'executing' : 'approved but not started';
    const title = `Task "${plan.task.title}" appears stuck`;
    const body = `Action plan has been ${statusLabel} for ${minutesStuck} minutes without progress. planId:${plan.id}`;

    // Find all users in the org to notify
    const orgUsers = await prisma.user.findMany({
      where: { orgId: plan.task.orgId },
      select: { userId: true },
    });

    for (const user of orgUsers) {
      createNotification(prisma, {
        orgId: plan.task.orgId,
        userId: user.userId,
        type: 'health_alert',
        title,
        body,
        relatedTaskId: plan.task.taskId,
        relatedProjectId: plan.task.projectId,
      });
    }

    // Emit SSE event for real-time UI updates
    bus.emit('health.alert', {
      orgId: plan.task.orgId,
      userId: '',
      projectId: plan.task.projectId,
      timestamp: now.toISOString(),
      taskId: plan.task.taskId,
      taskTitle: plan.task.title,
      planId: plan.id,
      status: reason,
      minutesStuck,
    });

    alertCount++;
  }

  if (alertCount > 0) {
    log.info({ alertCount }, 'Health alerts created for stuck/stale plans');
  }
}
