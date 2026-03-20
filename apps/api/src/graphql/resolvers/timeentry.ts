import type { Context } from '../context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg } from './auth.js';
import { requireTask } from '../../utils/resolverHelpers.js';
import { requirePermission, Permission } from '../../auth/permissions.js';
import { logActivity } from '../../utils/activity.js';

// ── Helpers ──

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

interface TimeEntryRow {
  timeEntryId: string;
  taskId: string;
  userId: string;
  durationMinutes: number;
  description: string | null;
  loggedDate: string;
  billable: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { email: string };
}

function mapEntry(e: TimeEntryRow) {
  return {
    timeEntryId: e.timeEntryId,
    taskId: e.taskId,
    userId: e.userId,
    userEmail: e.user.email,
    durationMinutes: e.durationMinutes,
    description: e.description,
    loggedDate: e.loggedDate,
    billable: e.billable,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

// ── Queries ──

export const timeEntryQueries = {
  timeEntries: async (
    _parent: unknown,
    args: { taskId: string; limit?: number; cursor?: string },
    context: Context,
  ) => {
    await requireTask(context, args.taskId);

    const take = Math.min(args.limit ?? 50, 100);
    const where = { taskId: args.taskId };

    const [entries, agg] = await Promise.all([
      context.prisma.timeEntry.findMany({
        where,
        take,
        ...(args.cursor
          ? { cursor: { timeEntryId: args.cursor }, skip: 1 }
          : {}),
        orderBy: { createdAt: 'desc' as const },
        include: { user: { select: { email: true } } },
      }),
      context.prisma.timeEntry.aggregate({
        where,
        _sum: { durationMinutes: true },
      }),
    ]);

    return {
      entries: entries.map(mapEntry),
      totalMinutes: agg._sum.durationMinutes ?? 0,
    };
  },

  taskTimeSummary: async (
    _parent: unknown,
    args: { taskId: string },
    context: Context,
  ) => {
    const { task } = await requireTask(context, args.taskId);

    const [entries, agg] = await Promise.all([
      context.prisma.timeEntry.findMany({
        where: { taskId: args.taskId },
        orderBy: { createdAt: 'desc' as const },
        include: { user: { select: { email: true } } },
      }),
      context.prisma.timeEntry.aggregate({
        where: { taskId: args.taskId },
        _sum: { durationMinutes: true },
      }),
    ]);

    return {
      taskId: args.taskId,
      totalMinutes: agg._sum.durationMinutes ?? 0,
      estimatedHours: task.estimatedHours,
      entries: entries.map(mapEntry),
    };
  },

  sprintTimeSummary: async (
    _parent: unknown,
    args: { sprintId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);

    const sprint = await context.prisma.sprint.findUnique({
      where: { sprintId: args.sprintId },
    });
    if (!sprint || sprint.orgId !== user.orgId) {
      throw new NotFoundError('Sprint not found');
    }

    const tasks = await context.prisma.task.findMany({
      where: { sprintId: args.sprintId },
      select: { taskId: true },
    });
    const taskIds = tasks.map((t) => t.taskId);

    if (taskIds.length === 0) {
      return { sprintId: args.sprintId, totalMinutes: 0, byUser: [] };
    }

    const entries = await context.prisma.timeEntry.findMany({
      where: { taskId: { in: taskIds } },
      include: { user: { select: { email: true } } },
    });

    // Aggregate by user
    const byUserMap = new Map<string, { email: string; total: number }>();
    let totalMinutes = 0;
    for (const e of entries) {
      totalMinutes += e.durationMinutes;
      const existing = byUserMap.get(e.userId);
      if (existing) {
        existing.total += e.durationMinutes;
      } else {
        byUserMap.set(e.userId, {
          email: e.user.email,
          total: e.durationMinutes,
        });
      }
    }

    const byUser = Array.from(byUserMap.entries()).map(
      ([userId, { email, total }]) => ({
        userId,
        userEmail: email,
        totalMinutes: total,
      }),
    );

    return { sprintId: args.sprintId, totalMinutes, byUser };
  },
};

// ── Mutations ──

export const timeEntryMutations = {
  logTime: async (
    _parent: unknown,
    args: {
      taskId: string;
      durationMinutes: number;
      loggedDate: string;
      description?: string;
      billable?: boolean;
    },
    context: Context,
  ) => {
    const { user, task } = await requireTask(context, args.taskId);
    await requirePermission(context, task.projectId, Permission.LOG_TIME);

    if (args.durationMinutes <= 0) {
      throw new ValidationError('durationMinutes must be greater than 0');
    }
    if (!ISO_DATE_RE.test(args.loggedDate)) {
      throw new ValidationError(
        'loggedDate must be in YYYY-MM-DD format',
      );
    }

    const entry = await context.prisma.timeEntry.create({
      data: {
        orgId: user.orgId!,
        taskId: args.taskId,
        userId: user.userId,
        durationMinutes: args.durationMinutes,
        loggedDate: args.loggedDate,
        description: args.description ?? null,
        billable: args.billable ?? false,
      },
      include: { user: { select: { email: true } } },
    });

    logActivity(context.prisma, {
      orgId: user.orgId!,
      projectId: task.projectId,
      taskId: args.taskId,
      userId: user.userId,
      action: 'task.time_logged',
      newValue: `${args.durationMinutes}m`,
    });

    return mapEntry(entry);
  },

  updateTimeEntry: async (
    _parent: unknown,
    args: {
      timeEntryId: string;
      durationMinutes?: number;
      description?: string;
      billable?: boolean;
    },
    context: Context,
  ) => {
    const user = requireOrg(context);

    const entry = await context.prisma.timeEntry.findUnique({
      where: { timeEntryId: args.timeEntryId },
    });
    if (!entry || entry.orgId !== user.orgId) {
      throw new NotFoundError('Time entry not found');
    }
    if (entry.userId !== user.userId) {
      throw new ValidationError('You can only update your own time entries');
    }

    if (
      args.durationMinutes !== undefined &&
      args.durationMinutes !== null &&
      args.durationMinutes <= 0
    ) {
      throw new ValidationError('durationMinutes must be greater than 0');
    }

    const updated = await context.prisma.timeEntry.update({
      where: { timeEntryId: args.timeEntryId },
      data: {
        ...(args.durationMinutes !== undefined
          ? { durationMinutes: args.durationMinutes }
          : {}),
        ...(args.description !== undefined
          ? { description: args.description }
          : {}),
        ...(args.billable !== undefined ? { billable: args.billable } : {}),
      },
      include: { user: { select: { email: true } } },
    });

    return mapEntry(updated);
  },

  deleteTimeEntry: async (
    _parent: unknown,
    args: { timeEntryId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);

    const entry = await context.prisma.timeEntry.findUnique({
      where: { timeEntryId: args.timeEntryId },
    });
    if (!entry || entry.orgId !== user.orgId) {
      throw new NotFoundError('Time entry not found');
    }
    if (entry.userId !== user.userId) {
      throw new ValidationError('You can only delete your own time entries');
    }

    await context.prisma.timeEntry.delete({
      where: { timeEntryId: args.timeEntryId },
    });

    return true;
  },
};
