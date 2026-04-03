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

/** Threshold for stale PRs (7 days with no activity). */
const STALE_PR_DAYS = 7;
const STALE_PR_MS = STALE_PR_DAYS * 24 * 60 * 60_000;

/** Minimum interval between duplicate stale PR alerts (24 hours). */
const STALE_PR_DEDUP_WINDOW_MS = 24 * 60 * 60_000;

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
      alertType: 'stuck_plan',
      planId: plan.id,
      status: reason,
      minutesStuck,
    });

    alertCount++;
  }

  if (alertCount > 0) {
    log.info({ alertCount }, 'Health alerts created for stuck/stale plans');
  }

  // ── Stale PR detection ──────────────────────────────────────────────────
  await checkStalePullRequests(prisma, now);
}

async function checkStalePullRequests(prisma: PrismaClient, now: Date): Promise<void> {
  const stalePRs = await prisma.gitHubPullRequestLink.findMany({
    where: {
      state: 'OPEN',
      updatedAt: { lt: new Date(now.getTime() - STALE_PR_MS) },
    },
    include: {
      task: { select: { taskId: true, title: true, projectId: true, orgId: true } },
    },
  });

  if (stalePRs.length === 0) return;

  // Dedup: check for recent stale PR alerts (24-hour window)
  const recentAlerts = await prisma.notification.findMany({
    where: {
      type: 'health_alert',
      createdAt: { gt: new Date(now.getTime() - STALE_PR_DEDUP_WINDOW_MS) },
    },
    select: { body: true },
  });

  const recentlyAlertedPRIds = new Set<string>();
  for (const alert of recentAlerts) {
    if (alert.body) {
      const match = alert.body.match(/stalePR:([a-zA-Z0-9_-]+)/);
      if (match) recentlyAlertedPRIds.add(match[1]);
    }
  }

  let alertCount = 0;
  const bus = getEventBus();

  for (const pr of stalePRs) {
    if (recentlyAlertedPRIds.has(pr.id)) continue;

    const daysOpen = Math.round((now.getTime() - pr.updatedAt.getTime()) / (24 * 60 * 60_000));
    const title = `PR for "${pr.task.title}" has been open for ${daysOpen} days`;
    const body = `Consider merging, closing, or updating PR #${pr.prNumber}. stalePR:${pr.id}`;

    const orgUsers = await prisma.user.findMany({
      where: { orgId: pr.task.orgId },
      select: { userId: true },
    });

    for (const user of orgUsers) {
      createNotification(prisma, {
        orgId: pr.task.orgId,
        userId: user.userId,
        type: 'health_alert',
        title,
        body,
        relatedTaskId: pr.task.taskId,
        relatedProjectId: pr.task.projectId,
      });
    }

    // Emit SSE event for real-time UI updates
    bus.emit('health.alert', {
      orgId: pr.task.orgId,
      userId: '',
      projectId: pr.task.projectId,
      timestamp: now.toISOString(),
      taskId: pr.task.taskId,
      taskTitle: pr.task.title,
      alertType: 'stale_pr',
      prNumber: pr.prNumber,
      daysOpen,
      message: `PR #${pr.prNumber} for "${pr.task.title}" has been open for ${daysOpen} days`,
    });

    alertCount++;
  }

  if (alertCount > 0) {
    log.info({ alertCount }, 'Health alerts created for stale pull requests');
  }
}
