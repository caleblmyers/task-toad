import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import { logger } from '../../utils/logger.js';
import { calculateBusinessMs } from '../../utils/businessHours.js';
import { isPremiumEnabled } from '../../utils/license.js';
import { getCachedOrgPlan } from '../../utils/orgPlanCache.js';

const log = logger.child({ module: 'slaListener' });

async function isOrgPremium(prisma: PrismaClient, orgId: string): Promise<boolean> {
  const plan = await getCachedOrgPlan(prisma, orgId);
  return isPremiumEnabled(plan);
}

export function register(bus: EventBus, prisma: PrismaClient): void {
  // When a task is created, create SLA timers for matching policies
  bus.on('task.created', async (e) => {
    if (!(await isOrgPremium(prisma, e.orgId))) return;
    try {
      const policies = await prisma.sLAPolicy.findMany({
        where: {
          projectId: e.projectId,
          orgId: e.orgId,
          enabled: true,
        },
      });

      const taskPriority = e.task.priority as string | undefined;

      for (const policy of policies) {
        // Policy applies if priority is null (all) or matches the task priority
        if (policy.priority && policy.priority !== taskPriority) continue;

        await prisma.sLATimer.create({
          data: {
            taskId: e.task.taskId,
            policyId: policy.slaPolicyId,
            orgId: e.orgId,
            startedAt: new Date(),
          },
        });
      }
    } catch (err) {
      log.error({ err, taskId: e.task.taskId }, 'Failed to create SLA timers');
    }
  });

  // When a task is updated, update SLA timer milestones
  bus.on('task.updated', async (e) => {
    if (!(await isOrgPremium(prisma, e.orgId))) return;
    if (!e.changes.status) return;

    const oldStatus = e.changes.status.old;
    const newStatus = e.changes.status.new;

    try {
      const timers = await prisma.sLATimer.findMany({
        where: { taskId: e.task.taskId },
        include: { policy: true },
      });

      if (timers.length === 0) return;

      const now = new Date();

      for (const timer of timers) {
        const updates: Record<string, unknown> = {};

        // Pause: task moves from in_progress back to todo/backlog
        if (
          oldStatus === 'in_progress' &&
          (newStatus === 'todo' || newStatus === 'backlog') &&
          !timer.pausedAt
        ) {
          updates.pausedAt = now;
        }

        // Resume: task moves back to in_progress while paused
        if (newStatus === 'in_progress' && timer.pausedAt) {
          const pausedMs = now.getTime() - timer.pausedAt.getTime();
          updates.totalPausedMs = timer.totalPausedMs + pausedMs;
          updates.pausedAt = null;
        }

        // Business hours config from policy
        const bhPolicy = {
          businessHoursStart: timer.policy.businessHoursStart,
          businessHoursEnd: timer.policy.businessHoursEnd,
          excludeWeekends: timer.policy.excludeWeekends,
        };

        // First move to in_progress: mark as "responded"
        if (oldStatus === 'todo' && newStatus === 'in_progress' && !timer.respondedAt) {
          updates.respondedAt = now;
          const businessMs = calculateBusinessMs(timer.startedAt, now, bhPolicy);
          const effectiveElapsed = Math.max(0, businessMs - timer.totalPausedMs);
          const deadline = timer.policy.responseTimeHours * 3600_000;
          if (effectiveElapsed > deadline) {
            updates.responseBreached = true;
          }
        }

        // Move to in_review or done: mark as "resolved"
        if ((newStatus === 'in_review' || newStatus === 'done') && !timer.resolvedAt) {
          // If the timer was paused, accumulate remaining paused time
          let currentPausedMs = timer.totalPausedMs;
          if (timer.pausedAt) {
            currentPausedMs += now.getTime() - timer.pausedAt.getTime();
            updates.pausedAt = null;
            updates.totalPausedMs = currentPausedMs;
          }
          updates.resolvedAt = now;
          const businessMs = calculateBusinessMs(timer.startedAt, now, bhPolicy);
          const effectiveElapsed = Math.max(0, businessMs - currentPausedMs);
          const deadline = timer.policy.resolutionTimeHours * 3600_000;
          if (effectiveElapsed > deadline) {
            updates.resolutionBreached = true;
          }
        }

        if (Object.keys(updates).length > 0) {
          await prisma.sLATimer.update({
            where: { slaTimerId: timer.slaTimerId },
            data: updates,
          });
        }
      }
    } catch (err) {
      log.error({ err, taskId: e.task.taskId }, 'Failed to update SLA timers');
    }
  });
}
