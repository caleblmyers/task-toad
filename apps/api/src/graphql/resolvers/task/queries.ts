import type { Context } from '../../context.js';
import { requireOrg, requireProjectAccess } from '../auth.js';
import { requireTask } from '../../../utils/resolverHelpers.js';

// ── Task queries ──

export const taskQueries = {
  tasks: async (
    _parent: unknown,
    args: { projectId: string; parentTaskId?: string | null; limit?: number | null; offset?: number | null },
    context: Context
  ) => {
    await requireProjectAccess(context, args.projectId);
    const limit = Math.max(0, Math.min(args.limit ?? 100, 1000));
    const offset = Math.max(0, args.offset ?? 0);
    let where: Record<string, unknown>;
    if (args.parentTaskId !== undefined) {
      // Explicit parentTaskId: fetch subtasks of a specific parent (SUBTASKS_QUERY)
      where = { projectId: args.projectId, parentTaskId: args.parentTaskId };
    } else {
      // Default: all non-epic tasks (root tasks + children of epics)
      where = { projectId: args.projectId, taskType: { not: 'epic' } };
    }
    const [tasks, total] = await Promise.all([
      context.prisma.task.findMany({
        where,
        orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
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

  customFields: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    return context.prisma.customField.findMany({
      where: { projectId: args.projectId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  },
};
