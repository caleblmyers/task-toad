import type { Context } from '../context.js';
import { NotFoundError, ConflictError } from '../errors.js';
import { requireOrg } from './auth.js';
import { requireTask, parseInput, CreateLabelInput } from '../../utils/resolverHelpers.js';

// ── Search queries ──

export const searchQueries = {
  globalSearch: async (_parent: unknown, args: { query: string; limit?: number | null }, context: Context) => {
    const user = requireOrg(context);
    const take = Math.min(args.limit ?? 10, 50);
    const [projects, tasks] = await Promise.all([
      context.prisma.project.findMany({
        where: { orgId: user.orgId, name: { contains: args.query, mode: 'insensitive' }, archived: false },
        orderBy: { createdAt: 'desc' },
        take,
      }),
      context.prisma.task.findMany({
        where: {
          orgId: user.orgId,
          archived: false,
          OR: [
            { title: { contains: args.query, mode: 'insensitive' } },
            { description: { contains: args.query, mode: 'insensitive' } },
          ],
        },
        include: { project: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take,
      }),
    ]);
    return {
      projects,
      tasks: tasks.map((t) => ({ task: t, projectName: t.project.name })),
    };
  },

  labels: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);
    return context.prisma.label.findMany({
      where: { orgId: user.orgId },
      orderBy: { name: 'asc' },
    });
  },
};

// ── Search/Label mutations ──

export const searchMutations = {
  createLabel: async (_parent: unknown, args: { name: string; color?: string | null }, context: Context) => {
    parseInput(CreateLabelInput, { name: args.name });
    const user = requireOrg(context);
    const existing = await context.prisma.label.findUnique({
      where: { orgId_name: { orgId: user.orgId, name: args.name } },
    });
    if (existing) {
      throw new ConflictError('Label already exists');
    }
    return context.prisma.label.create({
      data: {
        orgId: user.orgId,
        name: args.name,
        color: args.color ?? '#6b7280',
      },
    });
  },

  deleteLabel: async (_parent: unknown, args: { labelId: string }, context: Context) => {
    const user = requireOrg(context);
    const label = await context.prisma.label.findUnique({ where: { labelId: args.labelId } });
    if (!label || label.orgId !== user.orgId) {
      throw new NotFoundError('Label not found');
    }
    await context.prisma.label.delete({ where: { labelId: args.labelId } });
    return true;
  },

  addTaskLabel: async (_parent: unknown, args: { taskId: string; labelId: string }, context: Context) => {
    const { user, task } = await requireTask(context, args.taskId);
    const label = await context.prisma.label.findUnique({ where: { labelId: args.labelId } });
    if (!label || label.orgId !== user.orgId) {
      throw new NotFoundError('Label not found');
    }
    await context.prisma.taskLabel.upsert({
      where: { taskId_labelId: { taskId: args.taskId, labelId: args.labelId } },
      create: { taskId: args.taskId, labelId: args.labelId },
      update: {},
    });
    return task;
  },

  removeTaskLabel: async (_parent: unknown, args: { taskId: string; labelId: string }, context: Context) => {
    const { task } = await requireTask(context, args.taskId);
    await context.prisma.taskLabel.deleteMany({
      where: { taskId: args.taskId, labelId: args.labelId },
    });
    return task;
  },
};
