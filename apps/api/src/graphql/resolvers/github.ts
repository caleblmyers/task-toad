import type { Context } from '../context.js';
import {
  getProjectRepo,
  connectRepoToProject,
  disconnectRepo,
  createRepoForProject,
  createPullRequestFromTask,
  listInstallationRepos,
} from '../../github/index.js';
import { NotFoundError, AuthorizationError } from '../errors.js';
import { requireOrg, requireProjectAccess } from './auth.js';

// ── GitHub queries ──

export const githubQueries = {
  githubInstallations: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);
    return context.prisma.gitHubInstallation.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
  },

  githubInstallationRepos: async (_parent: unknown, args: { installationId: string }, context: Context) => {
    const user = requireOrg(context);
    const installation = await context.prisma.gitHubInstallation.findFirst({
      where: { installationId: args.installationId, orgId: user.orgId },
    });
    if (!installation) {
      throw new NotFoundError('GitHub installation not found');
    }
    return listInstallationRepos(args.installationId);
  },

  githubProjectRepo: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    return getProjectRepo(args.projectId);
  },
};

// ── GitHub mutations ──

export const githubMutations = {
  linkGitHubInstallation: async (_parent: unknown, args: { installationId: string }, context: Context) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Only org admins can link GitHub installations');
    }
    const installation = await context.prisma.gitHubInstallation.findUnique({
      where: { installationId: args.installationId },
    });
    if (!installation) {
      throw new NotFoundError('GitHub installation not found');
    }
    return context.prisma.gitHubInstallation.update({
      where: { installationId: args.installationId },
      data: { orgId: user.orgId },
    });
  },

  connectGitHubRepo: async (
    _parent: unknown,
    args: { projectId: string; installationId: string; owner: string; name: string },
    context: Context
  ) => {
    await requireProjectAccess(context, args.projectId);
    return connectRepoToProject(args.projectId, args.installationId, args.owner, args.name);
  },

  disconnectGitHubRepo: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    await disconnectRepo(args.projectId);
    return true;
  },

  createGitHubRepo: async (
    _parent: unknown,
    args: { projectId: string; installationId: string; ownerLogin: string },
    context: Context
  ) => {
    await requireProjectAccess(context, args.projectId);
    return createRepoForProject(args.projectId, args.installationId, args.ownerLogin);
  },

  createPullRequestFromTask: async (
    _parent: unknown,
    args: { projectId: string; taskId: string; files: Array<{ path: string; content: string }> },
    context: Context
  ) => {
    await requireProjectAccess(context, args.projectId);
    return createPullRequestFromTask({
      projectId: args.projectId,
      taskId: args.taskId,
      files: args.files,
    });
  },
};

// ── GitHub field resolvers ──

export const githubFieldResolvers = {
  GitHubInstallation: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
};
