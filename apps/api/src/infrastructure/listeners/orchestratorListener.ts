import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import { createChildLogger } from '../../utils/logger.js';
import { LOCK_IDS, tryAdvisoryLock, releaseAdvisoryLock } from '../../utils/advisoryLock.js';
import { planTaskActions } from '../../ai/index.js';
import { getJobQueue } from '../jobqueue/index.js';
import { getProjectRepo } from '../../github/index.js';
import { retrieveRelevantKnowledge } from '../../ai/knowledgeRetrieval.js';
import { decryptApiKey } from '../../utils/encryption.js';
import { availableTypes } from '../../actions/index.js';
import { getEventBus } from '../eventbus/index.js';
import { orchestratorTasksEnqueued, orchestratorFailures, orchestratorConcurrencyLimitHits } from '../../utils/metrics.js';

const log = createChildLogger('orchestrator-listener');

/** Max concurrent executing action plans per project */
const MAX_CONCURRENT_PER_PROJECT = 3;

/**
 * Simple string hash → positive int, used to create per-project advisory lock IDs.
 */
function hashCode(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function lockIdForProject(projectId: string): number {
  return LOCK_IDS.PROJECT_ORCHESTRATOR + (hashCode(projectId) % 10000);
}

/**
 * Check and enqueue auto-eligible tasks for a project.
 * Must be called under advisory lock.
 */
async function orchestrateProject(
  prisma: PrismaClient,
  projectId: string,
  orgId: string,
  userId: string,
): Promise<void> {
  // Find tasks eligible for auto-complete
  const candidates = await prisma.task.findMany({
    where: {
      projectId,
      autoComplete: true,
      status: { in: ['todo'] },
      archived: false,
    },
    include: {
      project: true,
    },
  });

  if (candidates.length === 0) return;

  // Filter to tasks whose blocking dependencies are all done
  const eligible = [];
  for (const task of candidates) {
    const blockers = await prisma.taskDependency.findMany({
      where: { targetTaskId: task.taskId, linkType: 'blocks' },
      include: { sourceTask: { select: { status: true } } },
    });
    const allBlockersDone = blockers.every((b) => b.sourceTask.status === 'done');
    if (allBlockersDone) {
      eligible.push(task);
    }
  }

  if (eligible.length === 0) return;

  // Check for active session and apply session constraints
  const activeSession = await prisma.session.findFirst({
    where: { projectId, status: 'running' },
  });

  let filteredEligible = eligible;

  if (activeSession) {
    const sessionConfig = JSON.parse(activeSession.config) as {
      budgetCapCents?: number;
      scopeLimit?: number;
    };
    const sessionProgress = activeSession.progress
      ? (JSON.parse(activeSession.progress) as {
          tasksCompleted: number;
          tasksFailed: number;
          tasksSkipped: number;
          tokensUsed: number;
          estimatedCostCents: number;
        })
      : { tasksCompleted: 0, tasksFailed: 0, tasksSkipped: 0, tokensUsed: 0, estimatedCostCents: 0 };
    const sessionTaskIds = JSON.parse(activeSession.taskIds) as string[];

    // Only orchestrate tasks that belong to this session
    filteredEligible = eligible.filter((t) => sessionTaskIds.includes(t.taskId));

    // Check budget cap
    if (
      sessionConfig.budgetCapCents &&
      sessionProgress.estimatedCostCents >= sessionConfig.budgetCapCents
    ) {
      await prisma.session.update({
        where: { id: activeSession.id },
        data: { status: 'paused', pausedAt: new Date() },
      });
      getEventBus().emit('session.paused', {
        orgId,
        userId,
        projectId,
        timestamp: new Date().toISOString(),
        sessionId: activeSession.id,
      });
      log.info({ sessionId: activeSession.id }, 'Session paused — budget cap exceeded');
      return;
    }

    // Check scope limit
    if (sessionConfig.scopeLimit && sessionProgress.tasksCompleted >= sessionConfig.scopeLimit) {
      await prisma.session.update({
        where: { id: activeSession.id },
        data: { status: 'completed', completedAt: new Date() },
      });
      getEventBus().emit('session.completed', {
        orgId,
        userId,
        projectId,
        timestamp: new Date().toISOString(),
        sessionId: activeSession.id,
      });
      log.info({ sessionId: activeSession.id }, 'Session completed — scope limit reached');
      return;
    }

    if (filteredEligible.length === 0) return;
  }

  // Check concurrency limit
  const executing = await prisma.taskActionPlan.count({
    where: { task: { projectId }, status: 'executing' },
  });
  const slots = MAX_CONCURRENT_PER_PROJECT - executing;
  if (slots <= 0) {
    orchestratorConcurrencyLimitHits.inc();
    log.info({ projectId, executing }, 'Concurrency limit reached, skipping orchestration');
    return;
  }

  // Get the org's API key
  const org = await prisma.org.findUnique({
    where: { orgId },
    select: { anthropicApiKeyEncrypted: true, promptLoggingEnabled: true },
  });
  if (!org?.anthropicApiKeyEncrypted) {
    log.warn({ orgId }, 'No API key configured for org, skipping auto-complete');
    return;
  }

  let apiKey: string;
  try {
    apiKey = decryptApiKey(org.anthropicApiKeyEncrypted);
  } catch {
    log.warn({ orgId }, 'Failed to decrypt API key, skipping auto-complete');
    return;
  }

  const queue = getJobQueue();
  const tasksToProcess = filteredEligible.slice(0, slots);

  for (const task of tasksToProcess) {
    try {
      // Check if task already has an executing or approved plan
      const existingPlan = await prisma.taskActionPlan.findFirst({
        where: { taskId: task.taskId, status: { in: ['executing', 'approved'] } },
      });
      if (existingPlan) {
        log.info({ taskId: task.taskId }, 'Task already has an active plan, skipping');
        continue;
      }

      // Generate action plan if task doesn't have one
      const repo = await getProjectRepo(task.projectId);

      let knowledgeBase: string | null = null;
      try {
        const taskContext = `${task.title}. ${task.instructions || task.description || ''}`.slice(0, 500);
        const kbResult = await retrieveRelevantKnowledge(prisma, task.projectId, taskContext, apiKey);
        knowledgeBase = kbResult || null;
      } catch (err) {
        log.warn({ err, taskId: task.taskId }, 'KB retrieval failed for auto-complete task');
      }
      if (!knowledgeBase && task.project.knowledgeBase) {
        knowledgeBase = task.project.knowledgeBase;
      }

      const plc = org.promptLoggingEnabled
        ? { prisma, orgId, userId, promptLoggingEnabled: true }
        : { prisma, orgId, userId, promptLoggingEnabled: false };

      const result = await planTaskActions(
        apiKey,
        {
          taskTitle: task.title,
          taskDescription: task.description ?? '',
          taskInstructions: task.instructions ?? '',
          acceptanceCriteria: task.acceptanceCriteria,
          suggestedTools: task.suggestedTools,
          projectName: task.project.name,
          projectDescription: task.project.description,
          knowledgeBase,
          hasGitHubRepo: !!repo,
          availableActionTypes: availableTypes(),
        },
        plc,
      );

      if (result.actions.length === 0) {
        log.warn({ taskId: task.taskId }, 'AI returned empty action plan for auto-complete task');
        continue;
      }

      // Cancel any existing draft plans
      await prisma.taskActionPlan.updateMany({
        where: { taskId: task.taskId, status: { in: ['draft', 'approved'] } },
        data: { status: 'cancelled' },
      });

      // Create the plan and actions
      const plan = await prisma.taskActionPlan.create({
        data: {
          taskId: task.taskId,
          orgId,
          status: 'executing',
          createdById: userId,
          actions: {
            create: result.actions.map((a, i) => ({
              actionType: a.actionType,
              label: a.label,
              config: JSON.stringify(a.config),
              position: i,
              requiresApproval: a.requiresApproval,
            })),
          },
        },
        include: { actions: { orderBy: { position: 'asc' } } },
      });

      // Enqueue the first action
      const firstAction = plan.actions.find((a) => a.status === 'pending');
      if (firstAction) {
        queue.enqueue('action-execute', {
          planId: plan.id,
          actionId: firstAction.id,
          orgId,
          userId,
        });
        orchestratorTasksEnqueued.inc();
        log.info({ taskId: task.taskId, planId: plan.id }, 'Auto-enqueued action plan for task');

        // Emit SSE event so frontend updates in real-time
        getEventBus().emit('task.updated', {
          orgId,
          userId,
          projectId,
          timestamp: new Date().toISOString(),
          task: {
            taskId: task.taskId,
            title: task.title,
            status: task.status,
            projectId,
            orgId,
            taskType: task.taskType ?? 'task',
          },
          changes: {},
        });
      }
    } catch (err) {
      orchestratorFailures.inc();
      log.error({ err, taskId: task.taskId }, 'Failed to orchestrate auto-complete task');
      // Continue with next task — don't let one failure block others
    }
  }
}

export function register(bus: EventBus, prisma: PrismaClient): void {
  bus.on('task.action_plan_completed', async (event) => {
    const { projectId, orgId, userId, taskId } = event;

    // Update session progress if task belongs to an active session
    try {
      const session = await prisma.session.findFirst({
        where: { status: 'running', projectId },
      });
      if (session) {
        const taskIds = JSON.parse(session.taskIds) as string[];
        if (taskIds.includes(taskId)) {
          const progress = session.progress
            ? (JSON.parse(session.progress) as {
                tasksCompleted: number;
                tasksFailed: number;
                tasksSkipped: number;
                tokensUsed: number;
                estimatedCostCents: number;
              })
            : { tasksCompleted: 0, tasksFailed: 0, tasksSkipped: 0, tokensUsed: 0, estimatedCostCents: 0 };
          progress.tasksCompleted++;
          await prisma.session.update({
            where: { id: session.id },
            data: { progress: JSON.stringify(progress) },
          });

          // Check if all session tasks are done
          const totalProcessed = progress.tasksCompleted + progress.tasksFailed + progress.tasksSkipped;
          if (totalProcessed >= taskIds.length) {
            const finalStatus = progress.tasksFailed > 0 ? 'failed' : 'completed';
            await prisma.session.update({
              where: { id: session.id },
              data: { status: finalStatus, completedAt: new Date() },
            });
            bus.emit(finalStatus === 'failed' ? 'session.failed' : 'session.completed', {
              orgId,
              userId,
              projectId,
              timestamp: new Date().toISOString(),
              sessionId: session.id,
              ...(finalStatus === 'failed' ? { reason: 'Some tasks failed' } : {}),
            } as Parameters<typeof bus.emit>[1]);
            log.info({ sessionId: session.id, finalStatus }, 'Session finished — all tasks processed');
          }
        }
      }
    } catch (err) {
      log.error({ err, taskId }, 'Failed to update session progress on plan completed');
    }

    const lockId = lockIdForProject(projectId);
    const acquired = await tryAdvisoryLock(prisma, lockId);
    if (!acquired) return;
    try {
      await orchestrateProject(prisma, projectId, orgId, userId);
    } catch (err) {
      log.error({ err, projectId }, 'Orchestrator failed on action_plan_completed');
    } finally {
      await releaseAdvisoryLock(prisma, lockId);
    }
  });

  bus.on('task.updated', async (event) => {
    // Only trigger when a task moves to 'done'
    const statusChange = event.changes?.status;
    if (!statusChange || statusChange.new !== 'done') return;

    const { projectId, orgId, userId } = event;
    const lockId = lockIdForProject(projectId);
    const acquired = await tryAdvisoryLock(prisma, lockId);
    if (!acquired) return;
    try {
      await orchestrateProject(prisma, projectId, orgId, userId);
    } catch (err) {
      log.error({ err, projectId }, 'Orchestrator failed on task.updated');
    } finally {
      await releaseAdvisoryLock(prisma, lockId);
    }
  });

  bus.on('task.action_plan_failed', async (event) => {
    const { taskId, orgId, userId, projectId } = event;

    // Handle session failure policy
    try {
      const session = await prisma.session.findFirst({
        where: { status: 'running', projectId },
      });
      if (session) {
        const taskIds = JSON.parse(session.taskIds) as string[];
        if (taskIds.includes(taskId)) {
          const config = JSON.parse(session.config) as { failurePolicy: string; maxRetries?: number };
          const progress = session.progress
            ? (JSON.parse(session.progress) as {
                tasksCompleted: number;
                tasksFailed: number;
                tasksSkipped: number;
                tokensUsed: number;
                estimatedCostCents: number;
              })
            : { tasksCompleted: 0, tasksFailed: 0, tasksSkipped: 0, tokensUsed: 0, estimatedCostCents: 0 };

          if (config.failurePolicy === 'pause_immediately') {
            progress.tasksFailed++;
            await prisma.session.update({
              where: { id: session.id },
              data: { status: 'paused', pausedAt: new Date(), progress: JSON.stringify(progress) },
            });
            bus.emit('session.paused', {
              orgId,
              userId,
              projectId,
              timestamp: new Date().toISOString(),
              sessionId: session.id,
            });
            log.info({ sessionId: session.id, taskId }, 'Session paused — task failed (pause_immediately policy)');
          } else if (config.failurePolicy === 'skip_and_continue') {
            progress.tasksSkipped++;
            await prisma.session.update({
              where: { id: session.id },
              data: { progress: JSON.stringify(progress) },
            });

            // Check if all tasks processed
            const totalProcessed = progress.tasksCompleted + progress.tasksFailed + progress.tasksSkipped;
            if (totalProcessed >= taskIds.length) {
              await prisma.session.update({
                where: { id: session.id },
                data: { status: 'completed', completedAt: new Date() },
              });
              bus.emit('session.completed', {
                orgId,
                userId,
                projectId,
                timestamp: new Date().toISOString(),
                sessionId: session.id,
              });
            }
            log.info({ sessionId: session.id, taskId }, 'Task skipped in session (skip_and_continue policy)');
          } else {
            // retry_then_pause — increment failure, the existing retry logic handles actual retries
            progress.tasksFailed++;
            await prisma.session.update({
              where: { id: session.id },
              data: { progress: JSON.stringify(progress) },
            });
          }
        }
      }
    } catch (err) {
      log.error({ err, taskId }, 'Failed to handle session failure policy');
    }

    try {
      // Find tasks that are blocked by the failed task
      const dependents = await prisma.taskDependency.findMany({
        where: { sourceTaskId: taskId, linkType: 'blocks' },
        include: { targetTask: { select: { taskId: true, title: true, autoComplete: true } } },
      });

      const autoCompleteDependents = dependents.filter((d) => d.targetTask.autoComplete);
      if (autoCompleteDependents.length === 0) return;

      const failedTask = await prisma.task.findUnique({
        where: { taskId },
        select: { title: true },
      });

      for (const dep of autoCompleteDependents) {
        bus.emit('task.blocked', {
          orgId,
          userId,
          projectId,
          timestamp: new Date().toISOString(),
          taskId: dep.targetTask.taskId,
          taskTitle: dep.targetTask.title,
          blockerTaskId: taskId,
          blockerTaskTitle: failedTask?.title ?? event.taskTitle,
          reason: 'dependency_failed',
        });
      }

      log.warn(
        { taskId, blockedCount: autoCompleteDependents.length },
        'Emitted task.blocked for dependents of failed action plan',
      );
    } catch (err) {
      log.error({ err, taskId }, 'Failed to process action_plan_failed for dependents');
    }
  });

  bus.on('session.started', async (event) => {
    const { projectId, orgId, userId } = event;
    const lockId = lockIdForProject(projectId);
    const acquired = await tryAdvisoryLock(prisma, lockId);
    if (!acquired) return;
    try {
      await orchestrateProject(prisma, projectId, orgId, userId);
    } catch (err) {
      log.error({ err, projectId }, 'Orchestrator failed on session.started');
    } finally {
      await releaseAdvisoryLock(prisma, lockId);
    }
  });

  log.info('Orchestrator listener registered');
}
