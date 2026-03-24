import type { Context } from '../context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg } from './auth.js';
import { requireProject, parseInput, CreateKnowledgeEntryInput } from '../../utils/resolverHelpers.js';
import { requirePermission, Permission } from '../../auth/permissions.js';

const VALID_SOURCES = ['upload', 'onboarding', 'learned', 'scaffold'];
const VALID_CATEGORIES = ['standard', 'pattern', 'business', 'integration'];

export const knowledgeBaseQueries = {
  knowledgeEntries: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context
  ) => {
    await requireProject(context, args.projectId);
    return context.prisma.knowledgeEntry.findMany({
      where: { projectId: args.projectId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  },
};

export const knowledgeBaseMutations = {
  createKnowledgeEntry: async (
    _parent: unknown,
    args: { projectId: string; title: string; content: string; source?: string; category?: string },
    context: Context
  ) => {
    parseInput(CreateKnowledgeEntryInput, { title: args.title, content: args.content });
    const { user } = await requireProject(context, args.projectId);
    await requirePermission(context, args.projectId, Permission.MANAGE_PROJECT_SETTINGS);
    const source = args.source ?? 'upload';
    if (!VALID_SOURCES.includes(source)) {
      throw new ValidationError(`Invalid source "${source}". Valid: ${VALID_SOURCES.join(', ')}`);
    }
    const category = args.category ?? 'standard';
    if (!VALID_CATEGORIES.includes(category)) {
      throw new ValidationError(`Invalid category "${category}". Valid: ${VALID_CATEGORIES.join(', ')}`);
    }
    return context.prisma.knowledgeEntry.create({
      data: {
        projectId: args.projectId,
        orgId: user.orgId,
        title: args.title.trim(),
        content: args.content,
        source,
        category,
      },
    });
  },

  updateKnowledgeEntry: async (
    _parent: unknown,
    args: { knowledgeEntryId: string; title?: string; content?: string; category?: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const entry = await context.prisma.knowledgeEntry.findUnique({
      where: { knowledgeEntryId: args.knowledgeEntryId },
    });
    if (!entry || entry.orgId !== user.orgId) {
      throw new NotFoundError('Knowledge entry not found');
    }
    if (args.category && !VALID_CATEGORIES.includes(args.category)) {
      throw new ValidationError(`Invalid category "${args.category}". Valid: ${VALID_CATEGORIES.join(', ')}`);
    }
    const data: Record<string, string> = {};
    if (args.title !== undefined) data.title = args.title.trim();
    if (args.content !== undefined) data.content = args.content;
    if (args.category !== undefined) data.category = args.category;
    return context.prisma.knowledgeEntry.update({
      where: { knowledgeEntryId: args.knowledgeEntryId },
      data,
    });
  },

  deleteKnowledgeEntry: async (
    _parent: unknown,
    args: { knowledgeEntryId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const entry = await context.prisma.knowledgeEntry.findUnique({
      where: { knowledgeEntryId: args.knowledgeEntryId },
    });
    if (!entry || entry.orgId !== user.orgId) {
      throw new NotFoundError('Knowledge entry not found');
    }
    await context.prisma.knowledgeEntry.delete({
      where: { knowledgeEntryId: args.knowledgeEntryId },
    });
    return true;
  },
};

export const knowledgeBaseFieldResolvers = {
  KnowledgeEntry: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    updatedAt: (parent: { updatedAt: Date }) => parent.updatedAt.toISOString(),
  },
};
