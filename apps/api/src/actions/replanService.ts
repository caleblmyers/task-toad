import type { PrismaClient } from '@prisma/client';
import { planTaskActions as aiPlanTaskActions } from '../ai/index.js';
import { getProjectRepo } from '../github/index.js';
import { retrieveRelevantKnowledge } from '../ai/knowledgeRetrieval.js';
import { availableTypes } from './index.js';
import { createPlanWithActions } from '../utils/planHelpers.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('replan-service');

interface ReplanResult {
  planId: string;
  taskId: string;
}

/**
 * Auto-replan a failed action plan. Extracts failure context from the failed
 * plan's actions, generates a new plan via the AI, cancels the old plan,
 * and returns the new plan.
 *
 * Callable from both the orchestrator listener (auto-replan) and the
 * GraphQL resolver (manual replan).
 */
export async function replanFailedTask(
  prisma: PrismaClient,
  planId: string,
  orgId: string,
  userId: string,
  apiKey: string,
  promptLoggingEnabled: boolean,
): Promise<ReplanResult> {
  const plan = await prisma.taskActionPlan.findUnique({
    where: { id: planId },
    include: {
      task: { include: { project: true } },
      actions: { orderBy: { position: 'asc' } },
    },
  });

  if (!plan) throw new Error(`Action plan ${planId} not found`);
  if (plan.status !== 'failed') throw new Error(`Plan must be in failed state to replan`);

  // Build failure context from failed actions
  const failedActions = plan.actions.filter((a) => a.status === 'failed');
  const failureContext = failedActions
    .map((a) => `Action "${a.label}" (${a.actionType}) failed: ${a.errorMessage || 'Unknown error'}`)
    .join('\n');

  const task = plan.task;
  const project = task.project;
  const repo = await getProjectRepo(task.projectId);

  // Retrieve relevant KB context
  let knowledgeBase: string | null = null;
  try {
    const taskContext = `${task.title}. ${task.instructions || task.description || ''}`.slice(0, 500);
    knowledgeBase = await retrieveRelevantKnowledge(prisma, task.projectId, taskContext, apiKey);
  } catch (err) {
    log.warn({ err, taskId: task.taskId }, 'KB retrieval failed for replan, falling back to legacy');
  }
  if (!knowledgeBase && project.knowledgeBase) {
    knowledgeBase = project.knowledgeBase;
  }

  // Prepend failure context to knowledge base
  const failureKnowledge = `PREVIOUS PLAN FAILED:\n${failureContext}\n\nGenerate a new plan that avoids these failures. Try a different approach.`;
  const combinedKnowledge = knowledgeBase
    ? `${failureKnowledge}\n\n${knowledgeBase}`
    : failureKnowledge;

  const plc = { prisma, orgId, userId, promptLoggingEnabled };
  const result = await aiPlanTaskActions(
    apiKey,
    {
      taskTitle: task.title,
      taskDescription: task.description ?? '',
      taskInstructions: task.instructions || '',
      acceptanceCriteria: task.acceptanceCriteria,
      suggestedTools: task.suggestedTools,
      projectName: project.name,
      projectDescription: project.description,
      knowledgeBase: combinedKnowledge,
      hasGitHubRepo: !!repo,
      availableActionTypes: availableTypes(),
    },
    plc,
  );

  // Cancel the old plan
  await prisma.taskActionPlan.update({
    where: { id: planId },
    data: { status: 'cancelled' },
  });

  // Create new plan with actions (handles ID remapping)
  const { plan: newPlan } = await createPlanWithActions(
    prisma,
    task.taskId,
    orgId,
    userId,
    result.actions.map((a) => ({
      actionType: a.actionType,
      label: a.label,
      config: JSON.stringify(a.config),
      requiresApproval: a.requiresApproval,
    })),
  );

  return { planId: newPlan.id, taskId: task.taskId };
}
