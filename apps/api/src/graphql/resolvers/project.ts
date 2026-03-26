import type { Context } from '../context.js';
// Re-export shared types for cross-package type consistency (API ↔ Web).
// These match the GraphQL response shapes consumed by the web client.
export type { Project as SharedProject } from '@tasktoad/shared-types';
import { AuthorizationError, NotFoundError, ValidationError } from '../errors.js';
import { requireAuth, requireOrg, requireProjectAccess, requireApiKey } from './auth.js';
import { parseInput, CreateProjectInput, requireProject } from '../../utils/resolverHelpers.js';
import { emitProjectEvent, emitTaskEvent } from '../../infrastructure/eventbus/emitters.js';
import { calculateHealthScore, calculateCycleTime } from '../../utils/metricsCalc.js';

// ── Project queries ──

export const projectQueries = {
  projects: async (_parent: unknown, args: { includeArchived?: boolean | null }, context: Context) => {
    const user = requireOrg(context);
    return context.prisma.project.findMany({
      where: {
        orgId: user.orgId,
        ...(args.includeArchived ? {} : { archived: false }),
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  project: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    try {
      const { project } = await requireProjectAccess(context, args.projectId);
      return project;
    } catch {
      return null;
    }
  },

  portfolioOverview: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);
    const projects = await context.prisma.project.findMany({
      where: { orgId: user.orgId, archived: false },
      select: { projectId: true, name: true },
      orderBy: { createdAt: 'desc' },
    });

    if (projects.length === 0) return [];

    const projectIds = projects.map((p: { projectId: string }) => p.projectId);
    const today = new Date().toISOString().slice(0, 10);

    // Batch: fetch ALL tasks for all projects in one query
    const allTasks = await context.prisma.task.findMany({
      where: { projectId: { in: projectIds }, archived: false, taskType: { not: 'epic' }, OR: [{ parentTaskId: null }, { parentTask: { taskType: 'epic' } }] },
      select: { projectId: true, status: true, dueDate: true },
    });

    // Batch: fetch ALL active sprints for all projects in one query
    const activeSprints = await context.prisma.sprint.findMany({
      where: { projectId: { in: projectIds }, isActive: true, closedAt: null },
      select: { projectId: true, name: true },
    });

    // Group tasks by projectId
    const tasksByProject = new Map<string, Array<{ status: string; dueDate: string | null }>>();
    for (const t of allTasks) {
      const list = tasksByProject.get(t.projectId);
      if (list) list.push(t);
      else tasksByProject.set(t.projectId, [t]);
    }

    // Index active sprints by projectId
    const sprintByProject = new Map<string, string>();
    for (const s of activeSprints) {
      sprintByProject.set(s.projectId, s.name);
    }

    return projects.map((proj: { projectId: string; name: string }) => {
      const tasks = tasksByProject.get(proj.projectId) ?? [];
      const totalTasks = tasks.length;
      const completedTasks = tasks.filter((t) => t.status === 'done').length;
      const overdueTasks = tasks.filter((t) =>
        t.dueDate && t.dueDate < today && t.status !== 'done'
      ).length;
      const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

      // Status distribution
      const statusMap = new Map<string, number>();
      for (const t of tasks) {
        statusMap.set(t.status, (statusMap.get(t.status) ?? 0) + 1);
      }
      const statusDistribution = Array.from(statusMap, ([label, count]) => ({ label, count }));

      const healthScore: number | null = totalTasks > 0
        ? calculateHealthScore(completionPercent, overdueTasks, totalTasks)
        : null;

      return {
        projectId: proj.projectId,
        name: proj.name,
        totalTasks,
        completedTasks,
        overdueTasks,
        completionPercent,
        activeSprint: sprintByProject.get(proj.projectId) ?? null,
        healthScore,
        statusDistribution,
      };
    });
  },

  portfolioRollup: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);

    // Fetch all non-archived projects
    const projects = await context.prisma.project.findMany({
      where: { orgId: user.orgId, archived: false },
      select: { projectId: true },
    });
    const projectIds = projects.map((p) => p.projectId);
    const totalProjects = projectIds.length;

    if (totalProjects === 0) {
      return {
        totalProjects: 0,
        totalTasks: 0,
        totalVelocity: 0,
        avgCycleTimeHours: null,
        teamSprintProgress: { totalSprints: 0, activeSprints: 0, avgCompletionPercent: 0 },
        aggregateStatusDistribution: [],
      };
    }

    // All tasks (non-epic, top-level)
    const allTasks = await context.prisma.task.findMany({
      where: {
        projectId: { in: projectIds },
        orgId: user.orgId,
        archived: false,
        taskType: { not: 'epic' },
        OR: [{ parentTaskId: null }, { parentTask: { taskType: 'epic' } }],
      },
      select: { taskId: true, status: true, storyPoints: true, sprintId: true, createdAt: true },
    });

    const totalTasks = allTasks.length;

    // Aggregate status distribution
    const statusMap = new Map<string, number>();
    for (const t of allTasks) {
      statusMap.set(t.status, (statusMap.get(t.status) ?? 0) + 1);
    }
    const aggregateStatusDistribution = Array.from(statusMap, ([label, count]) => ({ label, count }));

    // Total velocity: sum of story points for done tasks in active sprints
    const activeSprints = await context.prisma.sprint.findMany({
      where: { orgId: user.orgId, projectId: { in: projectIds }, isActive: true, closedAt: null },
      select: { sprintId: true },
    });
    const activeSprintIds = new Set(activeSprints.map((s) => s.sprintId));
    let totalVelocity = 0;
    for (const t of allTasks) {
      if (t.status === 'done' && t.sprintId && activeSprintIds.has(t.sprintId)) {
        totalVelocity += t.storyPoints ?? 0;
      }
    }

    // Average cycle time: completed tasks in the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const recentDoneTasks = allTasks.filter((t) => t.status === 'done');
    const recentDoneIds = recentDoneTasks.map((t) => t.taskId);

    let avgCycleTimeHours: number | null = null;
    if (recentDoneIds.length > 0) {
      const statusActivities = await context.prisma.activity.findMany({
        where: {
          taskId: { in: recentDoneIds },
          action: 'task.updated',
          field: 'status',
          createdAt: { gte: thirtyDaysAgo },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Use task createdAt as placeholder — calculateCycleTime only uses it for lead time
      const recentDoneTasks2 = recentDoneTasks.map((t) => ({
        taskId: t.taskId,
        createdAt: t.createdAt,
      }));
      const cycleResult = calculateCycleTime(statusActivities, recentDoneTasks2);
      if (cycleResult.cycleTimes.length > 0) {
        avgCycleTimeHours = cycleResult.averageCycleTime;
      }
    }

    // Team sprint progress
    const allSprints = await context.prisma.sprint.findMany({
      where: { orgId: user.orgId, projectId: { in: projectIds }, closedAt: null },
      select: { sprintId: true, isActive: true },
    });
    const totalSprints = allSprints.length;
    const activeSprintCount = allSprints.filter((s) => s.isActive).length;

    // Avg completion % across active sprints
    let avgCompletionPercent = 0;
    if (activeSprintCount > 0) {
      const activeSprintIdList = allSprints.filter((s) => s.isActive).map((s) => s.sprintId);
      const sprintTasks = allTasks.filter((t) => t.sprintId && activeSprintIdList.includes(t.sprintId));
      const bySprintId = new Map<string, { total: number; done: number }>();
      for (const sid of activeSprintIdList) bySprintId.set(sid, { total: 0, done: 0 });
      for (const t of sprintTasks) {
        const entry = bySprintId.get(t.sprintId!);
        if (entry) {
          entry.total++;
          if (t.status === 'done') entry.done++;
        }
      }
      let sumPct = 0;
      for (const entry of bySprintId.values()) {
        sumPct += entry.total > 0 ? (entry.done / entry.total) * 100 : 0;
      }
      avgCompletionPercent = Math.round((sumPct / activeSprintCount) * 100) / 100;
    }

    return {
      totalProjects,
      totalTasks,
      totalVelocity,
      avgCycleTimeHours,
      teamSprintProgress: { totalSprints, activeSprints: activeSprintCount, avgCompletionPercent },
      aggregateStatusDistribution,
    };
  },

  recommendStack: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    const { recommendStack: aiRecommendStack } = await import('../../ai/aiService.js');
    return aiRecommendStack(
      apiKey,
      project.name,
      project.description ?? '',
      undefined,
      { prisma: context.prisma, orgId: context.user!.orgId!, userId: context.user!.userId },
    );
  },

  savedFilters: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const user = requireAuth(context);
    await requireProjectAccess(context, args.projectId);
    const filters = await context.prisma.savedFilter.findMany({
      where: { projectId: args.projectId, userId: user.userId },
      orderBy: { createdAt: 'asc' },
    });
    return filters.map((f: typeof filters[number]) => ({ ...f, createdAt: f.createdAt.toISOString() }));
  },

  sharedViews: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    requireAuth(context);
    await requireProjectAccess(context, args.projectId);
    const filters = await context.prisma.savedFilter.findMany({
      where: { projectId: args.projectId, isShared: true },
      orderBy: { createdAt: 'asc' },
    });
    return filters.map((f: typeof filters[number]) => ({ ...f, createdAt: f.createdAt.toISOString() }));
  },

  projectStats: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    const tasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, archived: false, taskType: { not: 'epic' }, OR: [{ parentTaskId: null }, { parentTask: { taskType: 'epic' } }] },
      select: { status: true, priority: true, assigneeId: true, estimatedHours: true, dueDate: true },
    });
    const orgUsers = await context.prisma.user.findMany({
      where: { orgId: context.user!.orgId! },
      select: { userId: true, email: true },
    });
    const userMap = new Map(orgUsers.map((u: { userId: string; email: string }) => [u.userId, u.email]));

    const totalTasks = tasks.length;
    const completedTasks = tasks.filter((t: { status: string }) => t.status === 'done').length;
    const today = new Date().toISOString().slice(0, 10);
    const overdueTasks = tasks.filter((t: { dueDate: string | null; status: string }) => t.dueDate && t.dueDate < today && t.status !== 'done').length;
    const completionPercent = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    const statusMap = new Map<string, number>();
    const priorityMap = new Map<string, number>();
    const assigneeMap = new Map<string, number>();
    let totalEstimatedHours = 0;
    let completedEstimatedHours = 0;

    for (const t of tasks) {
      statusMap.set(t.status, (statusMap.get(t.status) ?? 0) + 1);
      priorityMap.set(t.priority, (priorityMap.get(t.priority) ?? 0) + 1);
      if (t.assigneeId) {
        assigneeMap.set(t.assigneeId, (assigneeMap.get(t.assigneeId) ?? 0) + 1);
      }
      totalEstimatedHours += t.estimatedHours ?? 0;
      if (t.status === 'done') completedEstimatedHours += t.estimatedHours ?? 0;
    }

    return {
      totalTasks,
      completedTasks,
      overdueTasks,
      completionPercent,
      tasksByStatus: Array.from(statusMap, ([label, count]) => ({ label, count })),
      tasksByPriority: Array.from(priorityMap, ([label, count]) => ({ label, count })),
      tasksByAssignee: Array.from(assigneeMap, ([userId, count]) => ({
        userId,
        email: userMap.get(userId) ?? 'Unknown',
        count,
      })),
      totalEstimatedHours,
      completedEstimatedHours,
    };
  },
};

