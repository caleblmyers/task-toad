import type { PrismaClient } from '@prisma/client';
import type { EventBus } from '../eventbus/port.js';
import { createChildLogger } from '../../utils/logger.js';
import { generateTaskInsights } from '../../ai/aiService.js';
import { checkBudget } from '../../ai/aiUsageTracker.js';
import { retrieveRelevantKnowledge } from '../../ai/knowledgeRetrieval.js';

const log = createChildLogger('insight-listener');

export function register(bus: EventBus, prisma: PrismaClient): void {
  bus.on('task.action_completed', async (event) => {
    if (!event.success || event.actionType !== 'generate_code') return;

    try {
      // Load the action result to get generated code files
      const action = await prisma.taskAction.findUnique({
        where: { id: event.actionId },
        select: { result: true },
      });
      if (!action?.result) return;

      const codeResult = JSON.parse(action.result) as {
        files?: Array<{ path: string; language?: string }>;
        summary?: string;
      };
      if (!codeResult.files || codeResult.files.length === 0) return;

      // Load task details — need parentTaskId for sibling lookup
      const task = await prisma.task.findUnique({
        where: { taskId: event.taskId },
        select: { taskId: true, title: true, instructions: true, parentTaskId: true, projectId: true },
      });
      if (!task?.parentTaskId) return;

      // Load sibling tasks — insights are about cross-task relationships
      const siblingTasks = await prisma.task.findMany({
        where: { parentTaskId: task.parentTaskId, taskId: { not: task.taskId }, archived: false },
        select: { taskId: true, title: true },
      });
      if (siblingTasks.length === 0) return;

      // Get org API key
      const org = await prisma.org.findUnique({
        where: { orgId: event.orgId },
        select: { anthropicApiKeyEncrypted: true },
      });
      if (!org?.anthropicApiKeyEncrypted) return;

      const { decryptApiKey } = await import('../../utils/encryption.js');
      let apiKey: string;
      try {
        apiKey = decryptApiKey(org.anthropicApiKeyEncrypted);
      } catch {
        log.warn({ orgId: event.orgId }, 'Failed to decrypt API key for insight generation');
        return;
      }

      // Check budget before making AI call
      const budget = await checkBudget(prisma, event.orgId);
      if (!budget.allowed) return;

      // Load project name for context
      const project = await prisma.project.findUnique({
        where: { projectId: task.projectId },
        select: { name: true, knowledgeBase: true },
      });

      // Use AI-powered KB retrieval for better context (fallback to raw field)
      const taskContext = `${task.title}: ${task.instructions || ''}`;
      let kb: string | null = null;
      try {
        kb = await retrieveRelevantKnowledge(prisma, task.projectId, taskContext, apiKey);
      } catch (err) {
        log.warn({ err, taskId: task.taskId }, 'KB retrieval failed, falling back to raw knowledgeBase');
        kb = project?.knowledgeBase || null;
      }
      if (!kb) kb = project?.knowledgeBase || null;

      const siblingTitles = siblingTasks.map((t) => t.title);
      const insightsResponse = await generateTaskInsights(
        apiKey,
        task.title,
        task.instructions || '',
        codeResult.files,
        codeResult.summary || '',
        siblingTitles,
        project?.name || '',
        kb,
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
            orgId: event.orgId,
            type: insight.type,
            content: insight.content,
          },
        });
      }

      log.info({ taskId: task.taskId, insightCount: insightsResponse.insights.length }, 'Generated task insights');
    } catch (err) {
      log.warn({ err, taskId: event.taskId }, 'Insight generation failed (non-blocking)');
    }
  });
}
