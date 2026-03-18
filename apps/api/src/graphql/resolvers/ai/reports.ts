import type { Context } from '../../context.js';
import {
  generateStandupReport as aiGenerateStandupReport,
  generateSprintReport as aiGenerateSprintReport,
} from '../../../ai/index.js';
import { NotFoundError } from '../../errors.js';
import { requireOrg, requireApiKey } from '../auth.js';
import { buildPromptLogContext, enforceBudget, ROOT_OR_EPIC_CHILD } from './helpers.js';
import { requireProject } from '../../../utils/resolverHelpers.js';

export const reportQueries = {
  reports: async (
    _parent: unknown,
    args: { projectId: string; type?: string | null; limit?: number | null; cursor?: string | null },
    context: Context
  ) => {
    await requireProject(context, args.projectId);
    const limit = args.limit ?? 20;
    const reports = await context.prisma.report.findMany({
      where: {
        projectId: args.projectId,
        ...(args.type ? { type: args.type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
    });
    const hasMore = reports.length > limit;
    const items = hasMore ? reports.slice(0, limit) : reports;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { reports: items, hasMore, nextCursor };
  },

  aiPromptHistory: async (
    _parent: unknown,
    args: { taskId?: string | null; projectId?: string | null; limit?: number | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const where: Record<string, unknown> = { orgId: user.orgId };
    if (args.taskId) where.taskId = args.taskId;
    if (args.projectId) where.projectId = args.projectId;
    const logs = await context.prisma.aIPromptLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: args.limit ?? 20,
    });
    return logs.map((l: { id: string; feature: string; taskId: string | null; projectId: string | null; input: string; output: string; inputTokens: number; outputTokens: number; costUSD: number; latencyMs: number; model: string; cached: boolean; createdAt: Date }) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    }));
  },

  generateStandupReport: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);

    // Find tasks completed in the last 24 hours via activity log
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDoneActivities = await context.prisma.activity.findMany({
      where: {
        projectId: args.projectId,
        field: 'status',
        newValue: 'done',
        createdAt: { gte: oneDayAgo },
        taskId: { not: null },
      },
      select: { taskId: true },
    });
    const doneTaskIds = [...new Set(recentDoneActivities.map((a) => a.taskId!))];
    const completedTasks = doneTaskIds.length > 0
      ? await context.prisma.task.findMany({
          where: { taskId: { in: doneTaskIds }, taskType: { not: 'epic' }, ...ROOT_OR_EPIC_CHILD },
          select: { title: true },
        })
      : [];

    const inProgressTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, status: 'in_progress', taskType: { not: 'epic' }, ...ROOT_OR_EPIC_CHILD },
      select: { title: true },
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueTasks = await context.prisma.task.findMany({
      where: {
        projectId: args.projectId,
        taskType: { not: 'epic' },
        ...ROOT_OR_EPIC_CHILD,
        status: { not: 'done' },
        dueDate: { lt: todayStr, not: null },
      },
      select: { title: true },
    });

    const activeSprint = await context.prisma.sprint.findFirst({
      where: { projectId: args.projectId, isActive: true },
    });

    const plc = await buildPromptLogContext(context);
    return aiGenerateStandupReport(apiKey, {
      projectName: project.name,
      sprintName: activeSprint?.name ?? null,
      sprintStart: activeSprint?.startDate ?? null,
      sprintEnd: activeSprint?.endDate ?? null,
      completedTasks: completedTasks.map((t) => t.title),
      inProgressTasks: inProgressTasks.map((t) => t.title),
      overdueTasks: overdueTasks.map((t) => t.title),
    }, plc);
  },

  generateSprintReport: async (_parent: unknown, args: { projectId: string; sprintId: string }, context: Context) => {
    await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
    const sprint = await context.prisma.sprint.findFirst({
      where: { sprintId: args.sprintId, projectId: args.projectId },
    });
    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }

    const sprintTasks = await context.prisma.task.findMany({
      where: { sprintId: args.sprintId, taskType: { not: 'epic' }, ...ROOT_OR_EPIC_CHILD },
      include: { assignee: { select: { email: true } } },
    });

    const totalTasks = sprintTasks.length;
    const completedCount = sprintTasks.filter((t) => t.status === 'done').length;

    const plc = await buildPromptLogContext(context);
    return aiGenerateSprintReport(apiKey, {
      sprintName: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      tasks: sprintTasks.map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigneeEmail: t.assignee?.email ?? null,
      })),
      totalTasks,
      completedTasks: completedCount,
    }, plc);
  },
};
