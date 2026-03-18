import type { Context } from '../../context.js';

// ── Task field resolvers ──

export const taskFieldResolvers = {
  Task: {
    attachments: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      const attachments = await context.loaders.taskAttachments.load(parent.taskId);
      return attachments.map(a => ({ ...a, createdAt: a.createdAt.toISOString() }));
    },
    labels: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.taskLabels.load(parent.taskId);
    },
    customFieldValues: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.customFieldValuesByTask.load(parent.taskId);
    },
    assignees: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      const assignees = await context.loaders.taskAssignees.load(parent.taskId);
      return assignees.map((a) => ({
        id: a.id,
        user: a.user,
        assignedAt: a.assignedAt.toISOString(),
      }));
    },
    githubIssueUrl: async (parent: { taskId: string; projectId: string; githubIssueNumber?: number | null }, _args: unknown, context: Context) => {
      if (!parent.githubIssueNumber) return null;
      const project = await context.loaders.projectById.load(parent.projectId);
      if (!project) return null;
      const { githubRepositoryOwner: owner, githubRepositoryName: name } = project;
      if (!owner || !name) return null;
      return `https://github.com/${owner}/${name}/issues/${parent.githubIssueNumber}`;
    },
    pullRequests: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.taskPullRequests.load(parent.taskId);
    },
    commits: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.taskCommits.load(parent.taskId);
    },
    children: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      return context.loaders.taskChildren.load(parent.taskId);
    },
    dependencies: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      const deps = await context.loaders.taskDependencies.load(parent.taskId);
      return deps.map(d => ({ ...d, createdAt: d.createdAt.toISOString() }));
    },
    dependents: async (parent: { taskId: string }, _args: unknown, context: Context) => {
      const deps = await context.loaders.taskDependents.load(parent.taskId);
      return deps.map(d => ({ ...d, createdAt: d.createdAt.toISOString() }));
    },
    progress: async (parent: { taskId: string; taskType: string }, _args: unknown, context: Context) => {
      if (parent.taskType !== 'epic' && parent.taskType !== 'story') return null;
      const result = await context.loaders.taskProgress.load(parent.taskId);
      if (!result || result.total === 0) return { total: 0, completed: 0, percentage: 0 };
      return { total: result.total, completed: result.completed, percentage: Math.round((result.completed / result.total) * 100) };
    },
  },
  CustomFieldValue: {
    field: (parent: { customField?: unknown; customFieldId: string }, _args: unknown, context: Context) => {
      if (parent.customField) return parent.customField;
      return context.prisma.customField.findUnique({ where: { customFieldId: parent.customFieldId } });
    },
  },
};
