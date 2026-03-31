import type { PrismaClient } from '@prisma/client';
import { GraphQLError } from 'graphql';
import { createChildLogger } from '../../utils/logger.js';
import { getExecutor } from '../../actions/index.js';
import type { ActionType, ActionContext } from '../../actions/types.js';
import { checkBudget } from '../../ai/aiUsageTracker.js';
import { isRetryableAIError } from '../../ai/aiClient.js';
import { getEventBus } from '../eventbus/index.js';
import { getJobQueue } from '../jobqueue/index.js';
import { retrieveRelevantKnowledge } from '../../ai/knowledgeRetrieval.js';
import { generateTaskInsights, generateCompletionSummary } from '../../ai/aiService.js';
import { createBranch, deleteBranch } from '../../github/githubCommitService.js';
import type { GitHubRepoLink } from '../../github/githubTypes.js';

const log = createChildLogger('action-executor');

// ── KB retrieval cache per plan ──
// Avoids repeated AI calls for each action step in the same plan.
const kbCache = new Map<string, string | null>();

const STATUS_TO_COLUMN: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

// ── AbortController management for cancellation ──
const activeControllers = new Map<string, AbortController>();

/** Get the AbortController for a plan (used by monitorCIPoll). */
export function getAbortController(planId: string): AbortController | undefined {
  return activeControllers.get(planId);
}

/** Remove the AbortController for a plan (cleanup after completion). */
export function removeAbortController(planId: string): void {
  activeControllers.delete(planId);
}

/** Abort the active action for a plan (called from cancelActionPlan resolver). */
export function abortPlan(planId: string): void {
  const controller = activeControllers.get(planId);
  if (controller) {
    controller.abort();
    activeControllers.delete(planId);
    log.info({ planId }, 'Aborted active action for plan');
  }
}

