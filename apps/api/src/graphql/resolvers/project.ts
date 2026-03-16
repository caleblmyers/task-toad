import type { Context } from '../context.js';
import { logActivity } from '../../utils/activity.js';
import { AuthorizationError, ValidationError } from '../errors.js';
import { requireOrg, requireProjectAccess } from './auth.js';
import { parseInput, CreateProjectInput } from '../../utils/resolverHelpers.js';

// ── Project queries ──

export const projectQueries = {
  projects: async (_parent: unknown, args: { includeArchived?: boolean | null }, context: Context) => {
    const user = requireOrg(context);
    return context.prisma.project.findMany({
      where: {
        orgId: user.orgId,
        ...(args.includeArchived ? {} : { archived: false }),
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  project: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    try {
      const { project } = await requireProjectAccess(context, args.projectId);
      return project;
    } catch {
      return null;
    }
  },

  portfolioOverview: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);
    const projects = await context.prisma.project.findMany({
      where: { orgId: user.orgId, archived: false },
      select: { projectId: true, name: true },
      orderBy: { createdAt: 'desc' },
    });

    const today = new Date().toISOString().slice(0, 10);

    const summaries = await Promise.all(
      projects.map(async (proj: { projectId: string; name: string }) => {
        const tasks = await context.prisma.task.findMany({
          where: { projectId: proj.projectId, parentTaskId: null, archived: false },
          select: { status: true, dueDate: true },
        });

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t: { status: string }) => t.status === 'done').length;
        const overdueTasks = tasks.filter((t: { dueDate: string | null; status: string }) =>
          t.dueDate && t.dueDate < today && t.status !== 'done'
        ).length;
        const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

        // Status distribution
        const statusMap = new Map<string, number>();
        for (const t of tasks) {
          statusMap.set(t.status, (statusMap.get(t.status) ?? 0) + 1);
        }
        const statusDistribution = Array.from(statusMap, ([label, count]) => ({ label, count }));

        // Active sprint
        const activeSprint = await context.prisma.sprint.findFirst({
          where: { projectId: proj.projectId, isActive: true, closedAt: null },
          select: { name: true },
        });

        // Health score: simple heuristic (100 base, penalize overdue and low completion)
        let healthScore: number | null = null;
        if (totalTasks > 0) {
          healthScore = 100;
          // Penalize for overdue tasks (-10 per overdue, max -50)
          healthScore -= Math.min(overdueTasks * 10, 50);
          // Penalize if completion is low relative to expected (just use completion as a positive signal)
          if (completionPercent < 25) healthScore -= 20;
          else if (completionPercent < 50) healthScore -= 10;
          healthScore = Math.max(0, Math.min(100, healthScore));
        }

        return {
          projectId: proj.projectId,
          name: proj.name,
          totalTasks,
          completedTasks,
          overdueTasks,
          completionPercent,
          activeSprint: activeSprint?.name ?? null,
          healthScore,
          statusDistribution,
        };
      })
    );

    return summaries;
  },

  projectStats: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    const tasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null, archived: false },
      select: { status: true, priority: true, assigneeId: true, estimatedHours: true, dueDate: true },
    });
    const orgUsers = await context.prisma.user.findMany({
      where: { orgId: context.user!.orgId! },
      select: { userId: true, email: true },
    });
    const userMap = new Map(orgUsers.map((u: { userId: string; email: string }) => [u.userId, u.email]));

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: { status: string }) => t.status === 'done').length;
    const today = new Date().toISOString().slice(0, 10);
    const overdueTasks = tasks.filter((t: { dueDate: string | null; status: string }) => t.dueDate && t.dueDate < today && t.status !== 'done').length;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const statusMap = new Map<string, number>();
    const priorityMap = new Map<string, number>();
    const assigneeMap = new Map<string, number>();
    let totalEstimatedHours = 0;
    let completedEstimatedHours = 0;

    for (const t of tasks) {
      statusMap.set(t.status, (statusMap.get(t.status) ?? 0) + 1);
      priorityMap.set(t.priority, (priorityMap.get(t.priority) ?? 0) + 1);
      if (t.assigneeId) {
        assigneeMap.set(t.assigneeId, (assigneeMap.get(t.assigneeId) ?? 0) + 1);
      }
      totalEstimatedHours += t.estimatedHours ?? 0;
      if (t.status === 'done') completedEstimatedHours += t.estimatedHours ?? 0;
    }

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      completionPercent,
      tasksByStatus: Array.from(statusMap, ([label, count]) => ({ label, count })),
      tasksByPriority: Array.from(priorityMap, ([label, count]) => ({ label, count })),
      tasksByAssignee: Array.from(assigneeMap, ([userId, count]) => ({
        userId,
        email: userMap.get(userId) ?? 'Unknown',
        count,
      })),
      totalEstimatedHours,
      completedEstimatedHours,
    };
  },
};

// ── Project mutations ──

export const projectMutations = {
  createProject: async (_parent: unknown, args: { name: string }, context: Context) => {
    parseInput(CreateProjectInput, { name: args.name });
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    return context.prisma.project.create({
      data: { name: args.name, orgId: user.orgId },
    });
  },

  updateProject: async (
    _parent: unknown,
    args: { projectId: string; name?: string | null; description?: string | null; prompt?: string | null; knowledgeBase?: string | null; statuses?: string | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    const { project } = await requireProjectAccess(context, args.projectId);
    if (args.statuses !== undefined && args.statuses !== null) {
      try {
        const parsed = JSON.parse(args.statuses) as unknown;
        if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((s) => typeof s === 'string')) {
          throw new Error();
        }
      } catch {
        throw new ValidationError('statuses must be a non-empty JSON array of strings');
      }
    }
    const updated = await context.prisma.project.update({
      where: { projectId: args.projectId },
      data: {
        ...(args.name !== undefined && args.name !== null ? { name: args.name } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
        ...(args.prompt !== undefined ? { prompt: args.prompt } : {}),
        ...(args.knowledgeBase !== undefined ? { knowledgeBase: args.knowledgeBase } : {}),
        ...(args.statuses !== undefined && args.statuses !== null ? { statuses: args.statuses } : {}),
      },
    });
    logActivity(context.prisma, {
      orgId: user.orgId, projectId: args.projectId, userId: user.userId,
      action: 'project.updated',
      ...(args.name && args.name !== project.name ? { field: 'name', oldValue: project.name, newValue: args.name } : {}),
    });
    return updated;
  },

  archiveProject: async (_parent: unknown, args: { projectId: string; archived: boolean }, context: Context) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    await requireProjectAccess(context, args.projectId);
    const result = await context.prisma.project.update({
      where: { projectId: args.projectId },
      data: { archived: args.archived },
    });
    logActivity(context.prisma, {
      orgId: user.orgId, projectId: args.projectId, userId: user.userId,
      action: args.archived ? 'project.archived' : 'project.unarchived',
    });
    return result;
  },
};
