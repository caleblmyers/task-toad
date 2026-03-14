import type { Context } from '../context.js';
import {
  generateProjectOptions as aiGenerateProjectOptions,
  generateTaskPlan as aiGenerateTaskPlan,
  expandTask as aiExpandTask,
  generateTaskInstructions as aiGenerateTaskInstructions,
  generateCode as aiGenerateCode,
  summarizeProject as aiSummarizeProject,
  generateStandupReport as aiGenerateStandupReport,
  generateSprintReport as aiGenerateSprintReport,
  analyzeProjectHealth as aiAnalyzeProjectHealth,
  extractTasksFromNotes as aiExtractTasksFromNotes,
} from '../../ai/index.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg, requireApiKey } from './auth.js';
import { getProjectRepo, fetchProjectFileTree } from '../../github/index.js';

// ── AI mutations ──

export const aiMutations = {
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
      args.context
    );
    return Promise.all(
      taskPlans.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            instructions: t.instructions,
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
      fullContext
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
      args.context
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
      siblings.map((s: { title: string }) => s.title)
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

  generateCodeFromTask: async (_parent: unknown, args: { taskId: string }, context: Context) => {
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
    );
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
