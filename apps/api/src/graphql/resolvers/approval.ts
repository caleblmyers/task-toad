import type { Context } from '../context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg, requireProjectAccess } from './auth.js';
import { requirePermission, Permission } from '../../auth/permissions.js';
import { getEventBus } from '../../infrastructure/eventbus/index.js';

export const approvalQueries = {
  pendingApprovals: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context
  ) => {
    await requireProjectAccess(context, args.projectId);
    const approvals = await context.prisma.approval.findMany({
      where: {
        status: 'pending',
        task: { projectId: args.projectId },
      },
      include: {
        task: true,
        requestedBy: { select: { userId: true, email: true, displayName: true } },
        approver: { select: { userId: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return approvals.map(a => ({
      ...a,
      decidedAt: a.decidedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    }));
  },

  taskApprovals: async (
    _parent: unknown,
    args: { taskId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    const approvals = await context.prisma.approval.findMany({
      where: { taskId: args.taskId },
      include: {
        task: true,
        requestedBy: { select: { userId: true, email: true, displayName: true } },
        approver: { select: { userId: true, email: true, displayName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return approvals.map(a => ({
      ...a,
      decidedAt: a.decidedAt?.toISOString() ?? null,
      createdAt: a.createdAt.toISOString(),
    }));
  },
};

export const approvalMutations = {
  approveTransition: async (
    _parent: unknown,
    args: { approvalId: string; comment?: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const approval = await context.prisma.approval.findUnique({
      where: { approvalId: args.approvalId },
      include: { task: true },
    });
    if (!approval || approval.orgId !== user.orgId) {
      throw new NotFoundError('Approval not found');
    }
    if (approval.status !== 'pending') {
      throw new ValidationError('Approval has already been decided');
    }
    await requirePermission(context, approval.task.projectId, Permission.MANAGE_PROJECT_SETTINGS);

    // Approve and execute the status change
    const updated = await context.prisma.$transaction(async (tx) => {
      const result = await tx.approval.update({
        where: { approvalId: args.approvalId },
        data: {
          status: 'approved',
          approverId: user.userId,
          decidedAt: new Date(),
          comment: args.comment ?? null,
        },
        include: {
          task: true,
          requestedBy: { select: { userId: true, email: true, displayName: true } },
          approver: { select: { userId: true, email: true, displayName: true } },
        },
      });

      // Execute the original status change
      await tx.task.update({
        where: { taskId: approval.taskId },
        data: { status: approval.toStatus },
      });

      return result;
    });

    getEventBus().emit('task.updated', {
      orgId: user.orgId,
      userId: user.userId,
      projectId: approval.task.projectId,
      timestamp: new Date().toISOString(),
      task: {
        taskId: approval.task.taskId,
        title: approval.task.title,
        status: approval.toStatus,
        projectId: approval.task.projectId,
        orgId: approval.task.orgId,
        taskType: approval.task.taskType,
      },
      changes: {
        status: { old: approval.fromStatus, new: approval.toStatus },
      },
    });

    return {
      ...updated,
      decidedAt: updated.decidedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    };
  },

  rejectTransition: async (
    _parent: unknown,
    args: { approvalId: string; comment: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const approval = await context.prisma.approval.findUnique({
      where: { approvalId: args.approvalId },
      include: { task: true },
    });
    if (!approval || approval.orgId !== user.orgId) {
      throw new NotFoundError('Approval not found');
    }
    if (approval.status !== 'pending') {
      throw new ValidationError('Approval has already been decided');
    }
    await requirePermission(context, approval.task.projectId, Permission.MANAGE_PROJECT_SETTINGS);

    const updated = await context.prisma.approval.update({
      where: { approvalId: args.approvalId },
      data: {
        status: 'rejected',
        approverId: user.userId,
        decidedAt: new Date(),
        comment: args.comment,
      },
      include: {
        task: true,
        requestedBy: { select: { userId: true, email: true, displayName: true } },
        approver: { select: { userId: true, email: true, displayName: true } },
      },
    });

    return {
      ...updated,
      decidedAt: updated.decidedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    };
  },
};
