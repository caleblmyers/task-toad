import type { Context } from '../context.js';
import { logActivity } from '../../utils/activity.js';
import { createNotification } from '../../utils/notification.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../errors.js';
import { requireAuth, requireOrg, requireProjectAccess } from './auth.js';
import { executeAutomations } from '../../utils/automationEngine.js';
import { dispatchWebhooks } from '../../utils/webhookDispatcher.js';
import { dispatchSlackNotifications } from '../../utils/notificationUtils.js';
import { sseManager } from '../../utils/sseManager.js';
import { requireTask, requireProject, validateStatus, parseInput, CreateTaskInput, UpdateTaskInput, CreateCommentInput } from '../../utils/resolverHelpers.js';

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

// ── Task mutations ──

export const taskMutations = {
  createTask: async (
    _parent: unknown,
    args: { projectId: string; title: string; status?: string; taskType?: string },
    context: Context
  ) => {
    parseInput(CreateTaskInput, { title: args.title });
    const { user, project } = await requireProject(context, args.projectId);
    const status = args.status ?? 'todo';
    const validStatuses = JSON.parse(project.statuses) as string[];
    validateStatus(validStatuses, status);
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
    dispatchWebhooks(context.prisma, user.orgId, 'task.created', { task });
    dispatchSlackNotifications(context.prisma, user.orgId, 'task.created', { task });
    sseManager.broadcast(user.orgId, 'task.created', { task });
    return task;
  },

  updateTask: async (
    _parent: unknown,
    args: { taskId: string; title?: string; status?: string; description?: string; instructions?: string; acceptanceCriteria?: string; dependsOn?: string | null; sprintId?: string | null; sprintColumn?: string | null; assigneeId?: string | null; dueDate?: string | null; position?: number | null; archived?: boolean; storyPoints?: number | null; taskType?: string },
    context: Context
  ) => {
    parseInput(UpdateTaskInput, { title: args.title, description: args.description, instructions: args.instructions, acceptanceCriteria: args.acceptanceCriteria });
    const { user, task } = await requireTask(context, args.taskId);
    if (args.status !== undefined) {
      const validStatuses = JSON.parse(task.project.statuses) as string[];
      validateStatus(validStatuses, args.status);
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
    const changes: Record<string, unknown> = {};
    for (const [field, oldVal, newVal] of fields) {
      if (newVal !== undefined && newVal !== oldVal) {
        changes[field] = { old: oldVal, new: newVal };
      }
    }
    if (Object.keys(changes).length > 0) {
      dispatchWebhooks(context.prisma, user.orgId, 'task.updated', { task: updated, changes });
      dispatchSlackNotifications(context.prisma, user.orgId, 'task.updated', { task: updated, changes });
      sseManager.broadcast(user.orgId, 'task.updated', { task: updated });
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
    // Verify per-project access for all tasks
    const projectIds = [...new Set(tasks.map((t) => t.projectId))];
    for (const projectId of projectIds) {
      await requireProjectAccess(context, projectId);
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
    sseManager.broadcast(user.orgId, 'tasks.bulk_updated', { taskIds: args.taskIds });
    return updated;
  },

  createSubtask: async (
    _parent: unknown,
    args: { parentTaskId: string; title: string; taskType?: string },
    context: Context
  ) => {
    parseInput(CreateTaskInput, { title: args.title });
    const { user, task: parent } = await requireTask(context, args.parentTaskId);
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
    parseInput(CreateCommentInput, { content: args.content });
    const { user, task } = await requireTask(context, args.taskId);
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
    // Extract mentions with tighter email regex, capped at 20
    const mentionPattern = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const mentionedEmails: string[] = [];
    let mentionMatch: RegExpExecArray | null;
    while ((mentionMatch = mentionPattern.exec(args.content)) !== null) {
      mentionedEmails.push(mentionMatch[1]);
      if (mentionedEmails.length >= 20) break;
    }
    // Batch DB lookup — single findMany instead of N queries
    if (mentionedEmails.length > 0) {
      const mentionedUsers = await context.prisma.user.findMany({
        where: { email: { in: mentionedEmails }, orgId: user.orgId },
      });
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser.userId !== user.userId) {
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
    }
    dispatchWebhooks(context.prisma, user.orgId, 'comment.created', {
      comment: { commentId: comment.commentId, taskId: args.taskId, content: args.content },
      task: { taskId: task.taskId, title: task.title, projectId: task.projectId },
    });
    sseManager.broadcast(user.orgId, 'comment.created', { comment: { commentId: comment.commentId, taskId: args.taskId } });
    return {
      ...comment,
      userEmail: comment.user.email,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      replies: [],
    };
  },

  updateComment: async (_parent: unknown, args: { commentId: string; content: string }, context: Context) => {
    parseInput(CreateCommentInput, { content: args.content });
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
    const comment = await context.prisma.comment.findUnique({
      where: { commentId: args.commentId },
      include: { user: { select: { email: true } } },
    });
    if (!comment) throw new NotFoundError('Comment not found');
    if (comment.userId !== user.userId && user.role !== 'org:admin') {
      throw new AuthorizationError('Not authorized to delete this comment');
    }
    await context.prisma.comment.deleteMany({ where: { parentCommentId: args.commentId } });
    await context.prisma.comment.delete({ where: { commentId: args.commentId } });
    return {
      ...comment,
      userEmail: comment.user.email,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      replies: [],
    };
  },

  createCustomField: async (
    _parent: unknown,
    args: { projectId: string; name: string; fieldType: string; options?: string | null; required?: boolean | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    await requireProjectAccess(context, args.projectId);
    const validTypes = ['TEXT', 'NUMBER', 'DATE', 'DROPDOWN'];
    if (!validTypes.includes(args.fieldType)) {
      throw new ValidationError(`Invalid fieldType "${args.fieldType}". Valid: ${validTypes.join(', ')}`);
    }
    if (args.fieldType === 'DROPDOWN' && !args.options) {
      throw new ValidationError('DROPDOWN fields require options');
    }
    const maxPos = await context.prisma.customField.aggregate({
      where: { projectId: args.projectId },
      _max: { position: true },
    });
    return context.prisma.customField.create({
      data: {
        orgId: user.orgId,
        projectId: args.projectId,
        name: args.name,
        fieldType: args.fieldType,
        options: args.options ?? null,
        required: args.required ?? false,
        position: (maxPos._max.position ?? 0) + 1,
      },
    });
  },

  updateCustomField: async (
    _parent: unknown,
    args: { customFieldId: string; name?: string | null; options?: string | null; required?: boolean | null; position?: number | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const field = await context.prisma.customField.findUnique({ where: { customFieldId: args.customFieldId } });
    if (!field || field.orgId !== user.orgId) throw new NotFoundError('Custom field not found');
    return context.prisma.customField.update({
      where: { customFieldId: args.customFieldId },
      data: {
        ...(args.name !== undefined && args.name !== null ? { name: args.name } : {}),
        ...(args.options !== undefined ? { options: args.options } : {}),
        ...(args.required !== undefined && args.required !== null ? { required: args.required } : {}),
        ...(args.position !== undefined && args.position !== null ? { position: args.position } : {}),
      },
    });
  },

  deleteCustomField: async (_parent: unknown, args: { customFieldId: string }, context: Context) => {
    const user = requireOrg(context);
    const field = await context.prisma.customField.findUnique({ where: { customFieldId: args.customFieldId } });
    if (!field || field.orgId !== user.orgId) throw new NotFoundError('Custom field not found');
    await context.prisma.customField.delete({ where: { customFieldId: args.customFieldId } });
    return true;
  },

  setCustomFieldValue: async (
    _parent: unknown,
    args: { taskId: string; customFieldId: string; value: string },
    context: Context
  ) => {
    await requireTask(context, args.taskId);
    const field = await context.prisma.customField.findUnique({ where: { customFieldId: args.customFieldId } });
    if (!field) throw new NotFoundError('Custom field not found');
    return context.prisma.customFieldValue.upsert({
      where: { customFieldId_taskId: { customFieldId: args.customFieldId, taskId: args.taskId } },
      create: { customFieldId: args.customFieldId, taskId: args.taskId, value: args.value },
      update: { value: args.value },
      include: { customField: true },
    });
  },

  addTaskAssignee: async (
    _parent: unknown,
    args: { taskId: string; userId: string },
    context: Context
  ) => {
    const { user, task } = await requireTask(context, args.taskId);
    const assignee = await context.prisma.taskAssignee.upsert({
      where: { taskId_userId: { taskId: args.taskId, userId: args.userId } },
      create: { taskId: args.taskId, userId: args.userId },
      update: {},
      include: { user: true },
    });
    logActivity(context.prisma, {
      orgId: user.orgId, projectId: task.projectId, taskId: task.taskId, userId: user.userId,
      action: 'task.assignee_added', field: 'assignee', newValue: args.userId,
    });
    if (args.userId !== user.userId) {
      createNotification(context.prisma, {
        orgId: user.orgId,
        userId: args.userId,
        type: 'assigned',
        title: `You were assigned to "${task.title}"`,
        linkUrl: `/app/projects/${task.projectId}`,
        relatedTaskId: task.taskId,
        relatedProjectId: task.projectId,
      });
    }
    return {
      id: assignee.id,
      user: assignee.user,
      assignedAt: assignee.assignedAt.toISOString(),
    };
  },

  removeTaskAssignee: async (
    _parent: unknown,
    args: { taskId: string; userId: string },
    context: Context
  ) => {
    const { user, task } = await requireTask(context, args.taskId);
    await context.prisma.taskAssignee.deleteMany({
      where: { taskId: args.taskId, userId: args.userId },
    });
    logActivity(context.prisma, {
      orgId: user.orgId, projectId: task.projectId, taskId: task.taskId, userId: user.userId,
      action: 'task.assignee_removed', field: 'assignee', oldValue: args.userId,
    });
    return true;
  },
};

// ── Task field resolvers ──

export const taskFieldResolvers = {
  Task: {
    labels: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.taskLabels.load(parent.taskId);
    },
    customFieldValues: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.customFieldValuesByTask.load(parent.taskId);
    },
    assignees: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      const assignees = await context.loaders.taskAssignees.load(parent.taskId);
      return assignees.map((a) => ({
        id: a.id,
        user: a.user,
        assignedAt: a.assignedAt.toISOString(),
      }));
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
  CustomFieldValue: {
    field: (parent: { customField?: unknown; customFieldId: string }, _args: unknown, context: Context) => {
      if (parent.customField) return parent.customField;
      return context.prisma.customField.findUnique({ where: { customFieldId: parent.customFieldId } });
    },
  },
};
