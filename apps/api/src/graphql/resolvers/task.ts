import type { Context } from '../context.js';
import { logActivity } from '../../utils/activity.js';
import { createNotification } from '../../utils/notification.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../errors.js';
import { requireAuth, requireOrg, requireProjectAccess } from './auth.js';
import { executeAutomations } from '../../utils/automationEngine.js';

// ── Task queries ──

export const taskQueries = {
  tasks: async (
    _parent: unknown,
    args: { projectId: string; parentTaskId?: string | null; limit?: number | null; offset?: number | null },
    context: Context
  ) => {
    await requireProjectAccess(context, args.projectId);
    const limit = args.limit ?? 100;
    const offset = args.offset ?? 0;
    const where = {
      projectId: args.projectId,
      parentTaskId: args.parentTaskId !== undefined ? args.parentTaskId : null,
    };
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
    const user = requireOrg(context);
    const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
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

  activities: async (_parent: unknown, args: { projectId?: string | null; taskId?: string | null; limit?: number | null }, context: Context) => {
    const user = requireOrg(context);
    const where: Record<string, unknown> = { orgId: user.orgId };
    if (args.projectId) where.projectId = args.projectId;
    if (args.taskId) where.taskId = args.taskId;
    const activities = await context.prisma.activity.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: args.limit ?? 50,
    });
    return activities.map((a: typeof activities[number]) => ({
      ...a,
      userEmail: a.user.email,
      createdAt: a.createdAt.toISOString(),
    }));
  },

  epics: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    return context.prisma.task.findMany({
      where: { projectId: args.projectId, taskType: 'epic', parentTaskId: null, archived: false },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  },
};

// ── Task mutations ──

