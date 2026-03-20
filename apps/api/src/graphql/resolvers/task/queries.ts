import type { Context } from '../../context.js';
import { requireOrg, requireProjectAccess } from '../auth.js';
import { requireTask } from '../../../utils/resolverHelpers.js';

// ── Filter types ──

export interface TaskFilterInput {
  status?: string[] | null;
  priority?: string[] | null;
  assigneeId?: string[] | null;
  labelIds?: string[] | null;
  search?: string | null;
  showArchived?: boolean | null;
  epicId?: string | null;
  sprintId?: string | null;
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
  sortBy?: string | null;
  sortOrder?: string | null;
}

const ALLOWED_SORT_FIELDS = new Set(['position', 'createdAt', 'dueDate', 'priority', 'title', 'status']);

function buildFilterWhere(
  projectId: string,
  filter: TaskFilterInput | null | undefined,
  parentTaskId: string | null | undefined,
): Record<string, unknown> {
  // When parentTaskId is explicitly provided, fetch subtasks (SUBTASKS_QUERY)
  if (parentTaskId !== undefined) {
    return { projectId, parentTaskId };
  }

  const where: Record<string, unknown> = { projectId, taskType: { not: 'epic' } };
  // Collect AND conditions — used for label AND logic and combining OR groups
  const andConditions: Record<string, unknown>[] = [];

  if (!filter) return where;

  // Archived filter — default: exclude archived
  if (!filter.showArchived) {
    where.archived = false;
  }

  // Status filter
  if (filter.status && filter.status.length > 0) {
    where.status = { in: filter.status };
  }

  // Priority filter
  if (filter.priority && filter.priority.length > 0) {
    where.priority = { in: filter.priority };
  }

  // Assignee filter — special handling for "unassigned"
  if (filter.assigneeId && filter.assigneeId.length > 0) {
    const hasUnassigned = filter.assigneeId.includes('unassigned');
    const realIds = filter.assigneeId.filter((id) => id !== 'unassigned');
    if (hasUnassigned && realIds.length > 0) {
      andConditions.push({ OR: [{ assigneeId: null }, { assigneeId: { in: realIds } }] });
    } else if (hasUnassigned) {
      where.assigneeId = null;
    } else {
      where.assigneeId = { in: realIds };
    }
  }

  // Label filter — AND logic: task must have ALL listed labels
  if (filter.labelIds && filter.labelIds.length > 0) {
    for (const labelId of filter.labelIds) {
      andConditions.push({ labels: { some: { labelId } } });
    }
  }

  // Search — case-insensitive on title and description
  if (filter.search && filter.search.trim()) {
    const term = filter.search.trim();
    andConditions.push({
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ],
    });
  }

  // Epic filter
  if (filter.epicId) {
    where.parentTaskId = filter.epicId;
  }

  // Sprint filter
  if (filter.sprintId) {
    where.sprintId = filter.sprintId;
  }

  // Due date range
  if (filter.dueDateFrom || filter.dueDateTo) {
    const dueDateFilter: Record<string, string> = {};
    if (filter.dueDateFrom) dueDateFilter.gte = filter.dueDateFrom;
    if (filter.dueDateTo) dueDateFilter.lte = filter.dueDateTo;
    where.dueDate = dueDateFilter;
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

function buildOrderBy(filter: TaskFilterInput | null | undefined): Record<string, string>[] {
  if (filter?.sortBy && ALLOWED_SORT_FIELDS.has(filter.sortBy)) {
    const order = filter.sortOrder === 'desc' ? 'desc' : 'asc';
    return [{ [filter.sortBy]: order }];
  }
  return [{ position: 'asc' }, { createdAt: 'asc' }];
}

// ── Task queries ──

export const taskQueries = {
  tasks: async (
    _parent: unknown,
    args: {
      projectId: string;
      filter?: TaskFilterInput | null;
      parentTaskId?: string | null;
      limit?: number | null;
      offset?: number | null;
    },
    context: Context
  ) => {
    await requireProjectAccess(context, args.projectId);
    const limit = Math.max(0, Math.min(args.limit ?? 100, 1000));
    const offset = Math.max(0, args.offset ?? 0);

    const where = buildFilterWhere(args.projectId, args.filter, args.parentTaskId);
    const orderBy = buildOrderBy(args.filter);

    const [tasks, total] = await Promise.all([
      context.prisma.task.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      context.prisma.task.count({ where }),
    ]);
    return { tasks, hasMore: offset + limit < total, total };
  },

  comments: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    await requireTask(context, args.taskId);
    const comments = await context.prisma.comment.findMany({
      where: { taskId: args.taskId, parentCommentId: null },
      include: { user: { select: { email: true } }, replies: { include: { user: { select: { email: true } } }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((c: typeof comments[number]) => ({
      ...c,
      userEmail: c.user.email,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      replies: c.replies.map((r: typeof c.replies[number]) => ({
        ...r,
        userEmail: r.user.email,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        replies: [],
      })),
    }));
  },

  activities: async (_parent: unknown, args: { projectId?: string | null; taskId?: string | null; limit?: number | null; cursor?: string | null }, context: Context) => {
    const user = requireOrg(context);
    const where: Record<string, unknown> = { orgId: user.orgId };
    if (args.projectId) where.projectId = args.projectId;
    if (args.taskId) where.taskId = args.taskId;
    const limit = args.limit ?? 50;
    const activities = await context.prisma.activity.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(args.cursor ? { cursor: { activityId: args.cursor }, skip: 1 } : {}),
    });
    const hasMore = activities.length > limit;
    const items = hasMore ? activities.slice(0, limit) : activities;
    const nextCursor = hasMore ? items[items.length - 1].activityId : null;
    return {
      activities: items.map((a: typeof activities[number]) => ({
        ...a,
        userEmail: a.user.email,
        createdAt: a.createdAt.toISOString(),
      })),
      hasMore,
      nextCursor,
    };
  },

  epics: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    return context.prisma.task.findMany({
      where: { projectId: args.projectId, taskType: 'epic', parentTaskId: null, archived: false },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  },

  taskWatchers: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    await requireTask(context, args.taskId);
    const watchers = await context.prisma.taskWatcher.findMany({
      where: { taskId: args.taskId },
      include: { user: true },
    });
    return watchers.map((w) => ({
      id: w.id,
      user: w.user,
      watchedAt: w.watchedAt.toISOString(),
    }));
  },

  customFields: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    return context.prisma.customField.findMany({
      where: { projectId: args.projectId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  },
};
