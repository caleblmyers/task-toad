import type { Context } from '../context.js';
// Re-export shared types for cross-package type consistency (API ↔ Web).
// These match the GraphQL response shapes consumed by the web client.
export type { Project as SharedProject } from '@tasktoad/shared-types';
import { logActivity } from '../../utils/activity.js';
import { AuthorizationError, NotFoundError, ValidationError } from '../errors.js';
import { requireAuth, requireOrg, requireProjectAccess } from './auth.js';
import { parseInput, CreateProjectInput, requireProject } from '../../utils/resolverHelpers.js';

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

    if (projects.length === 0) return [];

    const projectIds = projects.map((p: { projectId: string }) => p.projectId);
    const today = new Date().toISOString().slice(0, 10);

    // Batch: fetch ALL tasks for all projects in one query
    const allTasks = await context.prisma.task.findMany({
      where: { projectId: { in: projectIds }, parentTaskId: null, archived: false },
      select: { projectId: true, status: true, dueDate: true },
    });

    // Batch: fetch ALL active sprints for all projects in one query
    const activeSprints = await context.prisma.sprint.findMany({
      where: { projectId: { in: projectIds }, isActive: true, closedAt: null },
      select: { projectId: true, name: true },
    });

    // Group tasks by projectId
    const tasksByProject = new Map<string, Array<{ status: string; dueDate: string | null }>>();
    for (const t of allTasks) {
      const list = tasksByProject.get(t.projectId);
      if (list) list.push(t);
      else tasksByProject.set(t.projectId, [t]);
    }

    // Index active sprints by projectId
    const sprintByProject = new Map<string, string>();
    for (const s of activeSprints) {
      sprintByProject.set(s.projectId, s.name);
    }

    return projects.map((proj: { projectId: string; name: string }) => {
      const tasks = tasksByProject.get(proj.projectId) ?? [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === 'done').length;
      const overdueTasks = tasks.filter((t) =>
        t.dueDate && t.dueDate < today && t.status !== 'done'
      ).length;
      const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Status distribution
      const statusMap = new Map<string, number>();
      for (const t of tasks) {
        statusMap.set(t.status, (statusMap.get(t.status) ?? 0) + 1);
      }
      const statusDistribution = Array.from(statusMap, ([label, count]) => ({ label, count }));

      // Health score: simple heuristic (100 base, penalize overdue and low completion)
      let healthScore: number | null = null;
      if (totalTasks > 0) {
        healthScore = 100;
        healthScore -= Math.min(overdueTasks * 10, 50);
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
        activeSprint: sprintByProject.get(proj.projectId) ?? null,
        healthScore,
        statusDistribution,
      };
    });
  },

  savedFilters: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const user = requireAuth(context);
    await requireProjectAccess(context, args.projectId);
    const filters = await context.prisma.savedFilter.findMany({
      where: { projectId: args.projectId, userId: user.userId },
      orderBy: { createdAt: 'asc' },
    });
    return filters.map((f: typeof filters[number]) => ({ ...f, createdAt: f.createdAt.toISOString() }));
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
    const { project } = await requireProject(context, args.projectId);
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

  saveFilter: async (_parent: unknown, args: { projectId: string; name: string; filters: string }, context: Context) => {
    const user = requireAuth(context);
    await requireProjectAccess(context, args.projectId);
    if (!args.name.trim()) throw new ValidationError('Filter name is required');
    const filter = await context.prisma.savedFilter.create({
      data: { projectId: args.projectId, userId: user.userId, name: args.name.trim(), filters: args.filters },
    });
    return { ...filter, createdAt: filter.createdAt.toISOString() };
  },

  updateFilter: async (_parent: unknown, args: { savedFilterId: string; name?: string | null; filters?: string | null }, context: Context) => {
    const user = requireAuth(context);
    const filter = await context.prisma.savedFilter.findUnique({ where: { savedFilterId: args.savedFilterId } });
    if (!filter || filter.userId !== user.userId) throw new NotFoundError('Saved filter not found');
    const updated = await context.prisma.savedFilter.update({
      where: { savedFilterId: args.savedFilterId },
      data: {
        ...(args.name !== undefined && args.name !== null ? { name: args.name.trim() } : {}),
        ...(args.filters !== undefined && args.filters !== null ? { filters: args.filters } : {}),
      },
    });
    return { ...updated, createdAt: updated.createdAt.toISOString() };
  },

  deleteFilter: async (_parent: unknown, args: { savedFilterId: string }, context: Context) => {
    const user = requireAuth(context);
    const filter = await context.prisma.savedFilter.findUnique({ where: { savedFilterId: args.savedFilterId } });
    if (!filter || filter.userId !== user.userId) throw new NotFoundError('Saved filter not found');
    await context.prisma.savedFilter.delete({ where: { savedFilterId: args.savedFilterId } });
    return true;
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