// ── Project mutations ──

export const projectMutations = {
  createProject: async (_parent: unknown, args: { name: string }, context: Context) => {
    parseInput(CreateProjectInput, { name: args.name });
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    return context.prisma.project.create({
      data: { name: args.name, orgId: user.orgId },
    });
  },

  updateProject: async (
    _parent: unknown,
    args: { projectId: string; name?: string | null; description?: string | null; prompt?: string | null; knowledgeBase?: string | null; statuses?: string | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    const { project } = await requireProject(context, args.projectId);
    if (args.statuses !== undefined && args.statuses !== null) {
      try {
        const parsed = JSON.parse(args.statuses) as unknown;
        if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((s) => typeof s === 'string')) {
          throw new Error();
        }
      } catch {
        throw new ValidationError('statuses must be a non-empty JSON array of strings');
      }
    }
    const updated = await context.prisma.project.update({
      where: { projectId: args.projectId },
      data: {
        ...(args.name !== undefined && args.name !== null ? { name: args.name } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
        ...(args.prompt !== undefined ? { prompt: args.prompt } : {}),
        ...(args.knowledgeBase !== undefined ? { knowledgeBase: args.knowledgeBase } : {}),
        ...(args.statuses !== undefined && args.statuses !== null ? { statuses: args.statuses } : {}),
      },
    });
    const changes: Record<string, { old: string | null; new: string | null }> = {};
    if (args.name && args.name !== project.name) {
      changes.name = { old: project.name, new: args.name };
    }
    emitProjectEvent('project.updated', { orgId: user.orgId, userId: user.userId }, {
      projectId: args.projectId,
      changes,
    });
    return updated;
  },

  saveFilter: async (_parent: unknown, args: { projectId: string; name: string; filters: string; viewType?: string | null; sortBy?: string | null; sortOrder?: string | null; groupBy?: string | null; visibleColumns?: string | null; isShared?: boolean | null }, context: Context) => {
    const user = requireAuth(context);
    await requireProjectAccess(context, args.projectId);
    if (!args.name.trim()) throw new ValidationError('Filter name is required');
    if (args.viewType != null && !['list', 'board', 'table'].includes(args.viewType)) {
      throw new ValidationError('viewType must be one of: list, board, table');
    }
    const filter = await context.prisma.savedFilter.create({
      data: {
        projectId: args.projectId,
        userId: user.userId,
        name: args.name.trim(),
        filters: args.filters,
        ...(args.viewType !== undefined ? { viewType: args.viewType } : {}),
        ...(args.sortBy !== undefined ? { sortBy: args.sortBy } : {}),
        ...(args.sortOrder !== undefined ? { sortOrder: args.sortOrder } : {}),
        ...(args.groupBy !== undefined ? { groupBy: args.groupBy } : {}),
        ...(args.visibleColumns !== undefined ? { visibleColumns: args.visibleColumns } : {}),
        ...(args.isShared != null ? { isShared: args.isShared } : {}),
      },
    });
    return { ...filter, createdAt: filter.createdAt.toISOString() };
  },

  updateFilter: async (_parent: unknown, args: { savedFilterId: string; name?: string | null; filters?: string | null; viewType?: string | null; sortBy?: string | null; sortOrder?: string | null; groupBy?: string | null; visibleColumns?: string | null; isShared?: boolean | null }, context: Context) => {
    const user = requireAuth(context);
    const filter = await context.prisma.savedFilter.findUnique({
      where: { savedFilterId: args.savedFilterId },
      include: { project: { select: { orgId: true } } },
    });
    if (!filter || filter.userId !== user.userId) throw new NotFoundError('Saved filter not found');
    if (filter.project.orgId !== user.orgId) throw new AuthorizationError('Access denied');
    if (args.viewType != null && !['list', 'board', 'table'].includes(args.viewType)) {
      throw new ValidationError('viewType must be one of: list, board, table');
    }
    const updated = await context.prisma.savedFilter.update({
      where: { savedFilterId: args.savedFilterId },
      data: {
        ...(args.name !== undefined && args.name !== null ? { name: args.name.trim() } : {}),
        ...(args.filters !== undefined && args.filters !== null ? { filters: args.filters } : {}),
        ...(args.viewType !== undefined ? { viewType: args.viewType } : {}),
        ...(args.sortBy !== undefined ? { sortBy: args.sortBy } : {}),
        ...(args.sortOrder !== undefined ? { sortOrder: args.sortOrder } : {}),
        ...(args.groupBy !== undefined ? { groupBy: args.groupBy } : {}),
        ...(args.visibleColumns !== undefined ? { visibleColumns: args.visibleColumns } : {}),
        ...(args.isShared !== undefined ? { isShared: args.isShared ?? false } : {}),
      },
    });
    return { ...updated, createdAt: updated.createdAt.toISOString() };
  },

  deleteFilter: async (_parent: unknown, args: { savedFilterId: string }, context: Context) => {
    const user = requireAuth(context);
    const filter = await context.prisma.savedFilter.findUnique({
      where: { savedFilterId: args.savedFilterId },
      include: { project: { select: { orgId: true } } },
    });
    if (!filter || filter.userId !== user.userId) throw new NotFoundError('Saved filter not found');
    if (filter.project.orgId !== user.orgId) throw new AuthorizationError('Access denied');
    await context.prisma.savedFilter.delete({ where: { savedFilterId: args.savedFilterId } });
    return true;
  },

  archiveProject: async (_parent: unknown, args: { projectId: string; archived: boolean }, context: Context) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    await requireProjectAccess(context, args.projectId);
    const result = await context.prisma.project.update({
      where: { projectId: args.projectId },
      data: { archived: args.archived },
    });
    emitProjectEvent('project.archived', { orgId: user.orgId, userId: user.userId }, {
      projectId: args.projectId,
      archived: args.archived,
    });
    return result;
  },

  autoStartProject: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const { user, project } = await requireProject(context, args.projectId);

    // If no GitHub repo exists, create one (requires a GitHub installation)
    if (!project.githubRepositoryName) {
      const installation = project.githubInstallationId
        ? await context.prisma.gitHubInstallation.findUnique({
            where: { installationId: project.githubInstallationId },
          })
        : null;
      if (!installation) {
        throw new ValidationError('Project has no linked GitHub installation. Connect GitHub first.');
      }
      const { createRepoForProject } = await import('../../github/index.js');
      await createRepoForProject(
        args.projectId,
        installation.installationId,
        installation.accountLogin
      );
    }

    // Trigger the orchestrator for all autoComplete tasks in todo status
    const autoCompleteTasks = await context.prisma.task.findMany({
      where: {
        projectId: args.projectId,
        autoComplete: true,
        status: 'todo',
        archived: false,
      },
      select: { taskId: true, title: true, status: true, taskType: true, orgId: true },
    });

    for (const task of autoCompleteTasks) {
      emitTaskEvent('task.updated', { orgId: user.orgId, userId: user.userId }, {
        projectId: args.projectId,
        task: {
          taskId: task.taskId,
          title: task.title,
          status: task.status,
          projectId: args.projectId,
          orgId: task.orgId,
          taskType: task.taskType,
        },
        changes: { autoComplete: { old: 'true', new: 'true' } },
      });
    }

    // Reload and return the updated project
    return context.prisma.project.findUniqueOrThrow({
      where: { projectId: args.projectId },
    });
  },

  scaffoldProject: async (
    _parent: unknown,
    args: { projectId: string; config: { framework: string; language: string; packages: string[]; projectType: string }; options?: string | null },
    context: Context
  ) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);

    if (!project.githubRepositoryId || !project.githubRepositoryName || !project.githubRepositoryOwner || !project.githubInstallationId) {
      throw new ValidationError('Project must have a GitHub repository connected before scaffolding.');
    }

    const defaultBranch = project.githubDefaultBranch ?? 'main';

    // Generate scaffold files via AI
    const { scaffoldProject: aiScaffold } = await import('../../ai/aiService.js');
    const result = await aiScaffold(
      apiKey,
      args.config,
      project.name,
      project.description ?? '',
      args.options,
      { prisma: context.prisma, orgId: context.user!.orgId!, userId: context.user!.userId },
    );

    // Commit files to GitHub — always use installation token so commits are attributed to the TaskToad bot
    const { getDefaultBranchOid, commitFilesToEmptyRepo, commitFiles } = await import('../../github/index.js');
    const filesToCommit = result.files.map((f) => ({ path: f.path, content: f.content }));
    const commitMessage = `chore: scaffold ${args.config.framework} ${args.config.projectType} project`;

    const repoData = {
      repositoryId: project.githubRepositoryId,
      repositoryName: project.githubRepositoryName,
      repositoryOwner: project.githubRepositoryOwner,
      installationId: project.githubInstallationId,
      defaultBranch,
    };

    const headOid = await getDefaultBranchOid(repoData);

    let commitUrl: string | null = null;

    if (!headOid) {
      // Empty repo — Contents API for first file, then GraphQL for rest
      const commitResult = await commitFilesToEmptyRepo(repoData, filesToCommit, commitMessage);
      commitUrl = commitResult.url;
    } else {
      // Existing repo — commit directly to default branch
      const commitResult = await commitFiles(
        repoData,
        {
          branch: defaultBranch,
          message: commitMessage,
          additions: filesToCommit,
        },
        headOid
      );
      commitUrl = commitResult.url;
    }

    // Auto-populate knowledge base with key scaffolded files
    const KB_USEFUL_PATTERNS = [
      /^package\.json$/,
      /^README\.md$/i,
      /^tsconfig.*\.json$/,
      /^\.env\.example$/,
      /^(next|vite|vitest)\.config\.(ts|js|mjs)$/,
      /^(src|app)\/(index|main|app)\.(ts|tsx|js|jsx|py)$/,
      /^(src|app)\/.*\.(ts|tsx|js|jsx|py)$/,
      /^requirements\.txt$/,
      /^pyproject\.toml$/,
      /^tailwind\.config\.(ts|js)$/,
    ];
    const SKIP_PATTERNS = [/node_modules/, /\.lock$/, /\.ico$/, /\.png$/, /\.jpg$/, /\.svg$/];
    const MAX_KB_ENTRIES = 10;

    const kbFiles = result.files
      .filter((f: { path: string; content: string }) => {
        if (SKIP_PATTERNS.some((p) => p.test(f.path))) return false;
        return KB_USEFUL_PATTERNS.some((p) => p.test(f.path));
      })
      .slice(0, MAX_KB_ENTRIES);

    if (kbFiles.length > 0) {
      await context.prisma.knowledgeEntry.createMany({
        data: kbFiles.map((f: { path: string; content: string }) => ({
          projectId: args.projectId,
          orgId: context.user!.orgId!,
          title: f.path,
          content: f.content,
          source: 'scaffold',
          category: 'standard',
        })),
      });
    }

    return {
      success: true,
      filesCreated: result.files.length,
      summary: result.summary,
      commitUrl,
    };
  },
};

// ── Project field resolvers ──

export const projectFieldResolvers = {
  Project: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
};
