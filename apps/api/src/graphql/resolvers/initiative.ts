import type { Initiative, Project } from '@prisma/client';
import type { Context } from '../context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg } from './auth.js';

// ── Queries ──

export const initiativeQueries = {
  initiatives: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);
    const initiatives = await context.prisma.initiative.findMany({
      where: { orgId: user.orgId },
      include: { projects: { include: { project: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return initiatives.map(formatInitiativeWithProjects);
  },

  initiative: async (
    _parent: unknown,
    args: { initiativeId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const initiative = await context.prisma.initiative.findFirst({
      where: { initiativeId: args.initiativeId, orgId: user.orgId },
      include: { projects: { include: { project: true } } },
    });
    if (!initiative) return null;
    return formatInitiativeWithProjects(initiative);
  },

  initiativeSummary: async (
    _parent: unknown,
    args: { initiativeId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const initiative = await context.prisma.initiative.findFirst({
      where: { initiativeId: args.initiativeId, orgId: user.orgId },
      include: { projects: { select: { projectId: true } } },
    });
    if (!initiative) throw new NotFoundError('Initiative not found');

    const projectIds = initiative.projects.map((ip) => ip.projectId);

    if (projectIds.length === 0) {
      return {
        initiativeId: initiative.initiativeId,
        name: initiative.name,
        status: initiative.status,
        targetDate: initiative.targetDate?.toISOString() ?? null,
        projectCount: 0,
        totalTasks: 0,
        completedTasks: 0,
        completionPercent: 0,
        healthScore: null,
      };
    }

    // Aggregate tasks across all projects
    const tasks = await context.prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        archived: false,
        taskType: { not: 'epic' },
        OR: [{ parentTaskId: null }, { parentTask: { taskType: 'epic' } }],
      },
      select: { status: true, dueDate: true },
    });

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t) => t.status === 'done').length;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Health score: based on overdue ratio and completion rate
    const today = new Date().toISOString().slice(0, 10);
    const overdueTasks = tasks.filter(
      (t) => t.dueDate && t.dueDate < today && t.status !== 'done',
    ).length;
    const overdueRatio = totalTasks > 0 ? overdueTasks / totalTasks : 0;
    const healthScore = totalTasks > 0
      ? Math.round(Math.max(0, Math.min(100, completionPercent - overdueRatio * 100)))
      : null;

    return {
      initiativeId: initiative.initiativeId,
      name: initiative.name,
      status: initiative.status,
      targetDate: initiative.targetDate?.toISOString() ?? null,
      projectCount: projectIds.length,
      totalTasks,
      completedTasks,
      completionPercent,
      healthScore,
    };
  },
};

// ── Mutations ──

export const initiativeMutations = {
  createInitiative: async (
    _parent: unknown,
    args: { name: string; description?: string | null; targetDate?: string | null },
    context: Context,
  ) => {
    const user = requireOrg(context);
    if (!args.name.trim()) throw new ValidationError('Name is required');

    const initiative = await context.prisma.initiative.create({
      data: {
        orgId: user.orgId,
        name: args.name.trim(),
        description: args.description ?? null,
        targetDate: args.targetDate ? new Date(args.targetDate) : null,
      },
      include: { projects: { include: { project: true } } },
    });
    return formatInitiativeWithProjects(initiative);
  },

  updateInitiative: async (
    _parent: unknown,
    args: {
      initiativeId: string;
      name?: string | null;
      description?: string | null;
      status?: string | null;
      targetDate?: string | null;
    },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const existing = await context.prisma.initiative.findFirst({
      where: { initiativeId: args.initiativeId, orgId: user.orgId },
    });
    if (!existing) throw new NotFoundError('Initiative not found');

    const validStatuses = ['active', 'completed', 'archived'];
    if (args.status != null && !validStatuses.includes(args.status)) {
      throw new ValidationError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const data: Record<string, unknown> = {};
    if (args.name != null) data.name = args.name.trim();
    if (args.description !== undefined) data.description = args.description;
    if (args.status != null) data.status = args.status;
    if (args.targetDate !== undefined) {
      data.targetDate = args.targetDate ? new Date(args.targetDate) : null;
    }

    const initiative = await context.prisma.initiative.update({
      where: { initiativeId: args.initiativeId },
      data,
      include: { projects: { include: { project: true } } },
    });
    return formatInitiativeWithProjects(initiative);
  },

  deleteInitiative: async (
    _parent: unknown,
    args: { initiativeId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const existing = await context.prisma.initiative.findFirst({
      where: { initiativeId: args.initiativeId, orgId: user.orgId },
    });
    if (!existing) throw new NotFoundError('Initiative not found');

    await context.prisma.initiative.delete({
      where: { initiativeId: args.initiativeId },
    });
    return true;
  },

  addProjectToInitiative: async (
    _parent: unknown,
    args: { initiativeId: string; projectId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const initiative = await context.prisma.initiative.findFirst({
      where: { initiativeId: args.initiativeId, orgId: user.orgId },
    });
    if (!initiative) throw new NotFoundError('Initiative not found');

    const project = await context.prisma.project.findFirst({
      where: { projectId: args.projectId, orgId: user.orgId },
    });
    if (!project) throw new NotFoundError('Project not found');

    // Upsert to handle duplicates gracefully
    await context.prisma.initiativeProject.upsert({
      where: {
        initiativeId_projectId: {
          initiativeId: args.initiativeId,
          projectId: args.projectId,
        },
      },
      create: {
        initiativeId: args.initiativeId,
        projectId: args.projectId,
      },
      update: {},
    });

    const updated = await context.prisma.initiative.findUniqueOrThrow({
      where: { initiativeId: args.initiativeId },
      include: { projects: { include: { project: true } } },
    });
    return formatInitiativeWithProjects(updated);
  },

  removeProjectFromInitiative: async (
    _parent: unknown,
    args: { initiativeId: string; projectId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const initiative = await context.prisma.initiative.findFirst({
      where: { initiativeId: args.initiativeId, orgId: user.orgId },
    });
    if (!initiative) throw new NotFoundError('Initiative not found');

    await context.prisma.initiativeProject.deleteMany({
      where: {
        initiativeId: args.initiativeId,
        projectId: args.projectId,
      },
    });

    const updated = await context.prisma.initiative.findUniqueOrThrow({
      where: { initiativeId: args.initiativeId },
      include: { projects: { include: { project: true } } },
    });
    return formatInitiativeWithProjects(updated);
  },
};

export const initiativeFieldResolvers = {
  Initiative: {
    createdAt: (parent: { createdAt: Date | string }) =>
      parent.createdAt instanceof Date ? parent.createdAt.toISOString() : parent.createdAt,
    updatedAt: (parent: { updatedAt: Date | string }) =>
      parent.updatedAt instanceof Date ? parent.updatedAt.toISOString() : parent.updatedAt,
    targetDate: (parent: { targetDate: Date | string | null }) =>
      parent.targetDate instanceof Date ? parent.targetDate.toISOString() : parent.targetDate,
  },
};

// ── Helpers ──

type InitiativeWithProjects = Initiative & {
  projects: Array<{ project: Project }>;
};

function formatInitiativeWithProjects(i: InitiativeWithProjects) {
  return {
    ...i,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
    targetDate: i.targetDate?.toISOString() ?? null,
    projects: i.projects.map((ip) => ip.project),
  };
}
