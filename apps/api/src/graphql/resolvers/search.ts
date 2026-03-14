import { GraphQLError } from 'graphql';
import type { Context } from '../context.js';
import { requireOrg } from './auth.js';

// ── Search queries ──

export const searchQueries = {
  globalSearch: async (_parent: unknown, args: { query: string; limit?: number | null }, context: Context) => {
    const user = requireOrg(context);
    const take = args.limit ?? 10;
    const [projects, tasks] = await Promise.all([
      context.prisma.project.findMany({
        where: { orgId: user.orgId, name: { contains: args.query, mode: 'insensitive' }, archived: false },
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
        take,
      }),
    ]);
    return {
      projects,
      tasks: tasks.map((t: typeof tasks[number]) => ({ task: t, projectName: (t as unknown as { project: { name: string } }).project.name })),
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
    const user = requireOrg(context);
    const existing = await context.prisma.label.findUnique({
      where: { orgId_name: { orgId: user.orgId, name: args.name } },
    });
    if (existing) {
      throw new GraphQLError('Label already exists', { extensions: { code: 'BAD_USER_INPUT' } });
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
      throw new GraphQLError('Label not found', { extensions: { code: 'NOT_FOUND' } });
    }
    await context.prisma.label.delete({ where: { labelId: args.labelId } });
    return true;
  },

  addTaskLabel: async (_parent: unknown, args: { taskId: string; labelId: string }, context: Context) => {
    const user = requireOrg(context);
    const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
    if (!task || task.orgId !== user.orgId) {
      throw new GraphQLError('Task not found', { extensions: { code: 'NOT_FOUND' } });
    }
    const label = await context.prisma.label.findUnique({ where: { labelId: args.labelId } });
    if (!label || label.orgId !== user.orgId) {
      throw new GraphQLError('Label not found', { extensions: { code: 'NOT_FOUND' } });
    }
    await context.prisma.taskLabel.upsert({
      where: { taskId_labelId: { taskId: args.taskId, labelId: args.labelId } },
      create: { taskId: args.taskId, labelId: args.labelId },
      update: {},
    });
    return task;
  },

  removeTaskLabel: async (_parent: unknown, args: { taskId: string; labelId: string }, context: Context) => {
    const user = requireOrg(context);
    const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
    if (!task || task.orgId !== user.orgId) {
      throw new GraphQLError('Task not found', { extensions: { code: 'NOT_FOUND' } });
    }
    await context.prisma.taskLabel.deleteMany({
      where: { taskId: args.taskId, labelId: args.labelId },
    });
    return task;
  },
};
