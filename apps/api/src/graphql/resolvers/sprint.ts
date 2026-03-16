import type { Context } from '../context.js';
import {
  planSprints as aiPlanSprints,
} from '../../ai/index.js';
import { logActivity } from '../../utils/activity.js';
import { NotFoundError, ValidationError } from '../errors.js';
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
    const sprintIds = closedSprints.map((s) => s.sprintId);
    const allSprintTasks = await context.loaders.sprintTasks.loadMany(sprintIds);
    return closedSprints.map((sprint, i) => {
      const loaded = allSprintTasks[i];
      const tasks = loaded instanceof Error ? [] : (loaded ?? []);
      const doneTasks = tasks.filter((t: { status: string }) => t.status === 'done');
      return {
        sprintId: sprint.sprintId,
        sprintName: sprint.name,
        completedTasks: doneTasks.length,
        completedHours: doneTasks.reduce((s: number, t: { estimatedHours: number | null }) => s + (t.estimatedHours ?? 0), 0),
        totalTasks: tasks.length,
        totalHours: tasks.reduce((s: number, t: { estimatedHours: number | null }) => s + (t.estimatedHours ?? 0), 0),
        pointsCompleted: doneTasks.reduce((s: number, t: { storyPoints: number | null }) => s + (t.storyPoints ?? 0), 0),
        pointsTotal: tasks.reduce((s: number, t: { storyPoints: number | null }) => s + (t.storyPoints ?? 0), 0),
      };
    });
  },

  sprintBurndown: async (_parent: unknown, args: { sprintId: string }, context: Context) => {
    const user = requireOrg(context);
    const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
    if (!sprint || sprint.orgId !== user.orgId) {
      throw new NotFoundError('Sprint not found');
    }
    if (!sprint.startDate || !sprint.endDate) {
      throw new ValidationError('Sprint must have start and end dates');
    }

    const tasks = await context.prisma.task.findMany({
      where: { sprintId: sprint.sprintId, parentTaskId: null },
    });
    const totalScope = tasks.length;

    const taskIds = tasks.map((t: { taskId: string }) => t.taskId);

    const startDate = new Date(sprint.startDate + 'T00:00:00');
    const endDateOrToday = sprint.closedAt
      ? new Date(sprint.endDate + 'T23:59:59')
      : new Date(Math.min(new Date().getTime(), new Date(sprint.endDate + 'T23:59:59').getTime()));

    const activities = await context.prisma.activity.findMany({
      where: {
        taskId: { in: taskIds },
        action: 'task.updated',
        field: 'status',
        createdAt: { gte: startDate, lte: endDateOrToday },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build per-day delta map in a single pass over sorted activities
    const deltaByDay = new Map<string, number>();
    for (const a of activities) {
      const dayStr = (a as { createdAt: Date }).createdAt.toISOString().split('T')[0];
      if (!deltaByDay.has(dayStr)) deltaByDay.set(dayStr, 0);
      if ((a as { newValue: string | null }).newValue === 'done') {
        deltaByDay.set(dayStr, deltaByDay.get(dayStr)! + 1);
      }
      if ((a as { oldValue: string | null }).oldValue === 'done') {
        deltaByDay.set(dayStr, deltaByDay.get(dayStr)! - 1);
      }
    }

    const days: Array<{ date: string; remaining: number; completed: number; added: number }> = [];
    let completedSoFar = 0;

    for (let d = new Date(startDate); d <= endDateOrToday; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];
      completedSoFar += deltaByDay.get(dayStr) ?? 0;
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
  createSprint: async (_parent: unknown, args: { projectId: string; name: string; goal?: string | null; columns?: string | null; startDate?: string | null; endDate?: string | null }, context: Context) => {
    const user = requireOrg(context);
    const project = await context.prisma.project.findUnique({ where: { projectId: args.projectId } });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }
    const sprint = await context.prisma.sprint.create({
      data: {
        name: args.name,
        goal: args.goal ?? null,
        projectId: args.projectId,
        orgId: user.orgId,
        columns: args.columns ?? '["To Do","In Progress","In Review","Done"]',
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

  updateSprint: async (_parent: unknown, args: { sprintId: string; name?: string | null; goal?: string | null; columns?: string | null; isActive?: boolean | null; startDate?: string | null; endDate?: string | null }, context: Context) => {
    const user = requireOrg(context);
    const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
    if (!sprint || sprint.orgId !== user.orgId) {
      throw new NotFoundError('Sprint not found');
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
        ...(args.goal !== undefined ? { goal: args.goal } : {}),
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
      throw new NotFoundError('Sprint not found');
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
      throw new NotFoundError('Sprint not found');
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
      throw new NotFoundError('Project not found');
    }
    const backlogTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null, sprintId: null },
      orderBy: { createdAt: 'asc' },
    });
    if (backlogTasks.length === 0) {
      throw new ValidationError('No backlog tasks to plan. All tasks are already assigned to sprints.');
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
      throw new NotFoundError('Project not found');
    }
    const defaultColumns = '["To Do","In Progress","In Review","Done"]';
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