export function createHandler(prisma: PrismaClient) {
  return async (payload: { planId: string; actionId: string; orgId: string; userId: string }) => {
    const { planId, actionId, orgId, userId } = payload;

    // Load action + plan + task + project
    const action = await prisma.taskAction.findUnique({
      where: { id: actionId },
      include: {
        plan: {
          include: {
            task: {
              include: {
                project: true,
              },
            },
          },
        },
      },
    });

    if (!action || action.plan.status === 'cancelled') {
      log.warn({ actionId, planId }, 'Action not found or plan cancelled');
      return;
    }

    if (action.status !== 'pending') {
      log.warn({ actionId, status: action.status }, 'Action not in pending state');
      return;
    }

    // Wrap entire execution so setup failures (branch creation, auth) mark the plan as failed
    // instead of leaving it stuck in 'executing' with all actions 'pending'.
    try {

    const task = action.plan.task;
    const project = task.project;
    const plan = action.plan;

    // Build GitHubRepoLink from project fields
    const repo: GitHubRepoLink | null =
      project.githubRepositoryId && project.githubInstallationId
        ? {
            repositoryId: project.githubRepositoryId,
            repositoryName: project.githubRepositoryName ?? '',
            repositoryOwner: project.githubRepositoryOwner ?? '',
            installationId: project.githubInstallationId,
            defaultBranch: project.githubDefaultBranch ?? 'main',
          }
        : null;

    // Create feature branch on first action of a plan when repo is connected
    if (repo && !plan.branchName) {
      // Re-read plan to guard against concurrent execution
      const freshPlan = await prisma.taskActionPlan.findUnique({
        where: { id: plan.id },
        select: { branchName: true, headOid: true },
      });
      if (freshPlan?.branchName) {
        // Another action already created the branch
        plan.branchName = freshPlan.branchName;
        plan.headOid = freshPlan.headOid;
      } else {
        const { branchName, baseOid } = await createBranch(repo, task.taskId, task.title);
        await prisma.taskActionPlan.update({
          where: { id: plan.id },
          data: { branchName, headOid: baseOid },
        });
        plan.branchName = branchName;
        plan.headOid = baseOid;
      }
    }

    // Check budget for AI-consuming actions
    const actionType = action.actionType as ActionType;
    if (actionType === 'generate_code' || actionType === 'write_docs' || actionType === 'review_pr') {
      const budget = await checkBudget(prisma, orgId);
      if (!budget.allowed) {
        await prisma.taskAction.update({
          where: { id: actionId },
          data: { status: 'failed', errorMessage: 'AI budget exceeded' },
        });
        await prisma.taskActionPlan.update({
          where: { id: planId },
          data: { status: 'failed' },
        });
        return;
      }
    }

    // Get the executor
    const executor = getExecutor(actionType);
    if (!executor) {
      await prisma.taskAction.update({
        where: { id: actionId },
        data: { status: 'failed', errorMessage: `Unknown action type: ${actionType}` },
      });
      return;
    }

    // Build previous results map
    const previousActions = await prisma.taskAction.findMany({
      where: { planId, status: 'completed', position: { lt: action.position } },
      orderBy: { position: 'asc' },
    });
    const previousResults = new Map<string, unknown>();
    const previousSummaries: string[] = [];
    for (const prev of previousActions) {
      if (prev.result) {
        try {
          const parsed = JSON.parse(prev.result) as Record<string, unknown>;
          previousResults.set(prev.id, parsed);
          const summary = (parsed.summary as string) || '';
          const files =
            (parsed.files as Array<{ path: string }>) ||
            (parsed.data as { files?: Array<{ path: string }> } | undefined)?.files ||
            [];
          if (summary || files.length > 0) {
            const fileList = files.map((f) => f.path).join(', ');
            previousSummaries.push(
              `Step "${prev.label}" (${prev.actionType}): ${summary}${fileList ? ` [Files: ${fileList}]` : ''}`,
            );
          }
        } catch {
          // ignore parse errors
        }
      }
    }

    // Get API key from org (decrypt if present)
    const org = await prisma.org.findUnique({
      where: { orgId },
      select: { anthropicApiKeyEncrypted: true },
    });

    let apiKey = '';
    if (org?.anthropicApiKeyEncrypted) {
      const { decryptApiKey } = await import('../../utils/encryption.js');
      try {
        apiKey = decryptApiKey(org.anthropicApiKeyEncrypted);
      } catch {
        log.warn({ orgId }, 'Failed to decrypt API key');
      }
    }

    // Retrieve relevant KB context for the task (cached per plan to avoid repeated AI calls)
    let knowledgeContext: string | null = null;
    if (kbCache.has(planId)) {
      knowledgeContext = kbCache.get(planId) ?? null;
    } else if (apiKey) {
      try {
        const taskContext = `${task.title}. ${task.instructions || task.description || ''}`.slice(0, 500);
        const kbResult = await retrieveRelevantKnowledge(prisma, task.projectId, taskContext, apiKey);
        knowledgeContext = kbResult || null;
        kbCache.set(planId, knowledgeContext);
      } catch (err) {
        log.warn({ err, taskId: task.taskId }, 'KB retrieval failed, falling back to legacy knowledgeBase');
      }
    }
    // Fall back to legacy field when KB entries return empty
    if (!knowledgeContext && project.knowledgeBase) {
      knowledgeContext = project.knowledgeBase;
    }

    // Load upstream task completion summaries for cross-task context
    // Note: completionSummary column is added by a separate migration — use raw query
    // to avoid Prisma type errors until the migration is applied.
    let upstreamTaskContext: string | undefined;
    try {
      const upstreamRows = await prisma.$queryRaw<
        Array<{ title: string; completion_summary: string | null; status: string }>
      >`
        SELECT t.title, t.completion_summary, t.status
        FROM task_dependencies td
        JOIN tasks t ON t.task_id = td.source_task_id
        WHERE td.target_task_id = ${task.taskId}
          AND td.link_type IN ('blocks', 'informs')
          AND t.status = 'done'
          AND t.completion_summary IS NOT NULL
      `;

      const completedUpstream = upstreamRows.map((row) => {
        const summary = JSON.parse(row.completion_summary!) as Record<string, unknown>;
        const filesChanged = (summary.filesChanged as string[]) || [];
        const filesSection = filesChanged.length > 0
          ? `Files changed:\n${filesChanged.map((f) => `  - ${f}`).join('\n')}\n`
          : '';
        const apiContracts = summary.apiContracts
          ? `API contracts:\n${JSON.stringify(summary.apiContracts, null, 2)}\n`
          : '';
        return (
          `## Upstream: ${row.title}\n` +
          `What was built: ${(summary.whatWasBuilt as string) || 'N/A'}\n` +
          filesSection +
          apiContracts +
          (summary.keyDecisions ? `Key decisions: ${((summary.keyDecisions as string[]) || []).join('; ')}\n` : '') +
          (summary.dependencyInfo ? `Note: ${summary.dependencyInfo as string}\n` : '')
        );
      });

      if (completedUpstream.length > 0) {
        upstreamTaskContext = completedUpstream.join('\n');
      }
    } catch (err) {
      log.warn({ err, taskId: task.taskId }, 'Failed to load upstream task context (non-blocking)');
    }

    // Load previous failed attempt context for this action (if retrying)
    let failureContext: string | undefined;
    const previousAttempt = await prisma.taskAction.findUnique({
      where: { id: actionId },
      select: { result: true },
    });
    if (previousAttempt?.result) {
      try {
        const parsed = JSON.parse(previousAttempt.result) as Record<string, unknown>;
        if (parsed.failed) {
          failureContext = `Previous attempt failed: ${parsed.error}${parsed.errorCode ? `. Error code: ${parsed.errorCode}` : ''}. Avoid the same approach.`;
        }
      } catch {
        // ignore parse errors
      }
    }

    // Create AbortController for this plan's active action
    const abortController = new AbortController();
    activeControllers.set(planId, abortController);

    const ctx: ActionContext = {
      action: { id: action.id, actionType: action.actionType, config: action.config, label: action.label },
      planId,
      task: { taskId: task.taskId, title: task.title, description: task.description, instructions: task.instructions, projectId: task.projectId },
      project: { projectId: project.projectId, name: project.name, description: project.description, knowledgeBase: project.knowledgeBase },
      knowledgeContext,
      repo,
      plan: { id: plan.id, branchName: plan.branchName, headOid: plan.headOid },
      apiKey,
      orgId,
      userId,
      prisma,
      previousResults,
      previousStepContext: previousSummaries.length > 0 ? previousSummaries.join('\n') : undefined,
      upstreamTaskContext,
      failureContext,
      signal: abortController.signal,
    };

    // Mark as executing
    await prisma.taskAction.update({
      where: { id: actionId },
      data: { status: 'executing', startedAt: new Date() },
    });

    // Emit action started event for real-time UI updates
    const startBus = getEventBus();
    startBus.emit('task.action_started', {
      orgId,
      userId,
      projectId: task.projectId,
      timestamp: new Date().toISOString(),
      actionId,
      actionType: action.actionType,
      actionLabel: action.label,
      planId,
      taskId: task.taskId,
    });

    // Transition task status based on which action is starting
    {
      const currentTask = await prisma.task.findUnique({ where: { taskId: task.taskId }, select: { status: true } });
      const currentStatus = currentTask?.status ?? task.status;
      let newStatus: string | null = null;

      if (currentStatus === 'todo') {
        newStatus = 'in_progress';
      } else if (actionType === 'review_pr' && currentStatus === 'in_progress') {
        newStatus = 'in_review';
      }

      if (newStatus) {
        await prisma.task.update({
          where: { taskId: task.taskId },
          data: { status: newStatus, sprintColumn: STATUS_TO_COLUMN[newStatus] ?? undefined },
        });
        startBus.emit('task.updated', {
          orgId, userId, projectId: task.projectId, timestamp: new Date().toISOString(),
          task: { taskId: task.taskId, title: task.title, status: newStatus, projectId: task.projectId, orgId: task.orgId, taskType: task.taskType },
          changes: { status: { old: currentStatus, new: newStatus } },
        });
      }
    }

    try {
      // Check if already aborted before executing
      if (abortController.signal.aborted) {
        throw new DOMException('Action cancelled', 'AbortError');
      }

      const result = await executor.execute(ctx);

      // monitor_ci returns "polling" status when CI is still running —
      // the action stays in "executing" and the poll job will complete it.
      if (result.success && (result.data as { status?: string }).status === 'polling') {
        log.info({ actionId, planId }, 'Action deferred to poll job, leaving in executing status');
        return; // don't clean up controller — the poll job needs it
      }

      if (result.success) {
        // Update plan's headOid if the action committed to the branch
        if (result.data?.headOid && typeof result.data.headOid === 'string') {
          await prisma.taskActionPlan.update({
            where: { id: planId },
            data: { headOid: result.data.headOid },
          });
        }

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
            errorMessage: (result.data.error as string) || 'Action failed',
          },
        });
      }

      // Emit action completed event
      const bus = getEventBus();
      bus.emit('task.action_completed', {
        orgId,
        userId,
        projectId: task.projectId,
        timestamp: new Date().toISOString(),
        actionId,
        actionType: action.actionType,
        planId,
        taskId: task.taskId,
        success: result.success,
      });

      if (!result.success) {
        activeControllers.delete(planId);
        kbCache.delete(planId);
        await prisma.taskActionPlan.update({
          where: { id: planId },
          data: { status: 'failed' },
        });

        bus.emit('task.action_plan_failed', {
          orgId,
          userId,
          projectId: task.projectId,
          timestamp: new Date().toISOString(),
          planId,
          taskId: task.taskId,
          taskTitle: task.title,
          lastFailedActionId: actionId,
          lastFailedActionType: action.actionType,
          errorMessage: (result.data.error as string) || 'Action failed',
        });
        return;
      }

      // Generate insights after successful generate_code action
      if (actionType === 'generate_code' && apiKey) {
        try {
          const codeResult = result.data as { files?: Array<{ path: string; language?: string }>; summary?: string };
          const siblingTasks = task.parentTaskId
            ? await prisma.task.findMany({
                where: { parentTaskId: task.parentTaskId, taskId: { not: task.taskId }, archived: false },
                select: { taskId: true, title: true },
              })
            : [];
          const siblingTitles = siblingTasks.map((t) => t.title);

          if (codeResult.files && codeResult.files.length > 0 && siblingTitles.length > 0) {
            const insightsResponse = await generateTaskInsights(
              apiKey,
              task.title,
              task.instructions || '',
              codeResult.files,
              codeResult.summary || '',
              siblingTitles,
              project.name,
              knowledgeContext,
            );

            for (const insight of insightsResponse.insights) {
              let targetTaskId: string | null = null;
              if (insight.targetTaskTitle) {
                const target = siblingTasks.find((t) => t.title === insight.targetTaskTitle);
                if (target) targetTaskId = target.taskId;
              }
              await prisma.taskInsight.create({
                data: {
                  sourceTaskId: task.taskId,
                  targetTaskId,
                  projectId: task.projectId,
                  orgId,
                  type: insight.type,
                  content: insight.content,
                },
              });
            }
            log.info({ taskId: task.taskId, insightCount: insightsResponse.insights.length }, 'Generated task insights');
          }
        } catch (insightErr) {
          log.warn({ err: insightErr, taskId: task.taskId }, 'Task insight generation failed (non-blocking)');
        }
      }

      // Check if there's a next action to enqueue
      const nextAction = await prisma.taskAction.findFirst({
        where: { planId, status: 'pending', position: { gt: action.position } },
        orderBy: { position: 'asc' },
      });

      if (nextAction) {
        if (nextAction.requiresApproval) {
          // Pause — user must approve via the UI
          log.info({ planId, nextActionId: nextAction.id }, 'Next action requires approval, pausing');
        } else {
          // Auto-enqueue next action
          const queue = getJobQueue();
          queue.enqueue('action-execute', {
            planId,
            actionId: nextAction.id,
            orgId,
            userId,
          });
        }
      } else {
        // All done
        kbCache.delete(planId);
        await prisma.taskActionPlan.update({
          where: { id: planId },
          data: { status: 'completed' },
        });

        // Clean up feature branch after successful merge
        const allCompletedActions = await prisma.taskAction.findMany({
          where: { planId, status: 'completed' },
          select: { actionType: true, result: true },
        });
        const didMerge = allCompletedActions.some((a) => a.actionType === 'merge_pr');
        if (didMerge && repo && plan.branchName) {
          try {
            await deleteBranch(repo, plan.branchName);
            log.info({ planId, branchName: plan.branchName }, 'Deleted feature branch after merge');
          } catch (branchErr) {
            log.warn({ err: branchErr, planId, branchName: plan.branchName }, 'Failed to delete feature branch (non-blocking)');
          }
        }

        // Transition task status based on plan results
        const completedActions = allCompletedActions;

        // Determine target status from completed actions
        let targetStatus: string | null = null;
        const hasMerge = completedActions.some((a) => a.actionType === 'merge_pr');
        const hasFixReview = completedActions.some((a) => a.actionType === 'fix_review');

        if (hasMerge) {
          // PR was merged — task is done
          targetStatus = 'done';
        } else if (hasFixReview) {
          // Fix review ran (fixes committed) but no merge — done
          targetStatus = 'done';
        } else {
          // Check if review was approved
          const reviewAction = completedActions.find((a) => a.actionType === 'review_pr');
          if (reviewAction?.result) {
            try {
              const reviewResult = JSON.parse(reviewAction.result) as Record<string, unknown>;
              const approved = reviewResult.approved || (reviewResult.data as Record<string, unknown> | undefined)?.approved;
              targetStatus = approved ? 'done' : 'in_progress';
            } catch {
              targetStatus = 'in_progress';
            }
          }
        }

        if (targetStatus) {
          // Re-read current task status to get the latest value
          const currentTask = await prisma.task.findUnique({ where: { taskId: task.taskId }, select: { status: true } });
          const previousStatus = currentTask?.status ?? task.status;

          if (previousStatus !== targetStatus) {
            const updatedTask = await prisma.task.update({
              where: { taskId: task.taskId },
              data: { status: targetStatus, sprintColumn: STATUS_TO_COLUMN[targetStatus] ?? undefined },
            });
            bus.emit('task.updated', {
              orgId,
              userId,
              projectId: task.projectId,
              timestamp: new Date().toISOString(),
              task: {
                taskId: updatedTask.taskId,
                title: updatedTask.title,
                status: updatedTask.status,
                projectId: updatedTask.projectId,
                orgId: updatedTask.orgId,
                taskType: updatedTask.taskType,
              },
              changes: {
                status: { old: previousStatus, new: targetStatus },
              },
            });
          }
        }

        // Generate cross-task completion summary (skip if budget exhausted)
        if (apiKey) {
          const summaryBudget = await checkBudget(prisma, orgId);
          if (!summaryBudget.allowed) {
            log.warn({ planId, orgId }, 'Skipping completion summary — AI budget exhausted');
          } else try {
            const summaryActions = await prisma.taskAction.findMany({
              where: { planId, status: 'completed' },
              orderBy: { position: 'asc' },
              select: { actionType: true, label: true, result: true },
            });
            const actionResults = summaryActions.map(a => {
              const parsed = a.result ? JSON.parse(a.result) as Record<string, unknown> : {};
              return {
                actionType: a.actionType,
                label: a.label,
                summary: (parsed.summary as string) || (parsed.data as Record<string, unknown>)?.summary as string | undefined,
                files: (parsed.files as Array<{ path: string }>) || (parsed.data as Record<string, unknown>)?.files as Array<{ path: string }> | undefined,
              };
            });

            const summary = await generateCompletionSummary(
              apiKey,
              task.title,
              task.instructions || '',
              actionResults,
              project.name,
            );

            await prisma.task.update({
              where: { taskId: task.taskId },
              data: { completionSummary: JSON.stringify(summary) },
            });
          } catch (err) {
            log.warn({ err, taskId: task.taskId }, 'Completion summary generation failed (non-blocking)');
          }
        }

        bus.emit('task.action_plan_completed', {
          orgId,
          userId,
          projectId: task.projectId,
          timestamp: new Date().toISOString(),
          planId,
          taskId: task.taskId,
          taskTitle: task.title,
        });
      }

      // Clean up AbortController for this plan
      activeControllers.delete(planId);
    } catch (err) {
      // Clean up AbortController and KB cache
      activeControllers.delete(planId);
      kbCache.delete(planId);

      const errorCode = err instanceof GraphQLError ? (err.extensions?.code as string) : undefined;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      const isRetryable = isRetryableAIError(err);

      log.error({ err, actionId, planId, errorCode, isRetryable }, 'Action execution failed');

      await prisma.taskAction.update({
        where: { id: actionId },
        data: {
          status: 'failed',
          errorMessage,
          result: JSON.stringify({
            failed: true,
            error: errorMessage,
            errorCode,
            isRetryable,
            attemptedAt: new Date().toISOString(),
            actionType: action.actionType,
          }),
        },
      });
      await prisma.taskActionPlan.update({
        where: { id: planId },
        data: { status: 'failed' },
      });

      const bus = getEventBus();
      bus.emit('task.action_completed', {
        orgId,
        userId,
        projectId: task.projectId,
        timestamp: new Date().toISOString(),
        actionId,
        actionType: action.actionType,
        planId,
        taskId: task.taskId,
        success: false,
      });

      bus.emit('task.action_plan_failed', {
        orgId,
        userId,
        projectId: task.projectId,
        timestamp: new Date().toISOString(),
        planId,
        taskId: task.taskId,
        taskTitle: task.title,
        lastFailedActionId: actionId,
        lastFailedActionType: action.actionType,
        errorMessage,
      });
    }

    } catch (setupErr) {
      // Setup failed (branch creation, auth, context loading) — mark plan as failed
      // so the user sees a "Retry" button instead of a stalled plan.
      const errorMessage = setupErr instanceof Error ? setupErr.message : 'Setup failed';
      log.error({ err: setupErr, actionId, planId }, 'Action setup failed, marking plan as failed');

      await prisma.taskAction.update({
        where: { id: actionId },
        data: { status: 'failed', errorMessage },
      }).catch(() => { /* best-effort */ });

      await prisma.taskActionPlan.update({
        where: { id: planId },
        data: { status: 'failed' },
      }).catch(() => { /* best-effort */ });

      const bus = getEventBus();
      bus.emit('task.action_plan_failed', {
        orgId,
        userId,
        projectId: action.plan.task.projectId,
        timestamp: new Date().toISOString(),
        planId,
        taskId: action.plan.task.taskId,
        taskTitle: action.plan.task.title,
        lastFailedActionId: actionId,
        lastFailedActionType: action.actionType,
        errorMessage,
      });
    }
  };
}
