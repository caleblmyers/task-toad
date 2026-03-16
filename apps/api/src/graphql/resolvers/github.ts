import type { Context } from '../context.js';
import {
  getProjectRepo,
  connectRepoToProject,
  disconnectRepo,
  createRepoForProject,
  createPullRequestFromTask,
  listInstallationRepos,
  createGitHubIssue,
  updateGitHubIssueState,
  getGitHubIssueByNumber,
  fetchFileContent,
} from '../../github/index.js';
import { decomposeIssue as aiDecomposeIssue } from '../../ai/index.js';
import { NotFoundError, AuthorizationError, ValidationError } from '../errors.js';
import { requireOrg, requireProjectAccess, requireApiKey } from './auth.js';

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

  fetchRepoFileContent: async (_parent: unknown, args: { projectId: string; filePath: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
      select: { githubInstallationId: true, githubRepositoryOwner: true, githubRepositoryName: true },
    });
    if (!project?.githubInstallationId || !project?.githubRepositoryOwner || !project?.githubRepositoryName) {
      return null;
    }
    return fetchFileContent(
      project.githubInstallationId,
      project.githubRepositoryOwner,
      project.githubRepositoryName,
      args.filePath
    );
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
    let apiKey: string | undefined;
    try {
      apiKey = requireApiKey(context);
    } catch {
      // No API key configured — AI enrichment will be skipped
    }
    const result = await createPullRequestFromTask({
      projectId: args.projectId,
      taskId: args.taskId,
      files: args.files,
      apiKey,
    });

    // Auto-move task to "in_review" status after PR creation
    await context.prisma.task.update({
      where: { taskId: args.taskId },
      data: { status: 'in_review', sprintColumn: 'In Review' },
    });

    return result;
  },

  decomposeGitHubIssue: async (
    _parent: unknown,
    args: { projectId: string; issueNumber: number },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findFirst({
      where: { projectId: args.projectId, orgId: user.orgId },
    });
    if (!project) throw new NotFoundError('Project not found');
    if (!project.githubInstallationId || !project.githubRepositoryOwner || !project.githubRepositoryName) {
      throw new ValidationError('Project has no linked GitHub repository');
    }

    const issue = await getGitHubIssueByNumber(
      project.githubInstallationId,
      project.githubRepositoryOwner,
      project.githubRepositoryName,
      args.issueNumber
    );

    const existingTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null },
      select: { title: true },
      orderBy: { createdAt: 'asc' },
    });

    const decomposition = await aiDecomposeIssue(apiKey, {
      issueTitle: issue.title,
      issueBody: issue.body,
      issueLabels: issue.labels,
      projectName: project.name,
      projectDescription: project.description ?? undefined,
      existingTaskTitles: existingTasks.map((t) => t.title),
    });

    const created = await Promise.all(
      decomposition.tasks.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            priority: t.priority,
            estimatedHours: t.estimatedHours ?? null,
            instructions: t.instructions ?? null,
            status: 'todo',
            projectId: args.projectId,
            orgId: user.orgId,
            githubIssueNumber: args.issueNumber,
            githubIssueNodeId: issue.nodeId,
          },
        })
      )
    );

    return created;
  },

  syncTaskToGitHub: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    const user = requireOrg(context);
    const task = await context.prisma.task.findFirst({
      where: { taskId: args.taskId, orgId: user.orgId },
    });
    if (!task) throw new NotFoundError('Task not found');

    const project = await context.prisma.project.findUnique({
      where: { projectId: task.projectId },
      select: { githubRepositoryOwner: true, githubRepositoryName: true, githubInstallationId: true },
    });
    if (!project?.githubInstallationId || !project?.githubRepositoryOwner || !project?.githubRepositoryName) {
      throw new ValidationError('Project has no linked GitHub repository');
    }

    if (task.githubIssueNodeId) {
      const newState = task.status === 'done' ? 'CLOSED' as const : 'OPEN' as const;
      await updateGitHubIssueState(project.githubInstallationId, task.githubIssueNodeId, newState);
      return task;
    }

    const result = await createGitHubIssue(
      project.githubInstallationId,
      project.githubRepositoryOwner,
      project.githubRepositoryName,
      task.title,
      task.description || ''
    );

    return context.prisma.task.update({
      where: { taskId: args.taskId },
      data: { githubIssueNumber: result.number, githubIssueNodeId: result.nodeId },
    });
  },
};

// ── GitHub field resolvers ──

export const githubFieldResolvers = {
  GitHubInstallation: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
};
