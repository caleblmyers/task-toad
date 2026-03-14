import { GraphQLError } from 'graphql';
import type { Context } from '../context.js';
import {
  planSprints as aiPlanSprints,
} from '../../ai/index.js';
import { logActivity } from '../../utils/activity.js';
import { requireOrg, requireProjectAccess, requireApiKey } from './auth.js';

// ── Sprint queries ──

export const sprintQueries = {
  sprints: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const { user } = await requireProjectAccess(context, args.projectId);
    return context.prisma.sprint.findMany({
      where: { projectId: args.projectId, orgId: user.orgId },
      orderBy: { createdAt: 'asc' },
    });
  },

  sprintVelocity: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const { user } = await requireProjectAccess(context, args.projectId);
    const closedSprints = await context.prisma.sprint.findMany({
      where: { projectId: args.projectId, orgId: user.orgId, closedAt: { not: null } },
      orderBy: { closedAt: 'asc' },
    });
    const results = [];
    for (const sprint of closedSprints) {
      const tasks = await context.prisma.task.findMany({
        where: { sprintId: sprint.sprintId, parentTaskId: null },
      });
      const doneTasks = tasks.filter((t: { status: string }) => t.status === 'done');
      results.push({
        sprintId: sprint.sprintId,
        sprintName: sprint.name,
        completedTasks: doneTasks.length,
        completedHours: doneTasks.reduce((s: number, t: { estimatedHours: number | null }) => s + (t.estimatedHours ?? 0), 0),
        totalTasks: tasks.length,
        totalHours: tasks.reduce((s: number, t: { estimatedHours: number | null }) => s + (t.estimatedHours ?? 0), 0),
      });
    }
    return results;
  },

  sprintBurndown: async (_parent: unknown, args: { sprintId: string }, context: Context) => {
    const user = requireOrg(context);
    const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
    if (!sprint || sprint.orgId !== user.orgId) {
      throw new GraphQLError('Sprint not found', { extensions: { code: 'NOT_FOUND' } });
    }
    if (!sprint.startDate || !sprint.endDate) {
      throw new GraphQLError('Sprint must have start and end dates', { extensions: { code: 'BAD_USER_INPUT' } });
    }

    const tasks = await context.prisma.task.findMany({
      where: { sprintId: sprint.sprintId, parentTaskId: null },
    });
    const totalScope = tasks.length;

    // Get status change activities for these tasks
    const taskIds = tasks.map((t: { taskId: string }) => t.taskId);
    const activities = await context.prisma.activity.findMany({
      where: {
        taskId: { in: taskIds },
        action: 'task.updated',
        field: 'status',
      },
      orderBy: { createdAt: 'asc' },
    });

    // Walk through each day
    const startDate = new Date(sprint.startDate + 'T00:00:00');
    const endDateOrToday = sprint.closedAt
      ? new Date(sprint.endDate + 'T23:59:59')
      : new Date(Math.min(new Date().getTime(), new Date(sprint.endDate + 'T23:59:59').getTime()));

    const days: Array<{ date: string; remaining: number; completed: number; added: number }> = [];
    let completedSoFar = 0;

    for (let d = new Date(startDate); d <= endDateOrToday; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      const dayEnd = new Date(dayStr + 'T23:59:59');

      // Count status changes to 'done' by this day
      const completedByDay = activities.filter((a: { newValue: string | null; createdAt: Date }) =>
        a.newValue === 'done' && a.createdAt <= dayEnd
      ).length;
      // Count status changes from 'done' (uncompleted) by this day
      const uncompletedByDay = activities.filter((a: { oldValue: string | null; createdAt: Date }) =>
        a.oldValue === 'done' && a.createdAt <= dayEnd
      ).length;

      completedSoFar = completedByDay - uncompletedByDay;
      if (completedSoFar < 0) completedSoFar = 0;

      days.push({
        date: dayStr,
        remaining: totalScope - completedSoFar,
        completed: completedSoFar,
        added: 0,
      });
    }

    return {
      days,
      totalScope,
      sprintName: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
    };
  },
};

// ── Sprint mutations ──

