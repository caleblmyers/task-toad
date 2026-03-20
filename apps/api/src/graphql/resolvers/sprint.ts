import type { Context } from '../context.js';
export type { Sprint as SharedSprint, CloseSprintResult as SharedCloseSprintResult, SprintPlanItem as SharedSprintPlanItem } from '@tasktoad/shared-types';
import {
  planSprints as aiPlanSprints,
} from '../../ai/index.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg, requireProjectAccess, requireApiKey } from './auth.js';
import { requireProject } from '../../utils/resolverHelpers.js';
import { requirePermission, Permission } from '../../auth/permissions.js';
import { StringArraySchema } from '../../utils/zodSchemas.js';
import { createChildLogger } from '../../utils/logger.js';
import { getEventBus } from '../../infrastructure/eventbus/index.js';

const log = createChildLogger('sprint');

/** Validate wipLimits JSON: must be an object mapping column names to positive integers. */
function validateWipLimits(raw: string): Record<string, number> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ValidationError('wipLimits must be valid JSON');
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new ValidationError('wipLimits must be a JSON object');
  }
  for (const [key, val] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof val !== 'number' || !Number.isInteger(val) || val < 1) {
      throw new ValidationError(`wipLimits value for "${key}" must be a positive integer`);
    }
  }
  return parsed as Record<string, number>;
}

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

  cycleTimeMetrics: async (
    _parent: unknown,
    args: { projectId: string; sprintId?: string | null; fromDate?: string | null; toDate?: string | null },
    context: Context
  ) => {
    const { user } = await requireProjectAccess(context, args.projectId);

    // Build filter for completed tasks
    const where: Record<string, unknown> = {
      projectId: args.projectId,
      orgId: user.orgId,
      status: 'done',
    };
    if (args.sprintId) where.sprintId = args.sprintId;

    const tasks = await context.prisma.task.findMany({ where });

    if (tasks.length === 0) {
      return {
        tasks: [],
        avgLeadTimeHours: 0,
        avgCycleTimeHours: 0,
        p50LeadTimeHours: 0,
        p85LeadTimeHours: 0,
        p50CycleTimeHours: 0,
        p85CycleTimeHours: 0,
        totalCompleted: 0,
      };
    }

    const taskIds = tasks.map((t) => t.taskId);

    // Fetch all status-change activities for these tasks in one query
    const dateFilter: Record<string, unknown> = {};
    if (args.fromDate) dateFilter.gte = new Date(args.fromDate);
    if (args.toDate) dateFilter.lte = new Date(args.toDate + 'T23:59:59');

    const activities = await context.prisma.activity.findMany({
      where: {
        taskId: { in: taskIds },
        action: 'task.updated',
        field: 'status',
        ...(Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {}),
      },
      orderBy: { createdAt: 'asc' },
    });

    // Group activities by taskId
    const activityByTask = new Map<string, Array<{ newValue: string | null; createdAt: Date }>>();
    for (const a of activities) {
      const list = activityByTask.get(a.taskId!) ?? [];
      list.push({ newValue: a.newValue, createdAt: a.createdAt });
      activityByTask.set(a.taskId!, list);
    }

    const taskMetrics: Array<{
      taskId: string;
      title: string;
      status: string;
      leadTimeHours: number | null;
      cycleTimeHours: number | null;
      startedAt: string | null;
      completedAt: string | null;
    }> = [];
    const leadTimes: number[] = [];
    const cycleTimes: number[] = [];

    for (const task of tasks) {
      const acts = activityByTask.get(task.taskId) ?? [];
      const firstInProgress = acts.find((a) => a.newValue === 'in_progress');
      const firstDone = acts.find((a) => a.newValue === 'done');

      const startedAt = firstInProgress ? firstInProgress.createdAt : null;
      const completedAt = firstDone ? firstDone.createdAt : null;

      // Apply date filter to completed date
      if (args.fromDate && completedAt && completedAt < new Date(args.fromDate)) continue;
      if (args.toDate && completedAt && completedAt > new Date(args.toDate + 'T23:59:59')) continue;

      const leadTimeHours = completedAt
        ? (completedAt.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60)
        : null;
      const cycleTimeHours = completedAt && startedAt
        ? (completedAt.getTime() - startedAt.getTime()) / (1000 * 60 * 60)
        : null;

      if (leadTimeHours !== null) leadTimes.push(leadTimeHours);
      if (cycleTimeHours !== null) cycleTimes.push(cycleTimeHours);

      taskMetrics.push({
        taskId: task.taskId,
        title: task.title,
        status: task.status,
        leadTimeHours,
        cycleTimeHours,
        startedAt: startedAt ? startedAt.toISOString() : null,
        completedAt: completedAt ? completedAt.toISOString() : null,
      });
    }

    const percentile = (sorted: number[], p: number): number => {
      if (sorted.length === 0) return 0;
      const idx = Math.ceil((p / 100) * sorted.length) - 1;
      return sorted[Math.max(0, idx)];
    };

    const avg = (arr: number[]): number =>
      arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;

    leadTimes.sort((a, b) => a - b);
    cycleTimes.sort((a, b) => a - b);

    return {
      tasks: taskMetrics,
      avgLeadTimeHours: Math.round(avg(leadTimes) * 100) / 100,
      avgCycleTimeHours: Math.round(avg(cycleTimes) * 100) / 100,
      p50LeadTimeHours: Math.round(percentile(leadTimes, 50) * 100) / 100,
      p85LeadTimeHours: Math.round(percentile(leadTimes, 85) * 100) / 100,
      p50CycleTimeHours: Math.round(percentile(cycleTimes, 50) * 100) / 100,
      p85CycleTimeHours: Math.round(percentile(cycleTimes, 85) * 100) / 100,
      totalCompleted: taskMetrics.length,
    };
  },

  sprintWipStatus: async (_parent: unknown, args: { sprintId: string }, context: Context) => {
    const user = requireOrg(context);
    const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
    if (!sprint || sprint.orgId !== user.orgId) {
      throw new NotFoundError('Sprint not found');
    }
    const columns: string[] = JSON.parse(sprint.columns);
    const wipLimits: Record<string, number> = sprint.wipLimits ? JSON.parse(sprint.wipLimits) : {};
    const tasks = await context.prisma.task.findMany({
      where: { sprintId: sprint.sprintId, archived: { not: true } },
      select: { sprintColumn: true },
    });
    const counts = new Map<string, number>();
    for (const col of columns) counts.set(col, 0);
    for (const t of tasks) {
      const col = t.sprintColumn ?? columns[0];
      counts.set(col, (counts.get(col) ?? 0) + 1);
    }
    return columns.map((col) => {
      const taskCount = counts.get(col) ?? 0;
      const limit = wipLimits[col] ?? null;
      return {
        column: col,
        taskCount,
        limit,
        exceeded: limit !== null && taskCount > limit,
      };
    });
  },

  cumulativeFlow: async (
    _parent: unknown,
    args: { projectId: string; sprintId?: string | null; fromDate?: string | null; toDate?: string | null },
    context: Context
  ) => {
    const { user } = await requireProjectAccess(context, args.projectId);
    const DEFAULT_STATUSES = ['todo', 'in_progress', 'in_review', 'done'];

    // Build task filter
    const taskWhere: Record<string, unknown> = {
      projectId: args.projectId,
      orgId: user.orgId,
      taskType: { not: 'epic' },
      OR: [{ parentTaskId: null }, { parentTask: { taskType: 'epic' } }],
    };
    if (args.sprintId) taskWhere.sprintId = args.sprintId;

    const tasks = await context.prisma.task.findMany({ where: taskWhere, select: { taskId: true, status: true, createdAt: true } });
    if (tasks.length === 0) {
      return { days: [], statuses: DEFAULT_STATUSES };
    }

    const taskIds = tasks.map((t) => t.taskId);

    // Determine date range
    const earliest = tasks.reduce((min, t) => (t.createdAt < min ? t.createdAt : min), tasks[0].createdAt);
    const fromDate = args.fromDate ? new Date(args.fromDate + 'T00:00:00') : earliest;
    const toDate = args.toDate ? new Date(args.toDate + 'T23:59:59') : new Date();

    // Get all status-change activities in range
    const activities = await context.prisma.activity.findMany({
      where: {
        taskId: { in: taskIds },
        action: 'task.updated',
        field: 'status',
        createdAt: { gte: fromDate, lte: toDate },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Build initial status snapshot: count tasks that existed at fromDate
    const statusCounts = new Map<string, number>();
    for (const s of DEFAULT_STATUSES) statusCounts.set(s, 0);

    for (const t of tasks) {
      if (t.createdAt <= fromDate) {
        statusCounts.set(t.status, (statusCounts.get(t.status) ?? 0) + 1);
      }
    }

    // For tasks created before fromDate, we need to rewind their status to what it was at fromDate.
    // The current status reflects all activities, so we need to "undo" activities after fromDate.
    // Actually, the simpler approach: start from the task's current status and walk backward.
    // Better: use the initial snapshot as tasks' status at creation time (todo) and replay all
    // activities from the beginning up to fromDate to get accurate initial counts.

    // Rebuild: start fresh — each task starts as 'todo' when created, then replay activities
    for (const s of DEFAULT_STATUSES) statusCounts.set(s, 0);

    // Get ALL status activities for these tasks (not just in range) to reconstruct state at fromDate
    const allActivities = await context.prisma.activity.findMany({
      where: {
        taskId: { in: taskIds },
        action: 'task.updated',
        field: 'status',
      },
      orderBy: { createdAt: 'asc' },
    });

    // Compute status of each task at fromDate
    const taskStatusAtFromDate = new Map<string, string>();
    for (const t of tasks) {
      if (t.createdAt <= fromDate) {
        taskStatusAtFromDate.set(t.taskId, 'todo'); // default creation status
      }
    }
    for (const a of allActivities) {
      if (a.createdAt <= fromDate && a.taskId && taskStatusAtFromDate.has(a.taskId) && a.newValue) {
        taskStatusAtFromDate.set(a.taskId, a.newValue);
      }
    }

    // Set initial counts from snapshot
    for (const status of taskStatusAtFromDate.values()) {
      statusCounts.set(status, (statusCounts.get(status) ?? 0) + 1);
    }

    // Group in-range activities by day, and also track task creations by day
    const dayActivities = new Map<string, Array<{ taskId: string | null; oldValue: string | null; newValue: string | null }>>();
    const dayCreations = new Map<string, number>();

    for (const a of activities) {
      const dayStr = a.createdAt.toISOString().split('T')[0];
      if (!dayActivities.has(dayStr)) dayActivities.set(dayStr, []);
      dayActivities.get(dayStr)!.push({ taskId: a.taskId, oldValue: a.oldValue, newValue: a.newValue });
    }

    // Track tasks created after fromDate (they appear in 'todo')
    for (const t of tasks) {
      if (t.createdAt > fromDate && t.createdAt <= toDate) {
        const dayStr = t.createdAt.toISOString().split('T')[0];
        dayCreations.set(dayStr, (dayCreations.get(dayStr) ?? 0) + 1);
      }
    }

    // Walk day-by-day from fromDate to toDate
    const days: Array<{ date: string; statusCounts: Array<{ status: string; count: number }> }> = [];
    const startDay = new Date(fromDate);
    startDay.setHours(0, 0, 0, 0);
    const endDay = new Date(toDate);
    endDay.setHours(0, 0, 0, 0);

    for (let d = new Date(startDay); d <= endDay; d.setDate(d.getDate() + 1)) {
      const dayStr = d.toISOString().split('T')[0];

      // Add newly created tasks for this day
      const created = dayCreations.get(dayStr) ?? 0;
      if (created > 0) {
        statusCounts.set('todo', (statusCounts.get('todo') ?? 0) + created);
      }

      // Apply status transitions for this day
      const acts = dayActivities.get(dayStr) ?? [];
      for (const a of acts) {
        if (a.oldValue) {
          statusCounts.set(a.oldValue, Math.max(0, (statusCounts.get(a.oldValue) ?? 0) - 1));
        }
        if (a.newValue) {
          statusCounts.set(a.newValue, (statusCounts.get(a.newValue) ?? 0) + 1);
        }
      }

      days.push({
        date: dayStr,
        statusCounts: DEFAULT_STATUSES.map((s) => ({
          status: s,
          count: statusCounts.get(s) ?? 0,
        })),
      });
    }

    return { days, statuses: DEFAULT_STATUSES };
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
      where: { sprintId: sprint.sprintId, taskType: { not: 'epic' }, OR: [{ parentTaskId: null }, { parentTask: { taskType: 'epic' } }] },
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
  createSprint: async (_parent: unknown, args: { projectId: string; name: string; goal?: string | null; columns?: string | null; startDate?: string | null; endDate?: string | null; wipLimits?: string | null }, context: Context) => {
    if (!args.name.trim()) {
      throw new ValidationError('Name is required');
    }
    if (args.wipLimits) validateWipLimits(args.wipLimits);
    await requirePermission(context, args.projectId, Permission.MANAGE_SPRINTS);
    const { user } = await requireProject(context, args.projectId);
    const sprint = await context.prisma.sprint.create({
      data: {
        name: args.name,
        goal: args.goal ?? null,
        projectId: args.projectId,
        orgId: user.orgId,
        columns: args.columns ?? '["To Do","In Progress","In Review","Done"]',
        startDate: args.startDate ?? null,
        endDate: args.endDate ?? null,
        wipLimits: args.wipLimits ?? null,
      },
    });
    getEventBus().emit('sprint.created', {
      orgId: user.orgId, userId: user.userId, projectId: args.projectId,
      timestamp: new Date().toISOString(),
      sprint: { sprintId: sprint.sprintId, name: sprint.name, projectId: sprint.projectId, orgId: sprint.orgId },
    });
    return sprint;
  },

  updateSprint: async (_parent: unknown, args: { sprintId: string; name?: string | null; goal?: string | null; columns?: string | null; isActive?: boolean | null; startDate?: string | null; endDate?: string | null; wipLimits?: string | null }, context: Context) => {
    const user = requireOrg(context);
    const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
    if (!sprint || sprint.orgId !== user.orgId) {
      throw new NotFoundError('Sprint not found');
    }
    await requirePermission(context, sprint.projectId, Permission.MANAGE_SPRINTS);
    if (args.wipLimits) validateWipLimits(args.wipLimits);
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
        ...(args.wipLimits !== undefined ? { wipLimits: args.wipLimits } : {}),
      },
    });
    getEventBus().emit('sprint.updated', {
      orgId: user.orgId, userId: user.userId, projectId: sprint.projectId,
      timestamp: new Date().toISOString(),
      sprint: { sprintId: updated.sprintId, name: updated.name, projectId: updated.projectId, orgId: updated.orgId },
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
    getEventBus().emit('sprint.deleted', {
      orgId: user.orgId, userId: user.userId, projectId: sprint.projectId,
      timestamp: new Date().toISOString(),
      sprintId: sprint.sprintId, sprintName: sprint.name,
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
    await requirePermission(context, sprint.projectId, Permission.CLOSE_SPRINTS);

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
          const parseResult = StringArraySchema.safeParse(JSON.parse(target.columns));
          const cols = parseResult.success ? parseResult.data : [];
          if (!parseResult.success) {
            log.warn({ sprintId: item.targetSprintId, error: parseResult.error.message }, 'Invalid sprint columns JSON');
          }
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

    getEventBus().emit('sprint.closed', {
      orgId: user.orgId, userId: user.userId, projectId: sprint.projectId,
      timestamp: new Date().toISOString(),
      sprint: { sprintId: closedSprint.sprintId, name: closedSprint.name, projectId: closedSprint.projectId, orgId: closedSprint.orgId },
    });
    return { sprint: closedSprint, nextSprint: nextSprint ?? null };
  },

  previewSprintPlan: async (
    _parent: unknown,
    args: { projectId: string; sprintLengthWeeks: number; teamSize: number },
    context: Context
  ) => {
    const { user, project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    const backlogTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, sprintId: null, taskType: { not: 'epic' }, OR: [{ parentTaskId: null }, { parentTask: { taskType: 'epic' } }] },
      orderBy: { createdAt: 'asc' },
    });
    if (backlogTasks.length === 0) {
      throw new ValidationError('No backlog tasks to plan. All tasks are already assigned to sprints.');
    }

    // Fetch team capacity data for per-member distribution
    let teamCapacity: { userId: string; userEmail: string; hoursPerWeek: number; availableHours: number }[] | undefined;
    const members = await context.prisma.projectMember.findMany({
      where: { projectId: args.projectId },
      include: { user: { select: { userId: true, email: true } } },
    });
    if (members.length > 0) {
      const memberUserIds = members.map((m: typeof members[number]) => m.userId);
      const capacities = await context.prisma.userCapacity.findMany({
        where: { orgId: user.orgId, userId: { in: memberUserIds } },
      });
      const capacityMap = new Map(capacities.map((c: typeof capacities[number]) => [c.userId, c.hoursPerWeek]));

      // Only include capacity if at least one member has a record
      if (capacities.length > 0) {
        teamCapacity = members.map((m: typeof members[number]) => {
          const hoursPerWeek = capacityMap.get(m.userId) ?? 40;
          return {
            userId: m.userId,
            userEmail: m.user.email,
            hoursPerWeek,
            availableHours: hoursPerWeek * args.sprintLengthWeeks,
          };
        });
      }
    }

    const plans = await aiPlanSprints(
      apiKey,
      project.name,
      backlogTasks.map((t: typeof backlogTasks[number]) => ({
        title: t.title,
        estimatedHours: t.estimatedHours,
        priority: t.priority,
      })),
      args.sprintLengthWeeks,
      args.teamSize,
      undefined,
      teamCapacity,
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
    const { user } = await requireProject(context, args.projectId);
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
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    closedAt: (parent: { closedAt: Date | null }) =>
      parent.closedAt ? parent.closedAt.toISOString() : null,
  },
};