export const taskMutations = {
  createTask: async (
    _parent: unknown,
    args: { projectId: string; title: string; status?: string; taskType?: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }
    const status = args.status ?? 'todo';
    const validStatuses = JSON.parse(project.statuses) as string[];
    if (!validStatuses.includes(status)) {
      throw new ValidationError(`Invalid status "${status}". Valid: ${validStatuses.join(', ')}`);
    }
    const validTaskTypes = ['epic', 'story', 'task', 'subtask'];
    const taskType = args.taskType ?? 'task';
    if (!validTaskTypes.includes(taskType)) {
      throw new ValidationError(`Invalid taskType "${taskType}". Valid: ${validTaskTypes.join(', ')}`);
    }
    const maxResult = await context.prisma.task.aggregate({
      where: { projectId: args.projectId, sprintId: null, parentTaskId: null },
      _max: { position: true },
    });
    const nextPosition = (maxResult._max.position ?? 0) + 1.0;
    const task = await context.prisma.task.create({
      data: {
        title: args.title,
        status,
        taskType,
        projectId: args.projectId,
        orgId: user.orgId,
        position: nextPosition,
      },
    });
    logActivity(context.prisma, {
      orgId: user.orgId, projectId: args.projectId, taskId: task.taskId, userId: user.userId,
      action: 'task.created',
    });
    return task;
  },

  updateTask: async (
    _parent: unknown,
    args: { taskId: string; title?: string; status?: string; description?: string; instructions?: string; acceptanceCriteria?: string; dependsOn?: string | null; sprintId?: string | null; sprintColumn?: string | null; assigneeId?: string | null; dueDate?: string | null; position?: number | null; archived?: boolean; storyPoints?: number | null; taskType?: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId }, include: { project: true } });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    if (args.status !== undefined) {
      const validStatuses = JSON.parse(task.project.statuses) as string[];
      if (!validStatuses.includes(args.status)) {
        throw new ValidationError(`Invalid status "${args.status}". Valid: ${validStatuses.join(', ')}`);
      }
    }
    const updated = await context.prisma.task.update({
      where: { taskId: args.taskId },
      data: {
        ...(args.title !== undefined ? { title: args.title } : {}),
        ...(args.status !== undefined ? { status: args.status } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
        ...(args.instructions !== undefined ? { instructions: args.instructions } : {}),
        ...(args.acceptanceCriteria !== undefined ? { acceptanceCriteria: args.acceptanceCriteria } : {}),
        ...(args.dependsOn !== undefined ? { dependsOn: args.dependsOn } : {}),
        ...(args.sprintId !== undefined ? { sprintId: args.sprintId } : {}),
        ...(args.sprintColumn !== undefined ? { sprintColumn: args.sprintColumn } : {}),
        ...(args.assigneeId !== undefined ? { assigneeId: args.assigneeId } : {}),
        ...(args.dueDate !== undefined ? { dueDate: args.dueDate } : {}),
        ...(args.position !== undefined ? { position: args.position } : {}),
        ...(args.archived !== undefined ? { archived: args.archived } : {}),
        ...(args.storyPoints !== undefined ? { storyPoints: args.storyPoints } : {}),
        ...(args.taskType !== undefined ? { taskType: args.taskType } : {}),
      },
    });
    // Log each changed field
    const fields: Array<[string, string | null | undefined, string | null | undefined]> = [
      ['title', task.title, args.title],
      ['status', task.status, args.status],
      ['assigneeId', task.assigneeId, args.assigneeId],
      ['sprintId', task.sprintId, args.sprintId],
      ['dueDate', task.dueDate, args.dueDate],
      ['dependsOn', task.dependsOn, args.dependsOn],
      ['archived', String(task.archived), args.archived !== undefined ? String(args.archived) : undefined],
    ];
    for (const [field, oldVal, newVal] of fields) {
      if (newVal !== undefined && newVal !== oldVal) {
        logActivity(context.prisma, {
          orgId: user.orgId, projectId: task.projectId, taskId: task.taskId, userId: user.userId,
          action: 'task.updated', field, oldValue: oldVal ?? null, newValue: newVal ?? null,
        });
      }
    }
    // Notify on assignment change
    if (args.assigneeId !== undefined && args.assigneeId !== task.assigneeId && args.assigneeId && args.assigneeId !== user.userId) {
      createNotification(context.prisma, {
        orgId: user.orgId,
        userId: args.assigneeId,
        type: 'assigned',
        title: `You were assigned to "${task.title}"`,
        linkUrl: `/app/projects/${task.projectId}`,
        relatedTaskId: task.taskId,
        relatedProjectId: task.projectId,
      });
    }
    // Notify on status change
    if (args.status !== undefined && args.status !== task.status && task.assigneeId && task.assigneeId !== user.userId) {
      const userRecord = await context.prisma.user.findUnique({ where: { userId: user.userId }, select: { email: true } });
      createNotification(context.prisma, {
        orgId: user.orgId,
        userId: task.assigneeId,
        type: 'status_changed',
        title: `${userRecord?.email ?? 'Someone'} changed "${task.title}" status to ${args.status}`,
        linkUrl: `/app/projects/${task.projectId}`,
        relatedTaskId: task.taskId,
        relatedProjectId: task.projectId,
      });
    }
    // Fire automation rules on status change
    if (args.status !== undefined && args.status !== task.status) {
      executeAutomations(context.prisma, {
        type: 'task.status_changed',
        projectId: task.projectId,
        orgId: user.orgId,
        taskId: task.taskId,
        userId: user.userId,
        data: { oldStatus: task.status, newStatus: args.status },
      });
    }
    return updated;
  },

  bulkUpdateTasks: async (
    _parent: unknown,
    args: { taskIds: string[]; status?: string | null; assigneeId?: string | null; sprintId?: string | null; archived?: boolean | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const tasks = await context.prisma.task.findMany({
      where: { taskId: { in: args.taskIds }, orgId: user.orgId },
    });
    if (tasks.length !== args.taskIds.length) {
      throw new NotFoundError('One or more tasks not found');
    }
    const data: Record<string, unknown> = {};
    if (args.status !== undefined && args.status !== null) data.status = args.status;
    if (args.assigneeId !== undefined) data.assigneeId = args.assigneeId;
    if (args.sprintId !== undefined) data.sprintId = args.sprintId;
    if (args.archived !== undefined && args.archived !== null) data.archived = args.archived;

    await context.prisma.task.updateMany({
      where: { taskId: { in: args.taskIds }, orgId: user.orgId },
      data,
    });
    const updated = await context.prisma.task.findMany({
      where: { taskId: { in: args.taskIds } },
    });
    for (const task of tasks) {
      logActivity(context.prisma, {
        orgId: user.orgId, projectId: task.projectId, taskId: task.taskId, userId: user.userId,
        action: 'task.bulk_updated',
        ...(args.status ? { field: 'status', oldValue: task.status, newValue: args.status } : {}),
      });
    }
    return updated;
  },

  createSubtask: async (
    _parent: unknown,
    args: { parentTaskId: string; title: string; taskType?: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const parent = await context.prisma.task.findUnique({ where: { taskId: args.parentTaskId } });
    if (!parent || parent.orgId !== user.orgId) {
      throw new NotFoundError('Parent task not found');
    }
    // Auto-assign taskType based on parent
    let taskType = args.taskType;
    if (!taskType) {
      if (parent.taskType === 'epic') taskType = 'story';
      else taskType = 'subtask';
    }
    const validTaskTypes = ['epic', 'story', 'task', 'subtask'];
    if (!validTaskTypes.includes(taskType)) {
      throw new ValidationError(`Invalid taskType "${taskType}". Valid: ${validTaskTypes.join(', ')}`);
    }
    const maxResult = await context.prisma.task.aggregate({
      where: { parentTaskId: args.parentTaskId },
      _max: { position: true },
    });
    const nextPosition = (maxResult._max.position ?? 0) + 1.0;
    const task = await context.prisma.task.create({
      data: {
        title: args.title,
        taskType,
        projectId: parent.projectId,
        orgId: parent.orgId,
        parentTaskId: args.parentTaskId,
        position: nextPosition,
      },
    });
    logActivity(context.prisma, {
      orgId: user.orgId, projectId: parent.projectId, taskId: task.taskId, userId: user.userId,
      action: 'task.created',
    });
    return task;
  },

  createComment: async (_parent: unknown, args: { taskId: string; content: string; parentCommentId?: string | null }, context: Context) => {
    const user = requireOrg(context);
    const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    if (args.parentCommentId) {
      const parent = await context.prisma.comment.findUnique({ where: { commentId: args.parentCommentId } });
      if (!parent || parent.taskId !== args.taskId) {
        throw new NotFoundError('Parent comment not found');
      }
    }
    const comment = await context.prisma.comment.create({
      data: {
        taskId: args.taskId,
        userId: user.userId,
        content: args.content,
        parentCommentId: args.parentCommentId ?? null,
      },
      include: { user: { select: { email: true } } },
    });
    logActivity(context.prisma, {
      orgId: user.orgId, projectId: task.projectId, taskId: task.taskId, userId: user.userId,
      action: 'comment.created',
    });
    if (task.assigneeId && task.assigneeId !== user.userId) {
      createNotification(context.prisma, {
        orgId: user.orgId,
        userId: task.assigneeId,
        type: 'commented',
        title: `New comment on "${task.title}"`,
        body: args.content.length > 100 ? args.content.slice(0, 100) + '\u2026' : args.content,
        linkUrl: `/app/projects/${task.projectId}`,
        relatedTaskId: task.taskId,
        relatedProjectId: task.projectId,
      });
    }
    const mentionPattern = /@(\S+@\S+)/g;
    let mentionMatch: RegExpExecArray | null;
    while ((mentionMatch = mentionPattern.exec(args.content)) !== null) {
      const mentionedEmail = mentionMatch[1];
      const mentionedUser = await context.prisma.user.findFirst({
        where: { email: mentionedEmail, orgId: user.orgId },
      });
      if (mentionedUser && mentionedUser.userId !== user.userId) {
        createNotification(context.prisma, {
          orgId: user.orgId,
          userId: mentionedUser.userId,
          type: 'mentioned',
          title: `You were mentioned in a comment on "${task.title}"`,
          body: args.content.length > 100 ? args.content.slice(0, 100) + '\u2026' : args.content,
          linkUrl: `/app/projects/${task.projectId}`,
          relatedTaskId: task.taskId,
          relatedProjectId: task.projectId,
        });
      }
    }
    return {
      ...comment,
      userEmail: comment.user.email,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      replies: [],
    };
  },

  updateComment: async (_parent: unknown, args: { commentId: string; content: string }, context: Context) => {
    const user = requireAuth(context);
    const comment = await context.prisma.comment.findUnique({ where: { commentId: args.commentId } });
    if (!comment) throw new NotFoundError('Comment not found');
    if (comment.userId !== user.userId) {
      throw new AuthorizationError('Not authorized to edit this comment');
    }
    const updated = await context.prisma.comment.update({
      where: { commentId: args.commentId },
      data: { content: args.content },
      include: { user: { select: { email: true } } },
    });
    return {
      ...updated,
      userEmail: updated.user.email,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
      replies: [],
    };
  },

  deleteComment: async (_parent: unknown, args: { commentId: string }, context: Context) => {
    const user = requireOrg(context);
    const comment = await context.prisma.comment.findUnique({ where: { commentId: args.commentId } });
    if (!comment) throw new NotFoundError('Comment not found');
    if (comment.userId !== user.userId && user.role !== 'org:admin') {
      throw new AuthorizationError('Not authorized to delete this comment');
    }
    await context.prisma.comment.deleteMany({ where: { parentCommentId: args.commentId } });
    await context.prisma.comment.delete({ where: { commentId: args.commentId } });
    return true;
  },
};

// ── Task field resolvers ──

export const taskFieldResolvers = {
  Task: {
    labels: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.taskLabels.load(parent.taskId);
    },
    githubIssueUrl: async (parent: { taskId: string; projectId: string; githubIssueNumber?: number | null }, _args: unknown, context: Context) => {
      if (!parent.githubIssueNumber) return null;
      const project = await context.loaders.projectById.load(parent.projectId);
      if (!project) return null;
      const owner = (project as unknown as { githubRepositoryOwner: string | null }).githubRepositoryOwner;
      const name = (project as unknown as { githubRepositoryName: string | null }).githubRepositoryName;
      if (!owner || !name) return null;
      return `https://github.com/${owner}/${name}/issues/${parent.githubIssueNumber}`;
    },
    pullRequests: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.taskPullRequests.load(parent.taskId);
    },
    commits: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.taskCommits.load(parent.taskId);
    },
    children: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.taskChildren.load(parent.taskId);
    },
    progress: async (parent: { taskId: string; taskType: string }, _args: unknown, context: Context) => {
      if (parent.taskType !== 'epic' && parent.taskType !== 'story') return null;
      const result = await context.loaders.taskProgress.load(parent.taskId);
      if (!result || result.total === 0) return { total: 0, completed: 0, percentage: 0 };
      return { total: result.total, completed: result.completed, percentage: Math.round((result.completed / result.total) * 100) };
    },
  },
};
