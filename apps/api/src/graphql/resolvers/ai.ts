import type { Context } from '../context.js';
import {
  generateProjectOptions as aiGenerateProjectOptions,
  generateTaskPlan as aiGenerateTaskPlan,
  expandTask as aiExpandTask,
  generateTaskInstructions as aiGenerateTaskInstructions,
  generateCode as aiGenerateCode,
  regenerateFile as aiRegenerateFile,
  summarizeProject as aiSummarizeProject,
  generateStandupReport as aiGenerateStandupReport,
  generateSprintReport as aiGenerateSprintReport,
  analyzeProjectHealth as aiAnalyzeProjectHealth,
  extractTasksFromNotes as aiExtractTasksFromNotes,
  reviewCode as aiReviewCode,
} from '../../ai/index.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../errors.js';
import { requireOrg, requireApiKey } from './auth.js';
import { getProjectRepo, fetchProjectFileTree, getPullRequestDiff } from '../../github/index.js';

// ── AI mutations ──

export const aiMutations = {
  saveReport: async (
    _parent: unknown,
    args: { projectId: string; type: string; title: string; data: string; sprintId?: string | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const project = await context.prisma.project.findFirst({
      where: { projectId: args.projectId, orgId: user.orgId },
    });
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return context.prisma.report.create({
      data: {
        orgId: user.orgId,
        projectId: args.projectId,
        sprintId: args.sprintId ?? null,
        type: args.type,
        title: args.title,
        data: args.data,
        createdBy: user.userId,
      },
    });
  },

  deleteReport: async (_parent: unknown, args: { reportId: string }, context: Context) => {
    const user = requireOrg(context);
    const report = await context.prisma.report.findUnique({
      where: { id: args.reportId },
    });
    if (!report || report.orgId !== user.orgId) {
      throw new NotFoundError('Report not found');
    }
    await context.prisma.report.delete({ where: { id: args.reportId } });
    return true;
  },

  setAIBudget: async (
    _parent: unknown,
    args: { monthlyBudgetCentsUSD?: number | null; alertThreshold?: number | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    if (args.alertThreshold != null && (args.alertThreshold < 1 || args.alertThreshold > 100)) {
      throw new ValidationError('Alert threshold must be between 1 and 100');
    }
    return context.prisma.org.update({
      where: { orgId: user.orgId },
      data: {
        ...(args.monthlyBudgetCentsUSD !== undefined && { monthlyBudgetCentsUSD: args.monthlyBudgetCentsUSD ?? null }),
        ...(args.alertThreshold != null && { budgetAlertThreshold: args.alertThreshold }),
      },
    });
  },

  generateProjectOptions: async (_parent: unknown, args: { prompt: string }, context: Context) => {
    const apiKey = requireApiKey(context);
    return aiGenerateProjectOptions(apiKey, args.prompt);
  },

  createProjectFromOption: async (
    _parent: unknown,
    args: { prompt: string; title: string; description: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    return context.prisma.project.create({
      data: {
        name: args.title,
        description: args.description,
        prompt: args.prompt,
        orgId: user.orgId,
      },
    });
  },

  generateTaskPlan: async (
    _parent: unknown,
    args: { projectId: string; context?: string | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }
    await context.prisma.task.deleteMany({
      where: { projectId: args.projectId, parentTaskId: null },
    });
    const taskPlans = await aiGenerateTaskPlan(
      apiKey,
      project.name,
      project.description ?? '',
      project.prompt ?? '',
      args.context,
      project.knowledgeBase
    );
    return Promise.all(
      taskPlans.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            instructions: t.instructions,
            acceptanceCriteria: t.acceptanceCriteria || null,
            suggestedTools: JSON.stringify(t.suggestedTools),
            status: 'todo',
            projectId: args.projectId,
            orgId: user.orgId,
          },
        })
      )
    );
  },

  previewTaskPlan: async (
    _parent: unknown,
    args: { projectId: string; context?: string | null; appendToTitles?: string[] | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }
    let fullContext = args.context ?? undefined;
    if (args.appendToTitles && args.appendToTitles.length > 0) {
      const existing = args.appendToTitles.map((t) => `"${t}"`).join(', ');
      fullContext = `These tasks already exist: ${existing}. Generate ONLY additional tasks not already in this list.${args.context ? ` Additional context: ${args.context}` : ''}`;
    }
    const taskPlans = await aiGenerateTaskPlan(
      apiKey,
      project.name,
      project.description ?? '',
      project.prompt ?? '',
      fullContext,
      project.knowledgeBase
    );
    return taskPlans.map((t) => ({
      title: t.title,
      description: t.description,
      instructions: t.instructions,
      suggestedTools: JSON.stringify(t.suggestedTools),
      estimatedHours: t.estimatedHours ?? null,
      priority: t.priority ?? 'medium',
      dependsOn: t.dependsOn ?? [],
      subtasks: t.subtasks ?? [],
      acceptanceCriteria: t.acceptanceCriteria || null,
    }));
  },

  commitTaskPlan: async (
    _parent: unknown,
    args: {
      projectId: string;
      tasks: Array<{
        title: string;
        description: string;
        instructions: string;
        suggestedTools: string;
        estimatedHours?: number | null;
        priority?: string | null;
        dependsOn: string[];
        subtasks: Array<{ title: string; description: string }>;
        acceptanceCriteria?: string | null;
      }>;
      clearExisting?: boolean | null;
    },
    context: Context
  ) => {
    const user = requireOrg(context);
    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }

    if (args.clearExisting) {
      await context.prisma.task.deleteMany({
        where: { projectId: args.projectId, parentTaskId: { not: null } },
      });
      await context.prisma.task.deleteMany({
        where: { projectId: args.projectId, parentTaskId: null },
      });
    }

    const created = await Promise.all(
      args.tasks.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            instructions: t.instructions,
            acceptanceCriteria: t.acceptanceCriteria || null,
            suggestedTools: t.suggestedTools,
            estimatedHours: t.estimatedHours ?? null,
            priority: t.priority ?? 'medium',
            status: 'todo',
            projectId: args.projectId,
            orgId: user.orgId,
          },
        })
      )
    );

    const titleToId = new Map<string, string>();
    created.forEach((task) => titleToId.set(task.title, task.taskId));

    await Promise.all(
      created.map(async (task, i) => {
        const inputTask = args.tasks[i];
        const resolvedDeps = inputTask.dependsOn
          .map((title) => titleToId.get(title))
          .filter((id): id is string => id !== undefined);

        const updates: Promise<unknown>[] = [];

        if (resolvedDeps.length > 0) {
          updates.push(
            context.prisma.task.update({
              where: { taskId: task.taskId },
              data: { dependsOn: JSON.stringify(resolvedDeps) },
            })
          );
        }

        if (inputTask.subtasks.length > 0) {
          updates.push(
            context.prisma.task.createMany({
              data: inputTask.subtasks.map((st) => ({
                title: st.title,
                description: st.description,
                status: 'todo',
                projectId: args.projectId,
                parentTaskId: task.taskId,
                orgId: user.orgId,
                priority: 'medium',
              })),
            })
          );
        }

        await Promise.all(updates);
      })
    );

    return context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null },
      orderBy: { createdAt: 'asc' },
    });
  },

  expandTask: async (
    _parent: unknown,
    args: { taskId: string; context?: string | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const task = await context.prisma.task.findUnique({
      where: { taskId: args.taskId },
      include: { project: true },
    });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    await context.prisma.task.deleteMany({ where: { parentTaskId: args.taskId } });
    const subtaskPlans = await aiExpandTask(
      apiKey,
      task.title,
      task.description ?? '',
      task.project.name,
      args.context,
      task.project.knowledgeBase
    );
    return Promise.all(
      subtaskPlans.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            instructions: t.instructions,
            suggestedTools: JSON.stringify(t.suggestedTools),
            status: 'todo',
            projectId: task.projectId,
            parentTaskId: task.taskId,
            orgId: user.orgId,
          },
        })
      )
    );
  },

  generateTaskInstructions: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const task = await context.prisma.task.findUnique({
      where: { taskId: args.taskId },
      include: { project: true },
    });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    const siblings = await context.prisma.task.findMany({
      where: { projectId: task.projectId, parentTaskId: null, NOT: { taskId: task.taskId } },
      select: { taskId: true, title: true },
      orderBy: { createdAt: 'asc' },
    });
    const result = await aiGenerateTaskInstructions(
      apiKey,
      task.title,
      task.description ?? '',
      task.project.name,
      siblings.map((s: { title: string }) => s.title),
      task.project.knowledgeBase
    );
    const titleToId = new Map(siblings.map((s: { title: string; taskId: string }) => [s.title, s.taskId]));
    const resolvedDeps = result.dependsOn
      .map((title) => titleToId.get(title))
      .filter((id): id is string => id !== undefined);
    await context.prisma.task.deleteMany({ where: { parentTaskId: task.taskId } });
    if (result.subtasks.length > 0) {
      await context.prisma.task.createMany({
        data: result.subtasks.map((st) => ({
          title: st.title,
          description: st.description,
          status: 'todo',
          projectId: task.projectId,
          parentTaskId: task.taskId,
          orgId: user.orgId,
          priority: 'medium',
        })),
      });
    }
    return context.prisma.task.update({
      where: { taskId: args.taskId },
      data: {
        instructions: result.instructions,
        suggestedTools: JSON.stringify(result.suggestedTools),
        estimatedHours: result.estimatedHours,
        priority: result.priority,
        dependsOn: resolvedDeps.length > 0 ? JSON.stringify(resolvedDeps) : null,
      },
    });
  },

  generateCodeFromTask: async (_parent: unknown, args: { taskId: string; styleGuide?: string | null }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const task = await context.prisma.task.findUnique({
      where: { taskId: args.taskId },
      include: { project: true },
    });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    if (!task.instructions) {
      throw new ValidationError('Task has no instructions. Generate instructions first.');
    }

    // Fetch project file tree for context if repo is connected
    let projectFiles: Array<{ path: string; language: string; size: number }> | undefined;
    const repo = await getProjectRepo(task.projectId);
    if (repo) {
      projectFiles = await fetchProjectFileTree(repo).catch(() => undefined);
    }

    return aiGenerateCode(
      apiKey,
      task.title,
      task.description ?? '',
      task.instructions,
      task.project.name,
      task.project.description ?? '',
      projectFiles,
      args.styleGuide,
      task.project.knowledgeBase,
    );
  },

  regenerateCodeFile: async (
    _parent: unknown,
    args: { taskId: string; filePath: string; feedback?: string | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const task = await context.prisma.task.findUnique({
      where: { taskId: args.taskId },
      include: { project: true },
    });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    if (!task.instructions) {
      throw new ValidationError('Task has no instructions. Generate instructions first.');
    }
    return aiRegenerateFile(
      apiKey,
      task.title,
      task.description ?? '',
      task.instructions,
      args.filePath,
      '', // original content will be passed from frontend in feedback if needed
      task.project.name,
      args.feedback
    );
  },

  reviewPullRequest: async (
    _parent: unknown,
    args: { taskId: string; prNumber: number },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const task = await context.prisma.task.findUnique({
      where: { taskId: args.taskId },
      include: { project: true },
    });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }

    const project = task.project;
    if (!project.githubInstallationId || !project.githubRepositoryOwner || !project.githubRepositoryName) {
      throw new ValidationError('Project has no linked GitHub repository');
    }

    const diff = await getPullRequestDiff(
      project.githubInstallationId,
      project.githubRepositoryOwner,
      project.githubRepositoryName,
      args.prNumber
    );

    return aiReviewCode(apiKey, {
      taskTitle: task.title,
      taskDescription: task.description ?? '',
      taskInstructions: task.instructions ?? undefined,
      acceptanceCriteria: (task as Record<string, unknown>).acceptanceCriteria as string | undefined,
      diff,
      projectName: project.name,
    });
  },

  summarizeProject: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }
    const tasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null },
      select: { title: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    if (tasks.length === 0) {
      throw new ValidationError('No tasks to summarize. Generate a task plan first.');
    }
    return aiSummarizeProject(apiKey, project.name, project.description ?? '', tasks);
  },
};

