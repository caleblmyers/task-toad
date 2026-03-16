import type { Context } from '../context.js';
import { NotFoundError } from '../errors.js';
import { requireOrg, requireProjectAccess } from './auth.js';

// ── Template queries ──

export const templateQueries = {
  taskTemplates: async (_parent: unknown, args: { projectId?: string }, context: Context) => {
    const user = requireOrg(context);
    const where: { orgId: string; OR?: Array<{ projectId: string | null }> } = {
      orgId: user.orgId!,
    };
    if (args.projectId) {
      // Return org-wide templates (projectId=null) plus project-specific
      where.OR = [{ projectId: null }, { projectId: args.projectId }];
    }
    return context.prisma.taskTemplate.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });
  },
};

// ── Template mutations ──

export const templateMutations = {
  createTaskTemplate: async (
    _parent: unknown,
    args: {
      projectId?: string;
      name: string;
      description?: string;
      instructions?: string;
      acceptanceCriteria?: string;
      priority?: string;
      taskType?: string;
      estimatedHours?: number;
      storyPoints?: number;
    },
    context: Context,
  ) => {
    const user = requireOrg(context);
    if (args.projectId) {
      await requireProjectAccess(context, args.projectId);
    }
    return context.prisma.taskTemplate.create({
      data: {
        orgId: user.orgId!,
        projectId: args.projectId ?? null,
        name: args.name,
        description: args.description ?? null,
        instructions: args.instructions ?? null,
        acceptanceCriteria: args.acceptanceCriteria ?? null,
        priority: args.priority ?? 'medium',
        taskType: args.taskType ?? 'task',
        estimatedHours: args.estimatedHours ?? null,
        storyPoints: args.storyPoints ?? null,
      },
    });
  },

  updateTaskTemplate: async (
    _parent: unknown,
    args: {
      taskTemplateId: string;
      name?: string;
      description?: string;
      instructions?: string;
      acceptanceCriteria?: string;
      priority?: string;
      taskType?: string;
      estimatedHours?: number;
      storyPoints?: number;
    },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const template = await context.prisma.taskTemplate.findFirst({
      where: { taskTemplateId: args.taskTemplateId, orgId: user.orgId! },
    });
    if (!template) throw new NotFoundError('Template not found');

    const { taskTemplateId: _id, ...updates } = args;
    // Remove undefined values
    const data: Record<string, unknown> = {};
    if (updates.name !== undefined) data.name = updates.name;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.instructions !== undefined) data.instructions = updates.instructions;
    if (updates.acceptanceCriteria !== undefined) data.acceptanceCriteria = updates.acceptanceCriteria;
    if (updates.priority !== undefined) data.priority = updates.priority;
    if (updates.taskType !== undefined) data.taskType = updates.taskType;
    if (updates.estimatedHours !== undefined) data.estimatedHours = updates.estimatedHours;
    if (updates.storyPoints !== undefined) data.storyPoints = updates.storyPoints;

    return context.prisma.taskTemplate.update({
      where: { taskTemplateId: args.taskTemplateId },
      data,
    });
  },

  deleteTaskTemplate: async (
    _parent: unknown,
    args: { taskTemplateId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const template = await context.prisma.taskTemplate.findFirst({
      where: { taskTemplateId: args.taskTemplateId, orgId: user.orgId! },
    });
    if (!template) throw new NotFoundError('Template not found');

    await context.prisma.taskTemplate.delete({
      where: { taskTemplateId: args.taskTemplateId },
    });
    return true;
  },

  createTaskFromTemplate: async (
    _parent: unknown,
    args: { templateId: string; projectId: string; title: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const template = await context.prisma.taskTemplate.findFirst({
      where: { taskTemplateId: args.templateId, orgId: user.orgId! },
    });
    if (!template) throw new NotFoundError('Template not found');

    await requireProjectAccess(context, args.projectId);

    return context.prisma.task.create({
      data: {
        orgId: user.orgId!,
        projectId: args.projectId,
        title: args.title,
        description: template.description,
        instructions: template.instructions,
        acceptanceCriteria: template.acceptanceCriteria,
        priority: template.priority,
        taskType: template.taskType,
        estimatedHours: template.estimatedHours,
        storyPoints: template.storyPoints,
      },
    });
  },
};
