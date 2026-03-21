import type { Context } from '../context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg, requireProjectAccess } from './auth.js';

export const workflowQueries = {
  workflowTransitions: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context
  ) => {
    await requireProjectAccess(context, args.projectId);
    const transitions = await context.prisma.workflowTransition.findMany({
      where: { projectId: args.projectId },
      orderBy: [{ fromStatus: 'asc' }, { toStatus: 'asc' }],
    });
    return transitions.map(t => ({
      ...t,
      allowedRoles: t.allowedRoles ? JSON.parse(t.allowedRoles) : null,
      createdAt: t.createdAt.toISOString(),
    }));
  },
};

export const workflowMutations = {
  createWorkflowTransition: async (
    _parent: unknown,
    args: { projectId: string; fromStatus: string; toStatus: string; allowedRoles?: string[] | null },
    context: Context
  ) => {
    await requireProjectAccess(context, args.projectId);
    if (args.fromStatus === args.toStatus) {
      throw new ValidationError('fromStatus and toStatus must be different');
    }
    const transition = await context.prisma.workflowTransition.create({
      data: {
        projectId: args.projectId,
        fromStatus: args.fromStatus,
        toStatus: args.toStatus,
        allowedRoles: args.allowedRoles ? JSON.stringify(args.allowedRoles) : null,
      },
    });
    return {
      ...transition,
      allowedRoles: transition.allowedRoles ? JSON.parse(transition.allowedRoles) : null,
      createdAt: transition.createdAt.toISOString(),
    };
  },

  updateWorkflowTransition: async (
    _parent: unknown,
    args: { transitionId: string; allowedRoles?: string[] | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const transition = await context.prisma.workflowTransition.findUnique({
      where: { transitionId: args.transitionId },
      include: { project: { select: { orgId: true } } },
    });
    if (!transition || transition.project.orgId !== user.orgId) {
      throw new NotFoundError('Workflow transition not found');
    }
    const updated = await context.prisma.workflowTransition.update({
      where: { transitionId: args.transitionId },
      data: {
        allowedRoles: args.allowedRoles ? JSON.stringify(args.allowedRoles) : null,
      },
    });
    return {
      ...updated,
      allowedRoles: updated.allowedRoles ? JSON.parse(updated.allowedRoles) : null,
      createdAt: updated.createdAt.toISOString(),
    };
  },

  deleteWorkflowTransition: async (
    _parent: unknown,
    args: { transitionId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const transition = await context.prisma.workflowTransition.findUnique({
      where: { transitionId: args.transitionId },
      include: { project: { select: { orgId: true } } },
    });
    if (!transition || transition.project.orgId !== user.orgId) {
      throw new NotFoundError('Workflow transition not found');
    }
    await context.prisma.workflowTransition.delete({
      where: { transitionId: args.transitionId },
    });
    return true;
  },
};