// ── AI queries ──

export const aiQueries = {
  reports: async (
    _parent: unknown,
    args: { projectId: string; type?: string | null; limit?: number | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const project = await context.prisma.project.findFirst({
      where: { projectId: args.projectId, orgId: user.orgId },
    });
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    return context.prisma.report.findMany({
      where: {
        projectId: args.projectId,
        ...(args.type ? { type: args.type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: args.limit ?? 20,
    });
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
      select: { monthlyBudgetCentsUSD: true },
    });

    let budgetUsedPercent: number | null = null;
    if (org?.monthlyBudgetCentsUSD) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthLogs = since <= startOfMonth
        ? logs.filter((l) => l.createdAt >= startOfMonth)
        : logs;

      const monthCost = monthLogs.reduce((sum, l) => sum + l.costUSD, 0);
      budgetUsedPercent = Math.round((monthCost * 100 * 100) / org.monthlyBudgetCentsUSD) / 100;
    }

    return {
      totalCostUSD,
      totalInputTokens,
      totalOutputTokens,
      totalCalls: logs.length,
      byFeature,
      budgetUsedPercent,
      budgetLimitCentsUSD: org?.monthlyBudgetCentsUSD ?? null,
    };
  },

  generateStandupReport: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findFirst({
      where: { projectId: args.projectId, orgId: user.orgId },
    });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

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
          where: { taskId: { in: doneTaskIds }, parentTaskId: null },
          select: { title: true },
        })
      : [];

    const inProgressTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null, status: 'in_progress' },
      select: { title: true },
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueTasks = await context.prisma.task.findMany({
      where: {
        projectId: args.projectId,
        parentTaskId: null,
        status: { not: 'done' },
        dueDate: { lt: todayStr, not: null },
      },
      select: { title: true },
    });

    const activeSprint = await context.prisma.sprint.findFirst({
      where: { projectId: args.projectId, isActive: true },
    });

    return aiGenerateStandupReport(apiKey, {
      projectName: project.name,
      sprintName: activeSprint?.name ?? null,
      sprintStart: activeSprint?.startDate ?? null,
      sprintEnd: activeSprint?.endDate ?? null,
      completedTasks: completedTasks.map((t) => t.title),
      inProgressTasks: inProgressTasks.map((t) => t.title),
      overdueTasks: overdueTasks.map((t) => t.title),
    });
  },

  generateSprintReport: async (_parent: unknown, args: { projectId: string; sprintId: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findFirst({
      where: { projectId: args.projectId, orgId: user.orgId },
    });
    if (!project) {
      throw new NotFoundError('Project not found');
    }
    const sprint = await context.prisma.sprint.findFirst({
      where: { sprintId: args.sprintId, projectId: args.projectId },
    });
    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }

    const sprintTasks = await context.prisma.task.findMany({
      where: { sprintId: args.sprintId, parentTaskId: null },
      include: { assignee: { select: { email: true } } },
    });

    const totalTasks = sprintTasks.length;
    const completedCount = sprintTasks.filter((t) => t.status === 'done').length;

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
    });
  },

  analyzeProjectHealth: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findFirst({
      where: { projectId: args.projectId, orgId: user.orgId },
    });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const allTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null, archived: false },
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

    return aiAnalyzeProjectHealth(apiKey, {
      projectName: project.name,
      totalTasks,
      tasksByStatus,
      overdueCount,
      unassignedCount,
      tasksWithoutDueDate,
      avgTaskAgeInDays,
    });
  },

  extractTasksFromNotes: async (_parent: unknown, args: { projectId: string; notes: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findFirst({
      where: { projectId: args.projectId, orgId: user.orgId },
    });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const orgUsers = await context.prisma.user.findMany({
      where: { orgId: user.orgId },
      select: { email: true },
    });
    const teamMembers = orgUsers.map((u) => u.email);

    return aiExtractTasksFromNotes(apiKey, args.notes, project.name, teamMembers);
  },
};
