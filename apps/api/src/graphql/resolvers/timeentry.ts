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
  autoTracked: boolean;
  createdAt: Date;
  updatedAt: Date;
  user: { email: string; displayName?: string | null };
}

function mapEntry(e: TimeEntryRow) {
  return {
    timeEntryId: e.timeEntryId,
    taskId: e.taskId,
    userId: e.userId,
    userEmail: e.user.email,
    userDisplayName: e.user.displayName ?? null,
    durationMinutes: e.durationMinutes,
    description: e.description,
    loggedDate: e.loggedDate,
    billable: e.billable,
    autoTracked: e.autoTracked,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

function getISOWeek(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00Z');
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
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
        include: { user: { select: { email: true, displayName: true } } },
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
        include: { user: { select: { email: true, displayName: true } } },
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
      include: { user: { select: { email: true, displayName: true } } },
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

  workloadHeatmap: async (
    _parent: unknown,
    args: { projectId: string; startDate: string; endDate: string },
    context: Context,
  ) => {
    const user = requireOrg(context);

    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }

    // Load tasks with assignees and their estimated hours
    const tasks = await context.prisma.task.findMany({
      where: {
        projectId: args.projectId,
        archived: false,
      },
      select: {
        taskId: true,
        estimatedHours: true,
        dueDate: true,
        createdAt: true,
        taskAssignees: {
          select: {
            userId: true,
            user: { select: { email: true, displayName: true } },
          },
        },
      },
    });

    // Load time entries for actual hours
    const taskIds = tasks.map((t) => t.taskId);
    const timeEntries = taskIds.length > 0
      ? await context.prisma.timeEntry.findMany({
          where: {
            taskId: { in: taskIds },
            loggedDate: { gte: args.startDate, lte: args.endDate },
          },
          select: {
            userId: true,
            durationMinutes: true,
            loggedDate: true,
            user: { select: { email: true, displayName: true } },
          },
        })
      : [];

    // Build map: (userId, week) → { totalHours, taskCount, userName }
    const cellMap = new Map<string, { userId: string; userName: string; week: string; totalHours: number; taskCount: number }>();

    const getKey = (userId: string, week: string) => `${userId}::${week}`;

    // Add time entries (actual hours)
    for (const entry of timeEntries) {
      const week = getISOWeek(entry.loggedDate);
      const key = getKey(entry.userId, week);
      const existing = cellMap.get(key);
      if (existing) {
        existing.totalHours += entry.durationMinutes / 60;
      } else {
        cellMap.set(key, {
          userId: entry.userId,
          userName: (entry.user as { displayName?: string | null; email: string }).displayName || entry.user.email.split('@')[0],
          week,
          totalHours: entry.durationMinutes / 60,
          taskCount: 0,
        });
      }
    }

    // Count tasks per user per week (using dueDate or createdAt for week assignment)
    for (const task of tasks) {
      const taskDate = task.dueDate ?? task.createdAt.toISOString().slice(0, 10);
      if (taskDate < args.startDate || taskDate > args.endDate) continue;
      const week = getISOWeek(taskDate);
      for (const assignee of task.taskAssignees) {
        const key = getKey(assignee.userId, week);
        const existing = cellMap.get(key);
        if (existing) {
          existing.taskCount += 1;
          // Add estimated hours if no actual time entries exist for this user/week combo
          if (existing.totalHours === 0 && task.estimatedHours) {
            existing.totalHours += task.estimatedHours;
          }
        } else {
          cellMap.set(key, {
            userId: assignee.userId,
            userName: (assignee.user as { displayName?: string | null; email: string }).displayName || assignee.user.email.split('@')[0],
            week,
            totalHours: task.estimatedHours ?? 0,
            taskCount: 1,
          });
        }
      }
    }

    return Array.from(cellMap.values()).map((c) => ({
      ...c,
      totalHours: Math.round(c.totalHours * 100) / 100,
    }));
  },

  timesheetData: async (
    _parent: unknown,
    args: { projectId: string; userId?: string; weekStart: string },
    context: Context,
  ) => {
    const user = requireOrg(context);

    if (!ISO_DATE_RE.test(args.weekStart)) {
      throw new ValidationError('weekStart must be in YYYY-MM-DD format');
    }

    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }

    // Calculate Mon-Sun dates for the week
    const start = new Date(args.weekStart + 'T00:00:00Z');
    // Adjust to Monday if not already
    const dayOfWeek = start.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    start.setUTCDate(start.getUTCDate() + mondayOffset);

    const dates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }

    const weekStartDate = dates[0];
    const weekEndDate = dates[6];

    // Fetch time entries for the week within this project
    const timeEntries = await context.prisma.timeEntry.findMany({
      where: {
        loggedDate: { gte: weekStartDate, lte: weekEndDate },
        task: { projectId: args.projectId },
        ...(args.userId ? { userId: args.userId } : {}),
      },
      include: {
        task: { select: { taskId: true, title: true, status: true } },
      },
    });

    // Group by task, then by date
    const taskMap = new Map<
      string,
      {
        taskId: string;
        taskTitle: string;
        taskStatus: string;
        entriesByDate: Map<string, { minutes: number; timeEntryId: string | null }>;
      }
    >();

    for (const entry of timeEntries) {
      let row = taskMap.get(entry.taskId);
      if (!row) {
        row = {
          taskId: entry.task.taskId,
          taskTitle: entry.task.title,
          taskStatus: entry.task.status,
          entriesByDate: new Map(),
        };
        taskMap.set(entry.taskId, row);
      }
      const existing = row.entriesByDate.get(entry.loggedDate);
      if (existing) {
        existing.minutes += entry.durationMinutes;
        // Keep the most recent entry ID for editing
        existing.timeEntryId = entry.timeEntryId;
      } else {
        row.entriesByDate.set(entry.loggedDate, {
          minutes: entry.durationMinutes,
          timeEntryId: entry.timeEntryId,
        });
      }
    }

    // Sort: in_progress first, then todo, then done
    const statusOrder: Record<string, number> = { in_progress: 0, todo: 1, done: 2 };
    const sortedTasks = Array.from(taskMap.values()).sort((a, b) => {
      const aOrder = statusOrder[a.taskStatus] ?? 1;
      const bOrder = statusOrder[b.taskStatus] ?? 1;
      return aOrder - bOrder;
    });

    const dailyTotals = dates.map(() => 0);
    let weekTotal = 0;

    const rows = sortedTasks.map((task) => {
      let rowTotal = 0;
      const entries = dates.map((date, i) => {
        const entry = task.entriesByDate.get(date);
        const minutes = entry?.minutes ?? 0;
        rowTotal += minutes;
        dailyTotals[i] += minutes;
        return {
          date,
          minutes,
          timeEntryId: entry?.timeEntryId ?? null,
        };
      });
      weekTotal += rowTotal;
      return {
        taskId: task.taskId,
        taskTitle: task.taskTitle,
        taskStatus: task.taskStatus,
        entries,
        weekTotal: Math.round((rowTotal / 60) * 100) / 100,
      };
    });

    return {
      rows,
      dailyTotals: dailyTotals.map((m) => Math.round((m / 60) * 100) / 100),
      weekTotal: Math.round((weekTotal / 60) * 100) / 100,
    };
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
      include: { user: { select: { email: true, displayName: true } } },
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
      include: { user: { select: { email: true, displayName: true } } },
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
