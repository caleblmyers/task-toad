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
import { abortPlan } from '../jobs/actionExecutor.js';
import { deleteBranch } from '../../github/githubCommitService.js';
import type { GitHubRepoLink } from '../../github/githubTypes.js';
import { replanFailedTask } from '../../actions/replanService.js';

const log = createChildLogger('orchestrator-listener');

/**
 * Atomically increment a session progress counter using raw SQL to avoid
 * read-modify-write race conditions under concurrent plan completions.
 */
async function atomicIncrementProgress(
  prisma: PrismaClient,
  sessionId: string,
  field: 'tasksCompleted' | 'tasksFailed' | 'tasksSkipped',
): Promise<void> {
  const defaultJson = '{"tasksCompleted":0,"tasksFailed":0,"tasksSkipped":0,"tokensUsed":0,"estimatedCostCents":0}';
  await prisma.$executeRaw`
    UPDATE sessions SET progress = jsonb_set(
      COALESCE(progress::jsonb, ${defaultJson}::jsonb),
      ${`{${field}}`}::text[],
      (COALESCE((progress::jsonb->>${field})::int, 0) + 1)::text::jsonb
    )
    WHERE session_id = ${sessionId}
  `;
}

/**
 * Read fresh session progress after an atomic increment.
 */
async function readSessionProgress(
  prisma: PrismaClient,
  sessionId: string,
): Promise<{ tasksCompleted: number; tasksFailed: number; tasksSkipped: number; tokensUsed: number; estimatedCostCents: number }> {
  const session = await prisma.session.findUnique({ where: { id: sessionId }, select: { progress: true } });
  if (!session?.progress) {
    return { tasksCompleted: 0, tasksFailed: 0, tasksSkipped: 0, tokensUsed: 0, estimatedCostCents: 0 };
  }
  return JSON.parse(session.progress) as {
    tasksCompleted: number; tasksFailed: number; tasksSkipped: number; tokensUsed: number; estimatedCostCents: number;
  };
}

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
 * Cancel running action plans for a set of tasks, abort in-flight actions,
 * and delete their GitHub branches. Used by both the cancelSession resolver
 * and the orchestrator listener (budget cap / timeout pauses).
 */
