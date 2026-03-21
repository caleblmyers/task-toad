import type { Context } from '../context.js';
import { NotFoundError } from '../errors.js';
import { requireOrg } from './auth.js';
import { requireProject } from '../../utils/resolverHelpers.js';

export const taskInsightQueries = {
  taskInsights: async (
    _parent: unknown,
    args: { projectId: string; taskId?: string },
    context: Context
  ) => {
    await requireProject(context, args.projectId);
    const where: Record<string, unknown> = { projectId: args.projectId };
    if (args.taskId) {
      where.OR = [
        { sourceTaskId: args.taskId },
        { targetTaskId: args.taskId },
      ];
    }
    return context.prisma.taskInsight.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },
};

export const taskInsightMutations = {
  dismissInsight: async (
    _parent: unknown,
    args: { taskInsightId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const insight = await context.prisma.taskInsight.findUnique({
      where: { taskInsightId: args.taskInsightId },
    });
    if (!insight || insight.orgId !== user.orgId) {
      throw new NotFoundError('Task insight not found');
    }
    await context.prisma.taskInsight.delete({
      where: { taskInsightId: args.taskInsightId },
    });
    return true;
  },
};

export const taskInsightFieldResolvers = {
  TaskInsight: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    sourceTask: async (
      parent: { sourceTaskId: string },
      _args: unknown,
      context: Context
    ) => {
      return context.loaders.taskById.load(parent.sourceTaskId);
    },
    targetTask: async (
      parent: { targetTaskId: string | null },
      _args: unknown,
      context: Context
    ) => {
      if (!parent.targetTaskId) return null;
      return context.loaders.taskById.load(parent.targetTaskId);
    },
  },
};
