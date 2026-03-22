import type { PrismaClient } from '@prisma/client';
import { getInstallationToken } from '../../github/githubAppAuth.js';
import { evaluateCheckRuns } from '../../actions/executors/monitorCI.js';
import { getEventBus } from '../eventbus/index.js';
import { getJobQueue } from '../jobqueue/index.js';
import { getAbortController } from './actionExecutor.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('monitor-ci-poll');

/** Max polling attempts — 60 × 30s = 30 minutes. */
const MAX_ATTEMPTS = 60;
const POLL_DELAY_MS = 30_000;

interface CheckRunsResponse {
  total_count: number;
  check_runs: Array<{
    id: number;
    name: string;
    status: string;
    conclusion: string | null;
    html_url: string;
  }>;
}

export function createHandler(prisma: PrismaClient) {
  return async (payload: {
    planId: string;
    actionId: string;
    orgId: string;
    userId: string;
    owner: string;
    repo: string;
    headSha: string;
    installationId: string;
    attempt: number;
  }) => {
    const { actionId, orgId, userId, owner, repo, headSha, installationId, attempt } = payload;

    // Check if plan was cancelled
    const action = await prisma.taskAction.findUnique({
      where: { id: actionId },
      include: { plan: { include: { task: true } } },
    });

    if (!action) {
      log.warn({ actionId }, 'Action not found for CI poll');
      return;
    }

    if (action.plan.status === 'cancelled' || action.status === 'skipped') {
      log.info({ actionId }, 'Plan cancelled or action skipped, stopping CI poll');
      return;
    }

    // Check abort signal
    const controller = getAbortController(action.planId);
    if (controller?.signal.aborted) {
      log.info({ actionId }, 'Action aborted, stopping CI poll');
      return;
    }

    // Refresh token and poll
    const token = await getInstallationToken(installationId);
    const encodedOwner = encodeURIComponent(owner);
    const encodedRepo = encodeURIComponent(repo);
    const signal = controller?.signal;

    const response = await fetch(
      `https://api.github.com/repos/${encodedOwner}/${encodedRepo}/commits/${headSha}/check-runs`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal,
      },
    );

    if (!response.ok) {
      log.error({ actionId, status: response.status }, 'Failed to fetch check runs during poll');
      await markActionFailed(prisma, actionId, action.planId, `Failed to fetch check runs: ${response.status}`);
      emitCompletion(action, orgId, userId, false);
      return;
    }

    const checks = (await response.json()) as CheckRunsResponse;
    const result = evaluateCheckRuns(checks);

    if (result) {
      // Checks are done — update the action with the result
      if (result.success) {
        await prisma.taskAction.update({
          where: { id: actionId },
          data: {
            status: 'completed',
            result: JSON.stringify(result.data),
            completedAt: new Date(),
          },
        });
      } else {
        await prisma.taskAction.update({
          where: { id: actionId },
          data: {
            status: 'failed',
            errorMessage: (result.data.error as string) || 'CI checks failed',
            result: JSON.stringify(result.data),
          },
        });
      }

      // Emit completion event
      emitCompletion(action, orgId, userId, result.success);

      if (!result.success) {
        await prisma.taskActionPlan.update({
          where: { id: action.planId },
          data: { status: 'failed' },
        });

        const bus = getEventBus();
        bus.emit('task.action_plan_failed', {
          orgId,
          userId,
          projectId: action.plan.task.projectId,
          timestamp: new Date().toISOString(),
          planId: action.planId,
          taskId: action.plan.task.taskId,
          taskTitle: action.plan.task.title,
          lastFailedActionId: actionId,
          lastFailedActionType: action.actionType,
          errorMessage: 'CI checks failed',
        });
        return;
      }

      // Enqueue next action if there is one
      const nextAction = await prisma.taskAction.findFirst({
        where: { planId: action.planId, status: 'pending', position: { gt: action.position } },
        orderBy: { position: 'asc' },
      });

      if (nextAction) {
        if (nextAction.requiresApproval) {
          log.info({ planId: action.planId, nextActionId: nextAction.id }, 'Next action requires approval, pausing');
        } else {
          const queue = getJobQueue();
          queue.enqueue('action-execute', {
            planId: action.planId,
            actionId: nextAction.id,
            orgId,
            userId,
          });
        }
      } else {
        // All actions done
        await prisma.taskActionPlan.update({
          where: { id: action.planId },
          data: { status: 'completed' },
        });

        const bus = getEventBus();
        bus.emit('task.action_plan_completed', {
          orgId,
          userId,
          projectId: action.plan.task.projectId,
          timestamp: new Date().toISOString(),
          planId: action.planId,
          taskId: action.plan.task.taskId,
        });
      }

      // Clean up the abort controller
      const { removeAbortController } = await import('./actionExecutor.js');
      removeAbortController(action.planId);
      return;
    }

    // Still in progress — schedule another poll if under max attempts
    if (attempt >= MAX_ATTEMPTS) {
      log.warn({ actionId, attempt }, 'CI polling timed out');
      await markActionFailed(prisma, actionId, action.planId, `CI checks did not complete after ${MAX_ATTEMPTS} attempts (30 min)`);
      emitCompletion(action, orgId, userId, false);

      const bus = getEventBus();
      bus.emit('task.action_plan_failed', {
        orgId,
        userId,
        projectId: action.plan.task.projectId,
        timestamp: new Date().toISOString(),
        planId: action.planId,
        taskId: action.plan.task.taskId,
        taskTitle: action.plan.task.title,
        lastFailedActionId: actionId,
        lastFailedActionType: action.actionType,
        errorMessage: 'CI monitoring timed out',
      });
      return;
    }

    log.info(
      { actionId, attempt, totalChecks: checks.total_count },
      'CI checks still running, scheduling next poll',
    );

    const queue = getJobQueue();
    queue.enqueueDelayed('monitor-ci-poll', {
      ...payload,
      attempt: attempt + 1,
    }, POLL_DELAY_MS);
  };
}

async function markActionFailed(prisma: PrismaClient, actionId: string, planId: string, errorMessage: string) {
  await prisma.taskAction.update({
    where: { id: actionId },
    data: { status: 'failed', errorMessage },
  });
  await prisma.taskActionPlan.update({
    where: { id: planId },
    data: { status: 'failed' },
  });
}

function emitCompletion(
  action: { actionType: string; planId: string; plan: { task: { taskId: string; projectId: string } } },
  orgId: string,
  userId: string,
  success: boolean,
) {
  const bus = getEventBus();
  bus.emit('task.action_completed', {
    orgId,
    userId,
    projectId: action.plan.task.projectId,
    timestamp: new Date().toISOString(),
    actionId: action.planId,
    actionType: action.actionType,
    planId: action.planId,
    taskId: action.plan.task.taskId,
    success,
  });
}