export async function cancelSessionPlans(
  prisma: PrismaClient,
  taskIds: string[],
): Promise<void> {
  // Load plans with branches before cancelling
  const plansWithBranches = await prisma.taskActionPlan.findMany({
    where: {
      taskId: { in: taskIds },
      status: { in: ['approved', 'executing'] },
      branchName: { not: null },
    },
    select: {
      id: true,
      branchName: true,
      task: {
        select: {
          project: {
            select: {
              githubRepositoryId: true,
              githubRepositoryName: true,
              githubRepositoryOwner: true,
              githubInstallationId: true,
              githubDefaultBranch: true,
            },
          },
        },
      },
    },
  });

  // Cancel plans in DB
  await prisma.taskActionPlan.updateMany({
    where: {
      taskId: { in: taskIds },
      status: { in: ['approved', 'executing'] },
    },
    data: { status: 'cancelled' },
  });

  // Abort any in-flight actions
  for (const plan of plansWithBranches) {
    abortPlan(plan.id);
  }

  // Clean up GitHub branches (non-blocking)
  for (const plan of plansWithBranches) {
    if (!plan.branchName) continue;
    try {
      const p = plan.task.project;
      if (p.githubRepositoryId && p.githubInstallationId) {
        const repo: GitHubRepoLink = {
          repositoryId: p.githubRepositoryId,
          repositoryName: p.githubRepositoryName ?? '',
          repositoryOwner: p.githubRepositoryOwner ?? '',
          installationId: p.githubInstallationId,
          defaultBranch: p.githubDefaultBranch ?? 'main',
        };
        await deleteBranch(repo, plan.branchName);
        log.info({ planId: plan.id, branchName: plan.branchName }, 'Deleted branch on session cancellation');
      }
    } catch (err) {
      log.warn({ err, planId: plan.id, branchName: plan.branchName }, 'Failed to delete branch on session cancellation (non-blocking)');
    }
  }
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
      include: { sourceTask: { select: { taskId: true, title: true, status: true } } },
    });
    const unmetBlockers = blockers.filter((b) => b.sourceTask.status !== 'done');
    if (unmetBlockers.length === 0) {
      eligible.push(task);
    } else {
      // Emit task.blocked for each unmet dependency so the user knows why
      for (const blocker of unmetBlockers) {
        getEventBus().emit('task.blocked', {
          orgId,
          userId,
          projectId,
          timestamp: new Date().toISOString(),
          taskId: task.taskId,
          taskTitle: task.title,
          blockerTaskId: blocker.sourceTask.taskId,
          blockerTaskTitle: blocker.sourceTask.title,
          reason: 'dependency_failed',
        });
      }
      log.info(
        { taskId: task.taskId, unmetCount: unmetBlockers.length },
        'Task skipped — blocking dependencies not yet done',
      );
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
      timeLimitMinutes?: number;
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
      await cancelSessionPlans(prisma, sessionTaskIds);
      log.info({ sessionId: activeSession.id }, 'Session paused — budget cap exceeded');
      return;
    }

    // Check time limit
    if (sessionConfig.timeLimitMinutes && activeSession.startedAt) {
      const elapsedMs = Date.now() - new Date(activeSession.startedAt).getTime();
      const elapsedMinutes = elapsedMs / 60_000;
      if (elapsedMinutes >= sessionConfig.timeLimitMinutes) {
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
        await cancelSessionPlans(prisma, sessionTaskIds);
        log.info({ sessionId: activeSession.id, elapsedMinutes, limitMinutes: sessionConfig.timeLimitMinutes }, 'Session paused — time limit reached');
        return;
      }
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
          // Atomic increment to avoid lost-update race under concurrent completions
          await atomicIncrementProgress(prisma, session.id, 'tasksCompleted');

          // Aggregate token/cost usage from AIPromptLog for this task's action plan
          try {
            const usageAgg = await prisma.aIPromptLog.aggregate({
              where: { taskId },
              _sum: { inputTokens: true, outputTokens: true, costUSD: true },
            });
            const tokensUsed = (usageAgg._sum?.inputTokens ?? 0) + (usageAgg._sum?.outputTokens ?? 0);
            const costCents = Math.round(Number(usageAgg._sum?.costUSD ?? 0) * 100);
            if (tokensUsed > 0 || costCents > 0) {
              const defaultJson = '{"tasksCompleted":0,"tasksFailed":0,"tasksSkipped":0,"tokensUsed":0,"estimatedCostCents":0}';
              await prisma.$executeRaw`
                UPDATE sessions SET progress = jsonb_set(
                  jsonb_set(
                    COALESCE(progress::jsonb, ${defaultJson}::jsonb),
                    '{tokensUsed}',
                    (COALESCE((progress::jsonb->>'tokensUsed')::int, 0) + ${tokensUsed})::text::jsonb
                  ),
                  '{estimatedCostCents}',
                  (COALESCE((progress::jsonb->>'estimatedCostCents')::numeric, 0) + ${costCents})::text::jsonb
                )
                WHERE session_id = ${session.id}
              `;
            }
          } catch (usageErr) {
            log.warn({ err: usageErr, taskId, sessionId: session.id }, 'Failed to aggregate token/cost usage for session (non-blocking)');
          }

          // Re-read fresh progress after atomic update
          const progress = await readSessionProgress(prisma, session.id);

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

          if (config.failurePolicy === 'pause_immediately') {
            await atomicIncrementProgress(prisma, session.id, 'tasksFailed');
            await prisma.session.update({
              where: { id: session.id },
              data: { status: 'paused', pausedAt: new Date() },
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
            await atomicIncrementProgress(prisma, session.id, 'tasksSkipped');

            // Re-read fresh progress after atomic update
            const updatedProgress = await readSessionProgress(prisma, session.id);

            // Check if all tasks processed
            const totalProcessed = updatedProgress.tasksCompleted + updatedProgress.tasksFailed + updatedProgress.tasksSkipped;
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
            await atomicIncrementProgress(prisma, session.id, 'tasksFailed');
          }
        }
      }
    } catch (err) {
      log.error({ err, taskId }, 'Failed to handle session failure policy');
    }

    // Auto-replan: generate a new plan if under the replan limit
    const MAX_REPLANS = 2;
    try {
      // Count previous cancelled plans for this task as replan attempts
      const failedPlan = await prisma.taskActionPlan.findUnique({
        where: { id: event.planId },
        select: { taskId: true },
      });
      if (failedPlan) {
        const replanCount = await prisma.taskActionPlan.count({
          where: { taskId: failedPlan.taskId, status: 'cancelled' },
        });

        if (replanCount < MAX_REPLANS) {
          // Get the org's API key
          const org = await prisma.org.findUnique({
            where: { orgId },
            select: { anthropicApiKeyEncrypted: true, promptLoggingEnabled: true },
          });
          if (org?.anthropicApiKeyEncrypted) {
            const apiKey = decryptApiKey(org.anthropicApiKeyEncrypted);
            const result = await replanFailedTask(prisma, event.planId, orgId, userId, apiKey, org.promptLoggingEnabled ?? true);

            // Emit replanned event
            bus.emit('task.action_plan_replanned', {
              orgId,
              userId,
              projectId,
              timestamp: new Date().toISOString(),
              planId: event.planId,
              newPlanId: result.planId,
              taskId: result.taskId,
              taskTitle: event.taskTitle,
              attempt: replanCount + 1,
            });

            // Auto-execute the new plan
            const newPlan = await prisma.taskActionPlan.update({
              where: { id: result.planId },
              data: { status: 'executing' },
              include: { actions: { orderBy: { position: 'asc' } } },
            });
            const firstAction = newPlan.actions.find((a) => a.status === 'pending');
            if (firstAction) {
              const queue = getJobQueue();
              queue.enqueue('action-execute', {
                planId: result.planId,
                actionId: firstAction.id,
                orgId,
                userId,
              });
              orchestratorTasksEnqueued.inc();
            }

            log.info({ taskId: result.taskId, oldPlanId: event.planId, newPlanId: result.planId, attempt: replanCount + 1 }, 'Auto-replanned failed task');
            return; // Skip dependent-blocking since we're retrying
          }
        } else {
          log.info({ taskId: failedPlan.taskId, replanCount }, 'Auto-replan limit reached, not replanning');
        }
      }
    } catch (err) {
      log.warn({ err, planId: event.planId }, 'Auto-replan failed, falling through to dependent blocking');
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

  // ── CI webhook-driven flow: advance plan when CI passes ──
  bus.on('task.ci_passed', async (event) => {
    const { taskId, orgId, projectId } = event;

    try {
      // Find the task's active action plan with an executing monitor_ci action
      const plan = await prisma.taskActionPlan.findFirst({
        where: { taskId, status: 'executing' },
        include: { actions: { orderBy: { position: 'asc' } } },
      });
      if (!plan) return;

      const monitorAction = plan.actions.find(
        (a) => a.actionType === 'monitor_ci' && a.status === 'executing',
      );
      if (!monitorAction) return;

      // Mark monitor_ci as completed (CI passed via webhook)
      await prisma.taskAction.update({
        where: { id: monitorAction.id },
        data: {
          status: 'completed',
          result: JSON.stringify({ ciPassed: true, via: 'webhook', conclusion: event.conclusion, headSha: event.headSha }),
          completedAt: new Date(),
        },
      });

      // Emit action completed event
      bus.emit('task.action_completed', {
        orgId,
        userId: event.userId,
        projectId,
        timestamp: new Date().toISOString(),
        actionId: monitorAction.id,
        actionType: 'monitor_ci',
        planId: plan.id,
        taskId,
        success: true,
      });

      // Enqueue the next pending action (likely merge_pr)
      const nextAction = plan.actions.find(
        (a) => a.position > monitorAction.position && a.status === 'pending',
      );
      if (nextAction) {
        const queue = getJobQueue();
        queue.enqueue('action-execute', {
          planId: plan.id,
          actionId: nextAction.id,
          orgId,
          userId: plan.createdById,
        });
        log.info({ taskId, planId: plan.id, nextActionId: nextAction.id }, 'CI passed via webhook — enqueued next action');
      }
    } catch (err) {
      log.error({ err, taskId }, 'Failed to handle task.ci_passed event');
    }
  });

  // ── CI failed: mark monitor_ci as failed, trigger fix_ci if available ──
  bus.on('task.ci_failed', async (event) => {
    const { taskId, orgId, projectId } = event;

    try {
      const plan = await prisma.taskActionPlan.findFirst({
        where: { taskId, status: 'executing' },
        include: { actions: { orderBy: { position: 'asc' } } },
      });
      if (!plan) return;

      const monitorAction = plan.actions.find(
        (a) => a.actionType === 'monitor_ci' && a.status === 'executing',
      );
      if (!monitorAction) return;

      // Mark monitor_ci as failed
      await prisma.taskAction.update({
        where: { id: monitorAction.id },
        data: {
          status: 'failed',
          errorMessage: `CI failed: ${event.conclusion}`,
          result: JSON.stringify({ ciPassed: false, via: 'webhook', conclusion: event.conclusion, headSha: event.headSha }),
        },
      });

      bus.emit('task.action_completed', {
        orgId,
        userId: event.userId,
        projectId,
        timestamp: new Date().toISOString(),
        actionId: monitorAction.id,
        actionType: 'monitor_ci',
        planId: plan.id,
        taskId,
        success: false,
      });

      // Check for a pending fix_ci action after the failed monitor_ci
      const fixCIAction = plan.actions.find(
        (a) => a.position > monitorAction.position && a.actionType === 'fix_ci' && a.status === 'pending',
      );

      if (fixCIAction) {
        // Check if we've already exhausted fix_ci retries
        const MAX_CI_FIX_ATTEMPTS = 3;
        const fixCIAttempts = plan.actions.filter(
          (a) => a.actionType === 'fix_ci' && (a.status === 'completed' || a.status === 'failed'),
        ).length;

        if (fixCIAttempts >= MAX_CI_FIX_ATTEMPTS) {
          // Too many fix attempts — fail the plan
          await prisma.taskActionPlan.update({ where: { id: plan.id }, data: { status: 'failed' } });
          bus.emit('task.action_plan_failed', {
            orgId,
            userId: event.userId,
            projectId,
            timestamp: new Date().toISOString(),
            planId: plan.id,
            taskId,
            taskTitle: '',
            lastFailedActionId: monitorAction.id,
            lastFailedActionType: 'monitor_ci',
            errorMessage: `CI fix attempts exhausted (${fixCIAttempts}/${MAX_CI_FIX_ATTEMPTS})`,
          });
          log.warn({ planId: plan.id, taskId, attempts: fixCIAttempts }, 'CI fix attempts exhausted — failing plan');
          return;
        }

        // Enqueue fix_ci — it will read CI logs and attempt a fix
        const queue = getJobQueue();
        queue.enqueue('action-execute', {
          planId: plan.id,
          actionId: fixCIAction.id,
          orgId,
          userId: plan.createdById,
        });
        log.info({ taskId, planId: plan.id, fixCIActionId: fixCIAction.id, conclusion: event.conclusion, attempt: fixCIAttempts + 1 }, 'CI failed via webhook — triggering fix_ci recovery');
      } else {
        // No fix_ci in plan — mark plan as failed, auto-replan will handle it
        await prisma.taskActionPlan.update({
          where: { id: plan.id },
          data: { status: 'failed' },
        });

        bus.emit('task.action_plan_failed', {
          orgId,
          userId: event.userId,
          projectId,
          timestamp: new Date().toISOString(),
          planId: plan.id,
          taskId,
          taskTitle: '',
          lastFailedActionId: monitorAction.id,
          lastFailedActionType: 'monitor_ci',
          errorMessage: `CI failed: ${event.conclusion}`,
        });

        log.info({ taskId, planId: plan.id, conclusion: event.conclusion }, 'CI failed via webhook — no fix_ci available, plan marked as failed');
      }
    } catch (err) {
      log.error({ err, taskId }, 'Failed to handle task.ci_failed event');
    }
  });

  // ── External PR merge: advance plan past merge, continue remaining actions ──
  bus.on('task.pr_merged', async (event) => {
    const { taskId, orgId, projectId } = event;

    try {
      // Check if there's an active plan with a pending or executing merge_pr action
      const plan = await prisma.taskActionPlan.findFirst({
        where: { taskId, status: 'executing' },
        include: { actions: { orderBy: { position: 'asc' } } },
      });
      if (!plan) return;

      // Find the merge_pr action
      const mergeAction = plan.actions.find(
        (a) => a.actionType === 'merge_pr' && (a.status === 'pending' || a.status === 'executing'),
      );

      // Auto-complete any monitor_ci actions before/at merge_pr (CI must have passed if PR was merged)
      const monitorActions = plan.actions.filter(
        (a) => a.actionType === 'monitor_ci' &&
               (a.status === 'pending' || a.status === 'executing') &&
               (!mergeAction || a.position <= mergeAction.position),
      );
      for (const action of monitorActions) {
        await prisma.taskAction.update({
          where: { id: action.id },
          data: {
            status: 'completed',
            result: JSON.stringify({ via: 'external_merge', ciPassed: true, prNumber: event.prNumber }),
            completedAt: new Date(),
          },
        });
      }

      // Complete the merge_pr action
      if (mergeAction) {
        await prisma.taskAction.update({
          where: { id: mergeAction.id },
          data: {
            status: 'completed',
            result: JSON.stringify({ merged: true, via: 'external_merge', prNumber: event.prNumber }),
            completedAt: new Date(),
          },
        });
      }

      // Determine the position threshold — actions after merge_pr may still need to run (e.g. write_docs)
      const mergePosition = mergeAction?.position ?? -1;

      // Check for remaining pending actions after merge_pr
      const nextAction = plan.actions.find(
        (a) => a.position > mergePosition && a.status === 'pending',
      );

      if (nextAction) {
        // Continue executing remaining post-merge actions (e.g., write_docs, verify_build)
        const queue = getJobQueue();
        queue.enqueue('action-execute', {
          planId: plan.id,
          actionId: nextAction.id,
          orgId,
          userId: plan.createdById,
        });
        log.info({ taskId, planId: plan.id, prNumber: event.prNumber, nextActionId: nextAction.id, nextActionType: nextAction.actionType }, 'External PR merge — continuing with post-merge actions');
      } else {
        // No more actions — complete the plan
        await prisma.taskActionPlan.update({
          where: { id: plan.id },
          data: { status: 'completed' },
        });

        bus.emit('task.action_plan_completed', {
          orgId,
          userId: event.userId,
          projectId,
          timestamp: new Date().toISOString(),
          planId: plan.id,
          taskId,
          taskTitle: '',
        });

        log.info({ taskId, planId: plan.id, prNumber: event.prNumber }, 'External PR merge — all actions done, plan completed');
      }
    } catch (err) {
      log.error({ err, taskId }, 'Failed to handle task.pr_merged event');
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
