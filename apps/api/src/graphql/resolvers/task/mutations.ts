import type { Context } from '../../context.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../../errors.js';
import { requireAuth, requireOrg, requireProjectAccess } from '../auth.js';
import { requireTask, requireProject, requireOrgUser, requireProjectField, validateStatus, parseInput, CreateTaskInput, UpdateTaskInput, CreateCommentInput } from '../../../utils/resolverHelpers.js';
import { requirePermission, Permission } from '../../../auth/permissions.js';
import { StringArraySchema } from '../../../utils/zodSchemas.js';
import { createChildLogger } from '../../../utils/logger.js';
import { reviewCode } from '../../../ai/aiService.js';
import { decryptApiKey } from '../../../utils/encryption.js';
import { getPullRequestDiff } from '../../../github/index.js';
import { getEventBus } from '../../../infrastructure/eventbus/index.js';
import { logActivity } from '../../../utils/activity.js';
import { detectCycle } from '../../../utils/cyclicDependencyCheck.js';
import fs from 'node:fs';
import path from 'node:path';

const log = createChildLogger('task');

// ── Task mutations ──

export const taskMutations = {
  createTask: async (
    _parent: unknown,
    args: { projectId: string; title: string; status?: string; taskType?: string },
    context: Context
  ) => {
    parseInput(CreateTaskInput, { title: args.title });
    await requirePermission(context, args.projectId, Permission.CREATE_TASKS);
    const { user, project } = await requireProject(context, args.projectId);
    const status = args.status ?? 'todo';
    const statusParse = StringArraySchema.safeParse(JSON.parse(project.statuses));
    if (!statusParse.success) {
      log.warn({ projectId: args.projectId, error: statusParse.error.message }, 'Invalid project statuses JSON');
    }
    const validStatuses = statusParse.success ? statusParse.data : ['todo', 'in_progress', 'in_review', 'done'];
    validateStatus(validStatuses, status);
    const validTaskTypes = ['epic', 'story', 'task', 'bug'];
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
    // Auto-add creator as watcher
    await context.prisma.taskWatcher.create({
      data: { taskId: task.taskId, userId: user.userId },
    });
    getEventBus().emit('task.created', {
      orgId: user.orgId, userId: user.userId, projectId: args.projectId,
      timestamp: new Date().toISOString(),
      task: { taskId: task.taskId, title: task.title, status: task.status, projectId: task.projectId, orgId: task.orgId, taskType: task.taskType },
    });
    return task;
  },

  updateTask: async (
    _parent: unknown,
    args: { taskId: string; title?: string; status?: string; description?: string; instructions?: string; acceptanceCriteria?: string; sprintId?: string | null; sprintColumn?: string | null; assigneeId?: string | null; dueDate?: string | null; position?: number | null; archived?: boolean; storyPoints?: number | null; taskType?: string; recurrenceRule?: string | null; force?: boolean },
    context: Context
  ) => {
    parseInput(UpdateTaskInput, { title: args.title, description: args.description, instructions: args.instructions, acceptanceCriteria: args.acceptanceCriteria });
    const { user, task } = await requireTask(context, args.taskId);
    await requirePermission(context, task.projectId, Permission.EDIT_TASKS);
    // Verify assignee belongs to same org
    if (args.assigneeId) {
      await requireOrgUser(context, args.assigneeId);
    }
    const warnings: string[] = [];
    if (args.status !== undefined) {
      const statusParse = StringArraySchema.safeParse(JSON.parse(task.project.statuses));
      if (!statusParse.success) {
        log.warn({ taskId: args.taskId, error: statusParse.error.message }, 'Invalid project statuses JSON');
      }
      const validStatuses = statusParse.success ? statusParse.data : ['todo', 'in_progress', 'in_review', 'done'];
      validateStatus(validStatuses, args.status);

      // Workflow transition validation
      if (args.status !== task.status) {
        const transitions = await context.prisma.workflowTransition.findMany({
          where: { projectId: task.projectId },
        });
        if (transitions.length > 0) {
          const allowed = transitions.some(
            t => t.fromStatus === task.status && t.toStatus === args.status
          );
          if (!allowed) {
            throw new ValidationError(
              `Status transition from '${task.status}' to '${args.status}' is not allowed by the project workflow`
            );
          }
        }
      }
    }
    // Blocking dependency validation: warn if moving to in_progress/done with incomplete blockers
    if (args.status && ['in_progress', 'done'].includes(args.status) && !args.force) {
      // Find tasks that block this one:
      // 1. 'blocks' deps where this task is target (other task blocks this one)
      // 2. 'is_blocked_by' deps where this task is source (this task is blocked by other)
      const blockingDeps = await context.prisma.taskDependency.findMany({
        where: {
          OR: [
            { targetTaskId: args.taskId, linkType: 'blocks' },
            { sourceTaskId: args.taskId, linkType: 'is_blocked_by' },
          ],
        },
        include: {
          sourceTask: { select: { taskId: true, title: true, status: true } },
          targetTask: { select: { taskId: true, title: true, status: true } },
        },
      });
      const incompleteBlockers = blockingDeps.filter(dep => {
        const blocker = dep.linkType === 'blocks' ? dep.sourceTask : dep.targetTask;
        return blocker.status !== 'done';
      });
      if (incompleteBlockers.length > 0) {
        const blockerNames = incompleteBlockers.map(dep => {
          const blocker = dep.linkType === 'blocks' ? dep.sourceTask : dep.targetTask;
          return `"${blocker.title}" (${blocker.status})`;
        });
        warnings.push(`Task has incomplete blocking dependencies: ${blockerNames.join(', ')}`);
        log.warn({ taskId: args.taskId, blockers: blockerNames }, 'Task has incomplete blocking dependencies');
      }
    }
    // WIP limit warning: check if moving to a sprint column would exceed the limit
    if (args.sprintColumn !== undefined && args.sprintColumn !== null) {
      const targetSprintId = args.sprintId !== undefined ? args.sprintId : task.sprintId;
      if (targetSprintId) {
        const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: targetSprintId } });
        if (sprint?.wipLimits) {
          const wipLimits: Record<string, number> = JSON.parse(sprint.wipLimits);
          const limit = wipLimits[args.sprintColumn];
          if (limit !== undefined) {
            const count = await context.prisma.task.count({
              where: { sprintId: targetSprintId, sprintColumn: args.sprintColumn, archived: { not: true }, taskId: { not: args.taskId } },
            });
            if (count >= limit) {
              warnings.push(`Column "${args.sprintColumn}" WIP limit (${limit}) ${count >= limit ? 'exceeded' : 'reached'}`);
            }
          }
        }
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
        ...(args.sprintId !== undefined ? { sprintId: args.sprintId } : {}),
        ...(args.sprintColumn !== undefined ? { sprintColumn: args.sprintColumn } : {}),
        ...(args.assigneeId !== undefined ? { assigneeId: args.assigneeId } : {}),
        ...(args.dueDate !== undefined ? { dueDate: args.dueDate } : {}),
        ...(args.position !== undefined ? { position: args.position } : {}),
        ...(args.archived !== undefined ? { archived: args.archived } : {}),
        ...(args.storyPoints !== undefined ? { storyPoints: args.storyPoints } : {}),
        ...(args.taskType !== undefined ? { taskType: args.taskType } : {}),
        ...(args.recurrenceRule !== undefined ? { recurrenceRule: args.recurrenceRule || null } : {}),
      },
    });
    // Build changes map
    const fields: Array<[string, string | null | undefined, string | null | undefined]> = [
      ['title', task.title, args.title],
      ['status', task.status, args.status],
      ['assigneeId', task.assigneeId, args.assigneeId],
      ['sprintId', task.sprintId, args.sprintId],
      ['dueDate', task.dueDate, args.dueDate],
      ['archived', String(task.archived), args.archived !== undefined ? String(args.archived) : undefined],
      ['recurrenceRule', task.recurrenceRule ?? null, args.recurrenceRule !== undefined ? (args.recurrenceRule || null) : undefined],
    ];
    const changes: Record<string, { old: string | null; new: string | null }> = {};
    for (const [field, oldVal, newVal] of fields) {
      if (newVal !== undefined && newVal !== oldVal) {
        changes[field] = { old: oldVal ?? null, new: newVal ?? null };
      }
    }
    if (Object.keys(changes).length > 0) {
      getEventBus().emit('task.updated', {
        orgId: user.orgId, userId: user.userId, projectId: task.projectId,
        timestamp: new Date().toISOString(),
        task: { taskId: updated.taskId, title: updated.title, status: updated.status, projectId: updated.projectId, orgId: updated.orgId, taskType: updated.taskType },
        changes,
        previousAssigneeId: task.assigneeId,
      });
    }
    // Auto-review trigger: when status changes to in_review and task has linked PRs
    if (args.status === 'in_review' && args.status !== task.status) {
      const prs = await context.prisma.gitHubPullRequestLink.findMany({ where: { taskId: args.taskId } });
      if (prs.length > 0) {
        const org = await context.prisma.org.findUnique({ where: { orgId: user.orgId } });
        const encrypted = org?.anthropicApiKeyEncrypted;
        if (encrypted) {
          try {
            const apiKey = decryptApiKey(encrypted);
            const project = await context.loaders.projectById.load(task.projectId);
            if (project?.githubInstallationId && project.githubRepositoryOwner && project.githubRepositoryName) {
              const pr = prs[0];
              getPullRequestDiff(project.githubInstallationId, project.githubRepositoryOwner, project.githubRepositoryName, pr.prNumber)
                .then(diff => reviewCode(apiKey, {
                  taskTitle: task.title,
                  taskDescription: task.description ?? '',
                  taskInstructions: task.instructions ?? undefined,
                  acceptanceCriteria: task.acceptanceCriteria ?? undefined,
                  diff,
                  projectName: project.name,
                }))
                .then(review => {
                  log.info({ taskId: args.taskId, prNumber: pr.prNumber }, 'Auto-review completed');
                  logActivity(context.prisma, {
                    orgId: user.orgId, projectId: task.projectId, taskId: task.taskId, userId: user.userId,
                    action: 'task.auto_reviewed', field: 'review', newValue: review.approved ? 'approved' : 'changes_requested',
                  });
                })
                .catch(err => log.error({ err, taskId: args.taskId }, 'Auto-review failed'));
            }
          } catch (err) {
            log.error({ err, taskId: args.taskId }, 'Failed to decrypt API key for auto-review');
          }
        }
      }
    }
    return { task: updated, warnings };
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
    // Verify assignee belongs to same org
    if (args.assigneeId) {
      await requireOrgUser(context, args.assigneeId);
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
    getEventBus().emit('task.bulk_updated', {
      orgId: user.orgId, userId: user.userId, projectId: projectIds[0],
      timestamp: new Date().toISOString(),
      taskIds: args.taskIds,
    });
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
      taskType = 'task';
    }
    const validTaskTypes = ['epic', 'story', 'task', 'bug'];
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
    getEventBus().emit('subtask.created', {
      orgId: user.orgId, userId: user.userId, projectId: parent.projectId,
      timestamp: new Date().toISOString(),
      task: { taskId: task.taskId, title: task.title, status: task.status, projectId: task.projectId, orgId: task.orgId, taskType: task.taskType },
      parentTaskId: args.parentTaskId,
    });
    return task;
  },

  createComment: async (_parent: unknown, args: { taskId: string; content: string; parentCommentId?: string | null }, context: Context) => {
    parseInput(CreateCommentInput, { content: args.content });
    const { user, task } = await requireTask(context, args.taskId);
    await requirePermission(context, task.projectId, Permission.CREATE_COMMENTS);
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
    // Extract mentions with tighter email regex, capped at 20
    const mentionPattern = /@([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const mentionedEmails: string[] = [];
    let mentionMatch: RegExpExecArray | null;
    while ((mentionMatch = mentionPattern.exec(args.content)) !== null) {
      mentionedEmails.push(mentionMatch[1]);
      if (mentionedEmails.length >= 20) break;
    }
    // Batch DB lookup — single findMany instead of N queries
    const mentionedUserIds: string[] = [];
    if (mentionedEmails.length > 0) {
      const mentionedUsers = await context.prisma.user.findMany({
        where: { email: { in: mentionedEmails }, orgId: user.orgId },
      });
      for (const mentionedUser of mentionedUsers) {
        if (mentionedUser.userId !== user.userId) {
          mentionedUserIds.push(mentionedUser.userId);
        }
      }
      // Auto-add mentioned users as watchers
      for (const mentionedUser of mentionedUsers) {
        await context.prisma.taskWatcher.upsert({
          where: { taskId_userId: { taskId: args.taskId, userId: mentionedUser.userId } },
          create: { taskId: args.taskId, userId: mentionedUser.userId },
          update: {},
        });
      }
    }
    getEventBus().emit('comment.created', {
      orgId: user.orgId, userId: user.userId, projectId: task.projectId,
      timestamp: new Date().toISOString(),
      comment: { commentId: comment.commentId, taskId: args.taskId, content: args.content },
      task: { taskId: task.taskId, title: task.title, status: task.status, projectId: task.projectId, orgId: task.orgId, taskType: task.taskType, assigneeId: task.assigneeId },
      mentionedUserIds,
    });
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
      include: { user: { select: { email: true } }, task: { select: { orgId: true } } },
    });
    if (!comment) throw new NotFoundError('Comment not found');
    // Validate tenant ownership — comment's task must belong to user's org
    if (comment.task.orgId !== user.orgId) {
      throw new NotFoundError('Comment not found');
    }
    if (comment.userId !== user.userId && user.role !== 'org:admin') {
      throw new AuthorizationError('Not authorized to delete this comment');
    }
    await context.prisma.comment.deleteMany({ where: { parentCommentId: args.commentId } });
    await context.prisma.comment.delete({ where: { commentId: args.commentId } });
    return true;
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
    const { task } = await requireTask(context, args.taskId);
    // Verify custom field belongs to the task's project
    await requireProjectField(context, args.customFieldId, task.projectId);
    return context.prisma.customFieldValue.upsert({
      where: { customFieldId_taskId: { customFieldId: args.customFieldId, taskId: args.taskId } },
      create: { customFieldId: args.customFieldId, taskId: args.taskId, value: args.value },
      update: { value: args.value },
      include: { customField: true },
    });
  },

  reorderTask: async (
    _parent: unknown,
    args: { taskId: string; position: number },
    context: Context
  ) => {
    const { task } = await requireTask(context, args.taskId);
    const updated = await context.prisma.task.update({
      where: { taskId: args.taskId },
      data: { position: args.position },
    });
    getEventBus().emit('task.reordered', {
      orgId: task.orgId, userId: context.user!.userId, projectId: task.projectId,
      timestamp: new Date().toISOString(),
      task: { taskId: updated.taskId, title: updated.title, status: updated.status, projectId: updated.projectId, orgId: updated.orgId, taskType: updated.taskType },
    });
    return updated;
  },

  addTaskAssignee: async (
    _parent: unknown,
    args: { taskId: string; userId: string },
    context: Context
  ) => {
    const { user, task } = await requireTask(context, args.taskId);
    // Verify target user belongs to same org
    await requireOrgUser(context, args.userId);
    const assignee = await context.prisma.taskAssignee.upsert({
      where: { taskId_userId: { taskId: args.taskId, userId: args.userId } },
      create: { taskId: args.taskId, userId: args.userId },
      update: {},
      include: { user: true },
    });
    // Auto-add assignee as watcher
    await context.prisma.taskWatcher.upsert({
      where: { taskId_userId: { taskId: args.taskId, userId: args.userId } },
      create: { taskId: args.taskId, userId: args.userId },
      update: {},
    });
    getEventBus().emit('task.assignee_added', {
      orgId: user.orgId, userId: user.userId, projectId: task.projectId,
      timestamp: new Date().toISOString(),
      taskId: task.taskId, taskTitle: task.title, assigneeId: args.userId,
    });
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
    // Verify target user belongs to same org
    await requireOrgUser(context, args.userId);
    await context.prisma.taskAssignee.deleteMany({
      where: { taskId: args.taskId, userId: args.userId },
    });
    getEventBus().emit('task.assignee_removed', {
      orgId: user.orgId, userId: user.userId, projectId: task.projectId,
      timestamp: new Date().toISOString(),
      taskId: task.taskId, assigneeId: args.userId,
    });
    return true;
  },

  addTaskWatcher: async (
    _parent: unknown,
    args: { taskId: string; userId: string },
    context: Context
  ) => {
    const { user, task } = await requireTask(context, args.taskId);
    await requireOrgUser(context, args.userId);
    const watcher = await context.prisma.taskWatcher.upsert({
      where: { taskId_userId: { taskId: args.taskId, userId: args.userId } },
      create: { taskId: args.taskId, userId: args.userId },
      update: {},
      include: { user: true },
    });
    getEventBus().emit('task.watcher_added', {
      orgId: user.orgId, userId: user.userId, projectId: task.projectId,
      timestamp: new Date().toISOString(),
      taskId: task.taskId, taskTitle: task.title, watcherId: args.userId,
    });
    return {
      id: watcher.id,
      user: watcher.user,
      watchedAt: watcher.watchedAt.toISOString(),
    };
  },

  removeTaskWatcher: async (
    _parent: unknown,
    args: { taskId: string; userId: string },
    context: Context
  ) => {
    const { user, task } = await requireTask(context, args.taskId);
    await requireOrgUser(context, args.userId);
    await context.prisma.taskWatcher.deleteMany({
      where: { taskId: args.taskId, userId: args.userId },
    });
    getEventBus().emit('task.watcher_removed', {
      orgId: user.orgId, userId: user.userId, projectId: task.projectId,
      timestamp: new Date().toISOString(),
      taskId: task.taskId, taskTitle: task.title, watcherId: args.userId,
    });
    return true;
  },

  deleteAttachment: async (
    _parent: unknown,
    args: { attachmentId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const attachment = await context.prisma.attachment.findUnique({
      where: { attachmentId: args.attachmentId },
      include: { task: { select: { orgId: true } } },
    });
    if (!attachment || attachment.task.orgId !== user.orgId) {
      throw new NotFoundError('Attachment not found');
    }
    // Delete file from disk
    const uploadDir = path.resolve(process.cwd(), 'uploads');
    const filePath = path.join(uploadDir, attachment.fileKey);
    try { fs.unlinkSync(filePath); } catch { /* file may already be gone */ }
    // Delete DB record
    await context.prisma.attachment.delete({ where: { attachmentId: args.attachmentId } });
    return true;
  },

  addTaskDependency: async (
    _parent: unknown,
    args: { sourceTaskId: string; targetTaskId: string; linkType: string },
    context: Context
  ) => {
    const { user } = await requireTask(context, args.sourceTaskId);
    // Verify target task exists and is in same org
    const targetTask = await context.prisma.task.findUnique({ where: { taskId: args.targetTaskId } });
    if (!targetTask || targetTask.orgId !== user.orgId) {
      throw new NotFoundError('Target task not found');
    }
    const validLinkTypes = ['blocks', 'is_blocked_by', 'relates_to', 'duplicates'];
    if (!validLinkTypes.includes(args.linkType)) {
      throw new ValidationError(`Invalid linkType "${args.linkType}". Valid: ${validLinkTypes.join(', ')}`);
    }
    // Cycle detection for blocking link types
    if (args.linkType === 'blocks' || args.linkType === 'is_blocked_by') {
      const wouldCycle = await detectCycle(context.prisma, args.sourceTaskId, args.targetTaskId);
      if (wouldCycle) {
        throw new ValidationError('Adding this dependency would create a circular dependency');
      }
    }
    const dep = await context.prisma.taskDependency.create({
      data: {
        sourceTaskId: args.sourceTaskId,
        targetTaskId: args.targetTaskId,
        linkType: args.linkType,
      },
      include: { sourceTask: true, targetTask: true },
    });
    return { ...dep, createdAt: dep.createdAt.toISOString() };
  },

  removeTaskDependency: async (
    _parent: unknown,
    args: { taskDependencyId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const dep = await context.prisma.taskDependency.findUnique({
      where: { taskDependencyId: args.taskDependencyId },
      include: { sourceTask: { select: { orgId: true } } },
    });
    if (!dep || dep.sourceTask.orgId !== user.orgId) {
      throw new NotFoundError('Task dependency not found');
    }
    await context.prisma.taskDependency.delete({ where: { taskDependencyId: args.taskDependencyId } });
    return true;
  },
};