export const sprintMutations = {
  createSprint: async (_parent: unknown, args: { projectId: string; name: string; columns?: string | null; startDate?: string | null; endDate?: string | null }, context: Context) => {
    const user = requireOrg(context);
    const project = await context.prisma.project.findUnique({ where: { projectId: args.projectId } });
    if (!project || project.orgId !== user.orgId) {
      throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
    }
    const sprint = await context.prisma.sprint.create({
      data: {
        name: args.name,
        projectId: args.projectId,
        orgId: user.orgId,
        columns: args.columns ?? '["To Do","In Progress","Done"]',
        startDate: args.startDate ?? null,
        endDate: args.endDate ?? null,
      },
    });
    logActivity(context.prisma, {
      orgId: user.orgId, projectId: args.projectId, sprintId: sprint.sprintId, userId: user.userId,
      action: 'sprint.created',
    });
    return sprint;
  },

  updateSprint: async (_parent: unknown, args: { sprintId: string; name?: string | null; columns?: string | null; isActive?: boolean | null; startDate?: string | null; endDate?: string | null }, context: Context) => {
    const user = requireOrg(context);
    const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
    if (!sprint || sprint.orgId !== user.orgId) {
      throw new GraphQLError('Sprint not found', { extensions: { code: 'NOT_FOUND' } });
    }
    if (args.isActive === true) {
      await context.prisma.sprint.updateMany({
        where: { projectId: sprint.projectId },
        data: { isActive: false },
      });
    }
    const updated = await context.prisma.sprint.update({
      where: { sprintId: args.sprintId },
      data: {
        ...(args.name !== undefined && args.name !== null ? { name: args.name } : {}),
        ...(args.columns !== undefined && args.columns !== null ? { columns: args.columns } : {}),
        ...(args.isActive !== undefined && args.isActive !== null ? { isActive: args.isActive } : {}),
        ...(args.startDate !== undefined ? { startDate: args.startDate } : {}),
        ...(args.endDate !== undefined ? { endDate: args.endDate } : {}),
      },
    });
    logActivity(context.prisma, {
      orgId: user.orgId, projectId: sprint.projectId, sprintId: sprint.sprintId, userId: user.userId,
      action: 'sprint.updated',
    });
    return updated;
  },

  deleteSprint: async (_parent: unknown, args: { sprintId: string }, context: Context) => {
    const user = requireOrg(context);
    const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
    if (!sprint || sprint.orgId !== user.orgId) {
      throw new GraphQLError('Sprint not found', { extensions: { code: 'NOT_FOUND' } });
    }
    await context.prisma.task.updateMany({
      where: { sprintId: args.sprintId },
      data: { sprintId: null, sprintColumn: null },
    });
    await context.prisma.sprint.delete({ where: { sprintId: args.sprintId } });
    logActivity(context.prisma, {
      orgId: user.orgId, projectId: sprint.projectId, sprintId: sprint.sprintId, userId: user.userId,
      action: 'sprint.deleted',
    });
    return true;
  },

  closeSprint: async (
    _parent: unknown,
    args: {
      sprintId: string;
      incompleteTaskActions: Array<{ taskId: string; action: string; targetSprintId?: string | null }>;
    },
    context: Context
  ) => {
    const user = requireOrg(context);
    const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
    if (!sprint || sprint.orgId !== user.orgId) {
      throw new GraphQLError('Sprint not found', { extensions: { code: 'NOT_FOUND' } });
    }

    for (const item of args.incompleteTaskActions) {
      const task = await context.prisma.task.findUnique({ where: { taskId: item.taskId } });
      if (!task || task.orgId !== user.orgId) continue;

      if (item.action === 'backlog') {
        await context.prisma.task.update({
          where: { taskId: item.taskId },
          data: { sprintId: null, sprintColumn: null },
        });
      } else if (item.action === 'sprint' && item.targetSprintId) {
        const target = await context.prisma.sprint.findUnique({ where: { sprintId: item.targetSprintId } });
        if (target && target.orgId === user.orgId) {
          const cols = JSON.parse(target.columns) as string[];
          await context.prisma.task.update({
            where: { taskId: item.taskId },
            data: { sprintId: item.targetSprintId, sprintColumn: cols[0] ?? 'To Do' },
          });
        }
      } else if (item.action === 'archive') {
        await context.prisma.task.update({
          where: { taskId: item.taskId },
          data: { archived: true, sprintId: null, sprintColumn: null },
        });
      }
    }

    const closedSprint = await context.prisma.sprint.update({
      where: { sprintId: args.sprintId },
      data: { isActive: false, closedAt: new Date() },
    });

    const nextSprint = await context.prisma.sprint.findFirst({
      where: {
        projectId: sprint.projectId,
        closedAt: null,
        sprintId: { not: args.sprintId },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { sprint: closedSprint, nextSprint: nextSprint ?? null };
  },

  previewSprintPlan: async (
    _parent: unknown,
    args: { projectId: string; sprintLengthWeeks: number; teamSize: number },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findUnique({ where: { projectId: args.projectId } });
    if (!project || project.orgId !== user.orgId) {
      throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
    }
    const backlogTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null, sprintId: null },
      orderBy: { createdAt: 'asc' },
    });
    if (backlogTasks.length === 0) {
      throw new GraphQLError('No backlog tasks to plan. All tasks are already assigned to sprints.', {
        extensions: { code: 'NO_BACKLOG_TASKS' },
      });
    }
    const plans = await aiPlanSprints(
      apiKey,
      project.name,
      backlogTasks.map((t: typeof backlogTasks[number]) => ({
        title: t.title,
        estimatedHours: t.estimatedHours,
        priority: t.priority,
        dependsOn: t.dependsOn,
      })),
      args.sprintLengthWeeks,
      args.teamSize
    );
    return plans.map((p) => ({
      name: p.name,
      taskIds: p.taskIndices
        .filter((i) => i >= 0 && i < backlogTasks.length)
        .map((i) => backlogTasks[i].taskId),
      totalHours: p.totalHours,
    }));
  },

  commitSprintPlan: async (
    _parent: unknown,
    args: { projectId: string; sprints: Array<{ name: string; taskIds: string[] }> },
    context: Context
  ) => {
    const user = requireOrg(context);
    const project = await context.prisma.project.findUnique({ where: { projectId: args.projectId } });
    if (!project || project.orgId !== user.orgId) {
      throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
    }
    const defaultColumns = '["To Do","In Progress","Done"]';
    const firstColumn = 'To Do';
    const created = await Promise.all(
      args.sprints.map(async (sprintInput) => {
        const sprint = await context.prisma.sprint.create({
          data: {
            name: sprintInput.name,
            projectId: args.projectId,
            orgId: user.orgId,
            columns: defaultColumns,
          },
        });
        if (sprintInput.taskIds.length > 0) {
          await context.prisma.task.updateMany({
            where: { taskId: { in: sprintInput.taskIds }, orgId: user.orgId },
            data: { sprintId: sprint.sprintId, sprintColumn: firstColumn },
          });
        }
        return sprint;
      })
    );
    return created;
  },
};

// ── Sprint field resolvers ──

export const sprintFieldResolvers = {
  Sprint: {
    closedAt: (parent: { closedAt: Date | null }) =>
      parent.closedAt ? parent.closedAt.toISOString() : null,
  },
};
