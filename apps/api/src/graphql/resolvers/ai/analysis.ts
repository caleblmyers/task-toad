import type { Context } from '../../context.js';
import {
  projectChat as aiProjectChat,
  analyzeRepoDrift as aiAnalyzeRepoDrift,
  analyzeSprintTransition as aiAnalyzeSprintTransition,
  analyzeProjectHealth as aiAnalyzeProjectHealth,
  extractTasksFromNotes as aiExtractTasksFromNotes,
} from '../../../ai/index.js';
import { NotFoundError, ValidationError } from '../../errors.js';
import { requireOrg, requireApiKey } from '../auth.js';
import { buildPromptLogContext, enforceBudget, ROOT_OR_EPIC_CHILD } from './helpers.js';
import { getProjectRepo } from '../../../github/index.js';
import { listRecentCommits, listOpenPullRequests } from '../../../github/githubFileService.js';
import { requireProject } from '../../../utils/resolverHelpers.js';
import { retrieveRelevantKnowledge } from '../../../ai/knowledgeRetrieval.js';

export const analysisQueries = {
  projectChat: async (
    _parent: unknown,
    args: { projectId: string; question: string },
    context: Context
  ) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
    if (!args.question.trim()) {
      throw new ValidationError('Question is required');
    }

    const tasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, archived: false, taskType: { not: 'epic' }, ...ROOT_OR_EPIC_CHILD },
      select: {
        taskId: true,
        title: true,
        status: true,
        priority: true,
        completionSummary: true,
        assignee: { select: { email: true } },
        sprint: { select: { name: true } },
        dependenciesAsSource: {
          select: {
            linkType: true,
            targetTask: { select: { title: true, status: true } },
          },
        },
        dependenciesAsTarget: {
          select: {
            linkType: true,
            sourceTask: { select: { title: true, status: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const sprints = await context.prisma.sprint.findMany({
      where: { projectId: args.projectId },
      include: { _count: { select: { tasks: true } } },
    });

    const activities = await context.prisma.activity.findMany({
      where: { projectId: args.projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Build a taskId→title map for activity references
    const activityTaskIds = [...new Set(activities.map((a: { taskId: string | null }) => a.taskId).filter(Boolean))] as string[];
    const activityTasks = activityTaskIds.length > 0
      ? await context.prisma.task.findMany({ where: { taskId: { in: activityTaskIds } }, select: { taskId: true, title: true } })
      : [];
    const taskTitleMap = new Map(activityTasks.map((t: { taskId: string; title: string }) => [t.taskId, t.title]));

    // Use KB retrieval instead of legacy knowledgeBase field
    let knowledgeBase: string | null = null;
    try {
      knowledgeBase = await retrieveRelevantKnowledge(context.prisma, args.projectId, args.question, apiKey);
    } catch {
      knowledgeBase = project.knowledgeBase;  // fallback
    }

    const plc = await buildPromptLogContext(context);
    return aiProjectChat(apiKey, {
      question: args.question,
      projectName: project.name,
      projectDescription: project.description,
      tasks: tasks.map((t) => {
        let completionSummary: string | undefined;
        if (t.completionSummary) {
          try {
            const parsed = JSON.parse(t.completionSummary) as Record<string, unknown>;
            completionSummary = (parsed.whatWasBuilt as string) || undefined;
          } catch { /* ignore parse errors */ }
        }
        return {
          taskId: t.taskId,
          title: t.title,
          status: t.status,
          priority: t.priority,
          assignee: t.assignee?.email ?? null,
          sprintName: t.sprint?.name ?? null,
          blockedBy: t.dependenciesAsTarget
            .filter((d) => d.linkType === 'blocks')
            .map((d) => d.sourceTask.title),
          blocks: t.dependenciesAsSource
            .filter((d) => d.linkType === 'blocks')
            .map((d) => d.targetTask.title),
          completionSummary,
        };
      }),
      sprints: sprints.map((s: { name: string; isActive: boolean; _count: { tasks: number } }) => ({
        name: s.name,
        isActive: s.isActive,
        taskCount: s._count.tasks,
      })),
      recentActivity: activities.map((a: { action: string; field: string | null; taskId: string | null; createdAt: Date }) => ({
        action: a.action,
        field: a.field,
        taskTitle: a.taskId ? taskTitleMap.get(a.taskId) ?? null : null,
        createdAt: a.createdAt.toISOString(),
      })),
      knowledgeBase,
    }, plc);
  },

  analyzeRepoDrift: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context
  ) => {
    await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
    const repo = await getProjectRepo(args.projectId);
    if (!repo) {
      throw new ValidationError('Project has no linked GitHub repository');
    }

    const [commits, prs, tasks] = await Promise.all([
      listRecentCommits(repo.installationId, repo.repositoryOwner, repo.repositoryName, 30),
      listOpenPullRequests(repo.installationId, repo.repositoryOwner, repo.repositoryName),
      context.prisma.task.findMany({
        where: { projectId: args.projectId, archived: false, taskType: { not: 'epic' }, ...ROOT_OR_EPIC_CHILD },
        select: { taskId: true, title: true, status: true, description: true },
        take: 50,
      }),
    ]);

    const plc = await buildPromptLogContext(context);
    return aiAnalyzeRepoDrift(apiKey, {
      repoName: `${repo.repositoryOwner}/${repo.repositoryName}`,
      recentCommits: commits,
      openPRs: prs,
      tasks: tasks.map((t: { taskId: string; title: string; status: string; description: string | null }) => ({
        taskId: t.taskId,
        title: t.title,
        status: t.status,
        description: t.description,
      })),
    }, plc);
  },

  analyzeSprintTransition: async (
    _parent: unknown,
    args: { sprintId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
    const sprint = await context.prisma.sprint.findFirst({
      where: { sprintId: args.sprintId },
    });
    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }
    const project = await context.prisma.project.findFirst({
      where: { projectId: sprint.projectId, orgId: user.orgId },
    });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const sprintTasks = await context.prisma.task.findMany({
      where: { sprintId: args.sprintId, taskType: { not: 'epic' }, ...ROOT_OR_EPIC_CHILD },
      include: { assignee: { select: { email: true } } },
    });

    const totalTasks = sprintTasks.length;
    const completedCount = sprintTasks.filter((t: { status: string }) => t.status === 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    const incompleteTasks = sprintTasks.filter((t: { status: string }) => t.status !== 'done');

    const plc = await buildPromptLogContext(context);
    return aiAnalyzeSprintTransition(apiKey, {
      sprintName: sprint.name,
      tasks: incompleteTasks.map((t: { taskId: string; title: string; status: string; priority: string; storyPoints: number | null; assignee: { email: string } | null }) => ({
        taskId: t.taskId,
        title: t.title,
        status: t.status,
        priority: t.priority,
        storyPoints: t.storyPoints,
        assignee: t.assignee?.email ?? null,
      })),
      completionRate,
    }, plc);
  },

  analyzeTrends: async (
    _parent: unknown,
    args: { projectId: string; period?: string | null },
    context: Context
  ) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);

    const reports = await context.prisma.report.findMany({
      where: { projectId: args.projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { type: true, title: true, data: true, createdAt: true },
    });

    const formattedReports = reports.map((r: { type: string; title: string; data: string; createdAt: Date }) => ({
      type: r.type,
      title: r.title,
      data: r.data,
      createdAt: r.createdAt.toISOString(),
    }));

    const plc = await buildPromptLogContext(context);
    const { analyzeTrends: aiAnalyzeTrends } = await import('../../../ai/aiService.js');
    return aiAnalyzeTrends(apiKey, {
      projectName: project.name,
      reports: formattedReports,
      period: args.period,
    }, plc);
  },

  aiUsage: async (_parent: unknown, args: { days?: number | null }, context: Context) => {
    const user = requireOrg(context);
    const days = args.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await context.prisma.aIUsageLog.findMany({
      where: { orgId: user.orgId, createdAt: { gte: since } },
    });

    let totalCostUSD = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const featureMap = new Map<string, { calls: number; costUSD: number; totalLatencyMs: number }>();

    for (const log of logs) {
      totalCostUSD += log.costUSD;
      totalInputTokens += log.inputTokens;
      totalOutputTokens += log.outputTokens;

      const entry = featureMap.get(log.feature) ?? { calls: 0, costUSD: 0, totalLatencyMs: 0 };
      entry.calls += 1;
      entry.costUSD += log.costUSD;
      entry.totalLatencyMs += log.latencyMs;
      featureMap.set(log.feature, entry);
    }

    const byFeature = Array.from(featureMap.entries())
      .map(([feature, data]) => ({
        feature,
        calls: data.calls,
        costUSD: data.costUSD,
        avgLatencyMs: Math.round(data.totalLatencyMs / data.calls),
      }))
      .sort((a, b) => b.costUSD - a.costUSD);

    const org = await context.prisma.org.findUnique({
      where: { orgId: user.orgId },
      select: { monthlyBudgetCentsUSD: true, budgetEnforcement: true },
    });

    let budgetUsedPercent: number | null = null;
    let dailyAverageCostUSD: number | null = null;
    let projectedMonthlyCostUSD: number | null = null;

    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const monthLogs = since <= startOfMonth
      ? logs.filter((l) => l.createdAt >= startOfMonth)
      : logs;
    const monthCost = monthLogs.reduce((sum, l) => sum + l.costUSD, 0);

    if (org?.monthlyBudgetCentsUSD) {
      budgetUsedPercent = Math.round((monthCost * 100 * 100) / org.monthlyBudgetCentsUSD) / 100;
    }

    // Compute spend forecast
    const now = new Date();
    const dayOfMonth = now.getDate();
    if (dayOfMonth > 1 && monthCost > 0) {
      dailyAverageCostUSD = monthCost / dayOfMonth;
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      projectedMonthlyCostUSD = dailyAverageCostUSD * daysInMonth;
    }

    return {
      totalCostUSD,
      totalInputTokens,
      totalOutputTokens,
      totalCalls: logs.length,
      byFeature,
      budgetUsedPercent,
      budgetLimitCentsUSD: org?.monthlyBudgetCentsUSD ?? null,
      budgetEnforcement: org?.budgetEnforcement ?? 'soft',
      dailyAverageCostUSD,
      projectedMonthlyCostUSD,
    };
  },

  analyzeProjectHealth: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);

    const allTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, archived: false, taskType: { not: 'epic' }, ...ROOT_OR_EPIC_CHILD },
      select: { status: true, assigneeId: true, dueDate: true, createdAt: true },
    });

    const totalTasks = allTasks.length;
    if (totalTasks === 0) {
      throw new ValidationError('No tasks to analyze. Create some tasks first.');
    }

    const statusCounts: Record<string, number> = {};
    for (const t of allTasks) {
      statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
    }
    const tasksByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueCount = allTasks.filter(
      (t) => t.dueDate && t.dueDate < todayStr && t.status !== 'done'
    ).length;

    const unassignedCount = allTasks.filter((t) => !t.assigneeId && t.status !== 'done').length;
    const tasksWithoutDueDate = allTasks.filter((t) => !t.dueDate && t.status !== 'done').length;

    const now = Date.now();
    const openTasks = allTasks.filter((t) => t.status !== 'done');
    const avgTaskAgeInDays = openTasks.length > 0
      ? Math.round(openTasks.reduce((sum, t) => sum + (now - t.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0) / openTasks.length)
      : 0;

    const plc = await buildPromptLogContext(context);
    return aiAnalyzeProjectHealth(apiKey, {
      projectName: project.name,
      totalTasks,
      tasksByStatus,
      overdueCount,
      unassignedCount,
      tasksWithoutDueDate,
      avgTaskAgeInDays,
    }, plc);
  },

  extractTasksFromNotes: async (_parent: unknown, args: { projectId: string; notes: string }, context: Context) => {
    const { user, project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);

    const orgUsers = await context.prisma.user.findMany({
      where: { orgId: user.orgId },
      select: { email: true },
    });
    const teamMembers = orgUsers.map((u) => u.email);

    const plc = await buildPromptLogContext(context);
    return aiExtractTasksFromNotes(apiKey, args.notes, project.name, teamMembers, plc);
  },
};
