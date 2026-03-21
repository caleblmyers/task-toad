import type { Context } from '../context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg, requireApiKey } from './auth.js';
import { requireProject } from '../../utils/resolverHelpers.js';
import { generateReleaseNotes as aiGenerateReleaseNotes } from '../../ai/index.js';
import { buildPromptLogContext, enforceBudget } from './ai/helpers.js';

const VALID_STATUSES = ['draft', 'scheduled', 'released', 'archived'];

// ── Queries ──

export const releaseQueries = {
  releases: async (
    _parent: unknown,
    args: { projectId: string; status?: string | null; limit?: number | null; cursor?: string | null },
    context: Context
  ) => {
    await requireProject(context, args.projectId);
    const limit = Math.min(args.limit ?? 20, 100);
    const releases = await context.prisma.release.findMany({
      where: {
        projectId: args.projectId,
        ...(args.status ? { status: args.status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(args.cursor ? { cursor: { releaseId: args.cursor }, skip: 1 } : {}),
    });
    const hasMore = releases.length > limit;
    const items = hasMore ? releases.slice(0, limit) : releases;
    const nextCursor = hasMore ? items[items.length - 1].releaseId : null;
    return { releases: items, hasMore, nextCursor };
  },

  release: async (
    _parent: unknown,
    args: { releaseId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const release = await context.prisma.release.findUnique({
      where: { releaseId: args.releaseId },
    });
    if (!release || release.orgId !== user.orgId) {
      throw new NotFoundError('Release not found');
    }
    return release;
  },
};

// ── Mutations ──

export const releaseMutations = {
  createRelease: async (
    _parent: unknown,
    args: { projectId: string; name: string; version: string; description?: string | null; releaseDate?: string | null },
    context: Context
  ) => {
    const { user } = await requireProject(context, args.projectId);
    if (!args.name.trim()) throw new ValidationError('Name is required');
    if (!args.version.trim()) throw new ValidationError('Version is required');

    return context.prisma.release.create({
      data: {
        orgId: user.orgId,
        projectId: args.projectId,
        name: args.name.trim(),
        version: args.version.trim(),
        description: args.description ?? null,
        releaseDate: args.releaseDate ?? null,
        createdBy: user.userId,
      },
    });
  },

  updateRelease: async (
    _parent: unknown,
    args: {
      releaseId: string;
      name?: string | null;
      version?: string | null;
      description?: string | null;
      status?: string | null;
      releaseDate?: string | null;
      releaseNotes?: string | null;
    },
    context: Context
  ) => {
    const user = requireOrg(context);
    const release = await context.prisma.release.findUnique({
      where: { releaseId: args.releaseId },
    });
    if (!release || release.orgId !== user.orgId) {
      throw new NotFoundError('Release not found');
    }

    if (args.status && !VALID_STATUSES.includes(args.status)) {
      throw new ValidationError(`Invalid status "${args.status}". Valid: ${VALID_STATUSES.join(', ')}`);
    }

    const data: Record<string, unknown> = {};
    if (args.name !== undefined && args.name !== null) data.name = args.name.trim();
    if (args.version !== undefined && args.version !== null) data.version = args.version.trim();
    if (args.description !== undefined) data.description = args.description;
    if (args.status !== undefined && args.status !== null) data.status = args.status;
    if (args.releaseDate !== undefined) data.releaseDate = args.releaseDate;
    if (args.releaseNotes !== undefined) data.releaseNotes = args.releaseNotes;

    return context.prisma.release.update({
      where: { releaseId: args.releaseId },
      data,
    });
  },

  deleteRelease: async (
    _parent: unknown,
    args: { releaseId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const release = await context.prisma.release.findUnique({
      where: { releaseId: args.releaseId },
    });
    if (!release || release.orgId !== user.orgId) {
      throw new NotFoundError('Release not found');
    }
    await context.prisma.release.delete({ where: { releaseId: args.releaseId } });
    return true;
  },

  addTaskToRelease: async (
    _parent: unknown,
    args: { releaseId: string; taskId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const release = await context.prisma.release.findUnique({ where: { releaseId: args.releaseId } });
    if (!release || release.orgId !== user.orgId) {
      throw new NotFoundError('Release not found');
    }
    const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    if (task.projectId !== release.projectId) {
      throw new ValidationError('Task and release must belong to the same project');
    }
    await context.prisma.releaseTask.upsert({
      where: { releaseId_taskId: { releaseId: args.releaseId, taskId: args.taskId } },
      create: { releaseId: args.releaseId, taskId: args.taskId },
      update: {},
    });
    return true;
  },

  removeTaskFromRelease: async (
    _parent: unknown,
    args: { releaseId: string; taskId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const release = await context.prisma.release.findUnique({ where: { releaseId: args.releaseId } });
    if (!release || release.orgId !== user.orgId) {
      throw new NotFoundError('Release not found');
    }
    await context.prisma.releaseTask.deleteMany({
      where: { releaseId: args.releaseId, taskId: args.taskId },
    });
    return true;
  },

  generateReleaseNotes: async (
    _parent: unknown,
    args: { releaseId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const release = await context.prisma.release.findUnique({
      where: { releaseId: args.releaseId },
      include: {
        tasks: {
          include: { task: { select: { taskId: true, title: true, status: true, description: true, taskType: true } } },
        },
        project: { select: { name: true, description: true } },
      },
    });
    if (!release || release.orgId !== user.orgId) {
      throw new NotFoundError('Release not found');
    }

    const apiKey = requireApiKey(context);
    await enforceBudget(context);
    const promptLogContext = await buildPromptLogContext(context);

    const tasks = release.tasks.map((rt) => ({
      title: rt.task.title,
      status: rt.task.status,
      description: rt.task.description ?? '',
      taskType: rt.task.taskType,
    }));

    const result = await aiGenerateReleaseNotes(
      apiKey,
      {
        releaseName: release.name,
        releaseVersion: release.version,
        projectName: release.project.name,
        projectDescription: release.project.description ?? undefined,
        tasks,
      },
      promptLogContext,
    );

    // Format notes as markdown
    const sections: string[] = [];
    sections.push(`# ${release.name} v${release.version}\n`);
    sections.push(result.summary);
    if (result.features.length > 0) {
      sections.push(`\n## Features\n${result.features.map((f) => `- ${f}`).join('\n')}`);
    }
    if (result.bugFixes.length > 0) {
      sections.push(`\n## Bug Fixes\n${result.bugFixes.map((f) => `- ${f}`).join('\n')}`);
    }
    if (result.improvements.length > 0) {
      sections.push(`\n## Improvements\n${result.improvements.map((f) => `- ${f}`).join('\n')}`);
    }
    if (result.breakingChanges.length > 0) {
      sections.push(`\n## Breaking Changes\n${result.breakingChanges.map((f) => `- ${f}`).join('\n')}`);
    }
    const releaseNotes = sections.join('\n');

    return context.prisma.release.update({
      where: { releaseId: args.releaseId },
      data: { releaseNotes },
    });
  },
};

// ── Field Resolvers ──

export const releaseFieldResolvers = {
  Release: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
    tasks: async (parent: { releaseId: string }, _args: unknown, context: Context) => {
      const releaseTasks = await context.prisma.releaseTask.findMany({
        where: { releaseId: parent.releaseId },
        include: { task: true },
        orderBy: { addedAt: 'asc' },
      });
      return releaseTasks.map((rt) => rt.task);
    },
  },
};
