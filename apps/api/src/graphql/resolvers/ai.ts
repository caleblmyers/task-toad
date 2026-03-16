import type { Context } from '../context.js';
import {
  generateProjectOptions as aiGenerateProjectOptions,
  generateTaskPlan as aiGenerateTaskPlan,
  expandTask as aiExpandTask,
  generateTaskInstructions as aiGenerateTaskInstructions,
  generateCode as aiGenerateCode,
  regenerateFile as aiRegenerateFile,
  summarizeProject as aiSummarizeProject,
  generateStandupReport as aiGenerateStandupReport,
  generateSprintReport as aiGenerateSprintReport,
  analyzeProjectHealth as aiAnalyzeProjectHealth,
  extractTasksFromNotes as aiExtractTasksFromNotes,
  reviewCode as aiReviewCode,
  parseBugReport as aiParseBugReport,
  breakdownPRD as aiBreakdownPRD,
  analyzeSprintTransition as aiAnalyzeSprintTransition,
  bootstrapFromRepo as aiBootstrapFromRepo,
  projectChat as aiProjectChat,
  analyzeRepoDrift as aiAnalyzeRepoDrift,
  batchGenerateCode as aiBatchGenerateCode,
} from '../../ai/index.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../errors.js';
import { requireOrg, requireApiKey } from './auth.js';
import { getProjectRepo, fetchProjectFileTree, fetchFileContent, getPullRequestDiff } from '../../github/index.js';
import { listRecentCommits, listOpenPullRequests } from '../../github/githubFileService.js';
import { requireProject, sanitizeForPrompt } from '../../utils/resolverHelpers.js';

// ── AI mutations ──

export const aiMutations = {
  saveReport: async (
    _parent: unknown,
    args: { projectId: string; type: string; title: string; data: string; sprintId?: string | null },
    context: Context
  ) => {
    const { user } = await requireProject(context, args.projectId);
    return context.prisma.report.create({
      data: {
        orgId: user.orgId,
        projectId: args.projectId,
        sprintId: args.sprintId ?? null,
        type: args.type,
        title: args.title,
        data: args.data,
        createdBy: user.userId,
      },
    });
  },

  deleteReport: async (_parent: unknown, args: { reportId: string }, context: Context) => {
    const user = requireOrg(context);
    const report = await context.prisma.report.findUnique({
      where: { id: args.reportId },
    });
    if (!report || report.orgId !== user.orgId) {
      throw new NotFoundError('Report not found');
    }
    await context.prisma.report.delete({ where: { id: args.reportId } });
    return true;
  },

  setAIBudget: async (
    _parent: unknown,
    args: { monthlyBudgetCentsUSD?: number | null; alertThreshold?: number | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    if (args.alertThreshold != null && (args.alertThreshold < 1 || args.alertThreshold > 100)) {
      throw new ValidationError('Alert threshold must be between 1 and 100');
    }
    return context.prisma.org.update({
      where: { orgId: user.orgId },
      data: {
        ...(args.monthlyBudgetCentsUSD !== undefined && { monthlyBudgetCentsUSD: args.monthlyBudgetCentsUSD ?? null }),
        ...(args.alertThreshold != null && { budgetAlertThreshold: args.alertThreshold }),
      },
    });
  },

  generateProjectOptions: async (_parent: unknown, args: { prompt: string }, context: Context) => {
    const apiKey = requireApiKey(context);
    return aiGenerateProjectOptions(apiKey, args.prompt);
  },

  createProjectFromOption: async (
    _parent: unknown,
    args: { prompt: string; title: string; description: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    return context.prisma.project.create({
      data: {
        name: args.title,
        description: args.description,
        prompt: args.prompt,
        orgId: user.orgId,
      },
    });
  },

  generateTaskPlan: async (
    _parent: unknown,
    args: { projectId: string; context?: string | null },
    context: Context
  ) => {
    const { user, project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    const existingTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, archived: false },
      select: { title: true },
    });
    const existingTitles = existingTasks.map((t: { title: string }) => t.title);
    await context.prisma.task.deleteMany({
      where: { projectId: args.projectId, parentTaskId: null },
    });
    const taskPlans = await aiGenerateTaskPlan(
      apiKey,
      project.name,
      project.description ?? '',
      project.prompt ?? '',
      args.context,
      project.knowledgeBase,
      existingTitles
    );
    return Promise.all(
      taskPlans.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            instructions: t.instructions,
            acceptanceCriteria: t.acceptanceCriteria || null,
            suggestedTools: JSON.stringify(t.suggestedTools),
            status: 'todo',
            projectId: args.projectId,
            orgId: user.orgId,
          },
        })
      )
    );
  },

  previewTaskPlan: async (
    _parent: unknown,
    args: { projectId: string; context?: string | null; appendToTitles?: string[] | null },
    context: Context
  ) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    const existingTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, archived: false },
      select: { title: true },
    });
    const existingTitles = existingTasks.map((t: { title: string }) => t.title);
    let fullContext = args.context ?? undefined;
    if (args.appendToTitles && args.appendToTitles.length > 0) {
      const existing = args.appendToTitles.map((t: string) => `<task_title>${sanitizeForPrompt(t)}</task_title>`).join(', ');
      fullContext = `These tasks already exist: ${existing}. Generate ONLY additional tasks not already in this list.${args.context ? ` Additional context: ${args.context}` : ''}`;
    }
    const allExistingTitles = [...existingTitles, ...(args.appendToTitles ?? [])];
    const taskPlans = await aiGenerateTaskPlan(
      apiKey,
      project.name,
      project.description ?? '',
      project.prompt ?? '',
      fullContext,
      project.knowledgeBase,
      allExistingTitles
    );
    const existingSet = new Set(allExistingTitles.map((t) => t.trim().toLowerCase()));
    const dedupedPlans = taskPlans.filter((t) => !existingSet.has(t.title.trim().toLowerCase()));
    return dedupedPlans.map((t) => ({
      title: t.title,
      description: t.description,
      instructions: t.instructions,
      suggestedTools: JSON.stringify(t.suggestedTools),
      estimatedHours: t.estimatedHours ?? null,
      priority: t.priority ?? 'medium',
      dependsOn: t.dependsOn ?? [],
      subtasks: t.subtasks ?? [],
      acceptanceCriteria: t.acceptanceCriteria || null,
    }));
  },

  commitTaskPlan: async (
    _parent: unknown,
    args: {
      projectId: string;
      tasks: Array<{
        title: string;
        description: string;
        instructions: string;
        suggestedTools: string;
        estimatedHours?: number | null;
        priority?: string | null;
        dependsOn: string[];
        subtasks: Array<{ title: string; description: string }>;
        acceptanceCriteria?: string | null;
      }>;
      clearExisting?: boolean | null;
    },
    context: Context
  ) => {
    const { user } = await requireProject(context, args.projectId);

    if (args.clearExisting) {
      await context.prisma.task.deleteMany({
        where: { projectId: args.projectId, parentTaskId: { not: null } },
      });
      await context.prisma.task.deleteMany({
        where: { projectId: args.projectId, parentTaskId: null },
      });
    }

    const results = await Promise.allSettled(
      args.tasks.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            instructions: t.instructions,
            acceptanceCriteria: t.acceptanceCriteria || null,
            suggestedTools: t.suggestedTools,
            estimatedHours: t.estimatedHours ?? null,
            priority: t.priority ?? 'medium',
            status: 'todo',
            projectId: args.projectId,
            orgId: user.orgId,
          },
        })
      )
    );
    const created = results
      .filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof context.prisma.task.create>>> => r.status === 'fulfilled')
      .map((r) => r.value);
    if (created.length === 0 && args.tasks.length > 0) {
      throw new ValidationError('Failed to create any tasks');
    }

    const titleToId = new Map<string, string>();
    created.forEach((task) => titleToId.set(task.title, task.taskId));

    await Promise.all(
      created.map(async (task, i) => {
        const inputTask = args.tasks[i];
        const resolvedDeps = inputTask.dependsOn
          .map((title) => titleToId.get(title))
          .filter((id): id is string => id !== undefined);

        const updates: Promise<unknown>[] = [];

        if (resolvedDeps.length > 0) {
          updates.push(
            context.prisma.task.update({
              where: { taskId: task.taskId },
              data: { dependsOn: JSON.stringify(resolvedDeps) },
            })
          );
        }

        if (inputTask.subtasks.length > 0) {
          updates.push(
            context.prisma.task.createMany({
              data: inputTask.subtasks.map((st) => ({
                title: st.title,
                description: st.description,
                status: 'todo',
                projectId: args.projectId,
                parentTaskId: task.taskId,
                orgId: user.orgId,
                priority: 'medium',
              })),
            })
          );
        }

        await Promise.all(updates);
      })
    );

    return context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null },
      orderBy: { createdAt: 'asc' },
    });
  },

  expandTask: async (
    _parent: unknown,
    args: { taskId: string; context?: string | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    const project = await context.loaders.projectById.load(task.projectId);
    if (!project) throw new NotFoundError('Project not found');
    const siblings = await context.prisma.task.findMany({
      where: { projectId: task.projectId, parentTaskId: task.parentTaskId ?? null, NOT: { taskId: task.taskId } },
      select: { title: true },
    });
    await context.prisma.task.deleteMany({ where: { parentTaskId: args.taskId } });
    const subtaskPlans = await aiExpandTask(
      apiKey,
      task.title,
      task.description ?? '',
      project.name,
      args.context,
      project.knowledgeBase,
      siblings.map((s: { title: string }) => s.title)
    );
    return Promise.all(
      subtaskPlans.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            instructions: t.instructions,
            suggestedTools: JSON.stringify(t.suggestedTools),
            status: 'todo',
            projectId: task.projectId,
            parentTaskId: task.taskId,
            orgId: user.orgId,
          },
        })
      )
    );
  },

  generateTaskInstructions: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    const project = await context.loaders.projectById.load(task.projectId);
    if (!project) throw new NotFoundError('Project not found');
    const siblings = await context.prisma.task.findMany({
      where: { projectId: task.projectId, parentTaskId: null, NOT: { taskId: task.taskId } },
      select: { taskId: true, title: true },
      orderBy: { createdAt: 'asc' },
    });
    const result = await aiGenerateTaskInstructions(
      apiKey,
      task.title,
      task.description ?? '',
      project.name,
      siblings.map((s: { title: string }) => s.title),
      project.knowledgeBase
    );
    const titleToId = new Map(siblings.map((s: { title: string; taskId: string }) => [s.title, s.taskId]));
    const resolvedDeps = result.dependsOn
      .map((title) => titleToId.get(title))
      .filter((id): id is string => id !== undefined);
    await context.prisma.task.deleteMany({ where: { parentTaskId: task.taskId } });
    if (result.subtasks.length > 0) {
      await context.prisma.task.createMany({
        data: result.subtasks.map((st) => ({
          title: st.title,
          description: st.description,
          status: 'todo',
          projectId: task.projectId,
          parentTaskId: task.taskId,
          orgId: user.orgId,
          priority: 'medium',
        })),
      });
    }
    return context.prisma.task.update({
      where: { taskId: args.taskId },
      data: {
        instructions: result.instructions,
        suggestedTools: JSON.stringify(result.suggestedTools),
        estimatedHours: result.estimatedHours,
        priority: result.priority,
        dependsOn: resolvedDeps.length > 0 ? JSON.stringify(resolvedDeps) : null,
      },
    });
  },

  generateCodeFromTask: async (_parent: unknown, args: { taskId: string; styleGuide?: string | null }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    if (!task.instructions) {
      throw new ValidationError('Task has no instructions. Generate instructions first.');
    }
    const project = await context.loaders.projectById.load(task.projectId);
    if (!project) throw new NotFoundError('Project not found');

    // Fetch project file tree for context if repo is connected
    let projectFiles: Array<{ path: string; language: string; size: number }> | undefined;
    const repo = await getProjectRepo(task.projectId);
    if (repo) {
      projectFiles = await fetchProjectFileTree(repo).catch(() => undefined);
    }

    return aiGenerateCode(
      apiKey,
      task.title,
      task.description ?? '',
      task.instructions,
      project.name,
      project.description ?? '',
      projectFiles,
      args.styleGuide,
      project.knowledgeBase,
    );
  },

  regenerateCodeFile: async (
    _parent: unknown,
    args: { taskId: string; filePath: string; feedback?: string | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    if (!task.instructions) {
      throw new ValidationError('Task has no instructions. Generate instructions first.');
    }
    const project = await context.loaders.projectById.load(task.projectId);
    if (!project) throw new NotFoundError('Project not found');
    return aiRegenerateFile(
      apiKey,
      task.title,
      task.description ?? '',
      task.instructions,
      args.filePath,
      '', // original content will be passed from frontend in feedback if needed
      project.name,
      args.feedback
    );
  },

  reviewPullRequest: async (
    _parent: unknown,
    args: { taskId: string; prNumber: number },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }

    const project = await context.loaders.projectById.load(task.projectId);
    if (!project) throw new NotFoundError('Project not found');
    if (!project.githubInstallationId || !project.githubRepositoryOwner || !project.githubRepositoryName) {
      throw new ValidationError('Project has no linked GitHub repository');
    }

    const diff = await getPullRequestDiff(
      project.githubInstallationId,
      project.githubRepositoryOwner,
      project.githubRepositoryName,
      args.prNumber
    );

    return aiReviewCode(apiKey, {
      taskTitle: task.title,
      taskDescription: task.description ?? '',
      taskInstructions: task.instructions ?? undefined,
      acceptanceCriteria: (task as Record<string, unknown>).acceptanceCriteria as string | undefined,
      diff,
      projectName: project.name,
    });
  },

  parseBugReport: async (
    _parent: unknown,
    args: { projectId: string; bugReport: string },
    context: Context
  ) => {
    const { user, project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    if (!args.bugReport.trim()) {
      throw new ValidationError('Bug report text is required');
    }
    const result = await aiParseBugReport(apiKey, {
      bugReport: args.bugReport,
      projectName: project.name,
      projectDescription: project.description,
    });
    return context.prisma.task.create({
      data: {
        title: result.title,
        description: result.description,
        priority: result.priority,
        suggestedTools: JSON.stringify(result.suggestedTools),
        acceptanceCriteria: result.acceptanceCriteria ?? null,
        status: 'todo',
        projectId: args.projectId,
        orgId: user.orgId,
      },
    });
  },

  previewPRDBreakdown: async (
    _parent: unknown,
    args: { projectId: string; prd: string },
    context: Context
  ) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    if (!args.prd.trim()) {
      throw new ValidationError('PRD text is required');
    }
    return aiBreakdownPRD(apiKey, {
      prd: args.prd,
      projectName: project.name,
      projectDescription: project.description,
    });
  },

  commitPRDBreakdown: async (
    _parent: unknown,
    args: { projectId: string; epics: string },
    context: Context
  ) => {
    const { user } = await requireProject(context, args.projectId);
    let epics: Array<{ title: string; description: string; tasks: Array<{ title: string; description: string; priority: string; estimatedHours?: number; acceptanceCriteria?: string }> }>;
    try {
      epics = JSON.parse(args.epics);
    } catch {
      throw new ValidationError('Invalid epics JSON');
    }
    const allCreated: Array<Record<string, unknown>> = [];
    for (const epic of epics) {
      const epicTask = await context.prisma.task.create({
        data: {
          title: epic.title,
          description: epic.description,
          status: 'todo',
          projectId: args.projectId,
          orgId: user.orgId,
          taskType: 'epic',
          priority: 'high',
        },
      });
      allCreated.push(epicTask);
      for (const t of epic.tasks) {
        const childTask = await context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            priority: t.priority || 'medium',
            estimatedHours: t.estimatedHours ?? null,
            acceptanceCriteria: t.acceptanceCriteria ?? null,
            status: 'todo',
            projectId: args.projectId,
            orgId: user.orgId,
            parentTaskId: epicTask.taskId,
          },
        });
        allCreated.push(childTask);
      }
    }
    return allCreated;
  },

  batchGenerateCode: async (
    _parent: unknown,
    args: { projectId: string; taskIds: string[]; styleGuide?: string | null },
    context: Context
  ) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    if (!args.taskIds.length || args.taskIds.length > 5) {
      throw new ValidationError('Provide 1-5 task IDs');
    }
    const tasks = await context.prisma.task.findMany({
      where: { taskId: { in: args.taskIds }, projectId: args.projectId },
    });
    if (tasks.length !== args.taskIds.length) {
      throw new NotFoundError('One or more tasks not found in this project');
    }
    const missingInstructions = tasks.filter((t: { instructions: string | null }) => !t.instructions);
    if (missingInstructions.length > 0) {
      throw new ValidationError(`Tasks missing instructions: ${missingInstructions.map((t: { title: string }) => t.title).join(', ')}`);
    }

    let projectFiles: Array<{ path: string; language: string; size: number }> | undefined;
    const repo = await getProjectRepo(args.projectId);
    if (repo) {
      projectFiles = await fetchProjectFileTree(repo).catch(() => undefined);
    }

    return aiBatchGenerateCode(apiKey, {
      tasks: tasks.map((t: { title: string; description: string | null; instructions: string | null }) => ({
        title: t.title,
        description: t.description ?? '',
        instructions: t.instructions ?? '',
      })),
      projectName: project.name,
      projectDescription: project.description,
      existingFiles: projectFiles,
      styleGuide: args.styleGuide,
      knowledgeBase: project.knowledgeBase,
    });
  },

  bootstrapProjectFromRepo: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context
  ) => {
    const { user, project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    const repo = await getProjectRepo(args.projectId);
    if (!repo) {
      throw new ValidationError('Project has no linked GitHub repository');
    }
    const fileTree = await fetchProjectFileTree(repo).catch(() => []);
    const readme = await fetchFileContent(repo.installationId, repo.repositoryOwner, repo.repositoryName, 'README.md').catch(() => null);
    const packageJson = await fetchFileContent(repo.installationId, repo.repositoryOwner, repo.repositoryName, 'package.json').catch(() => null);

    const languageSet = new Set<string>();
    for (const f of fileTree) {
      if (f.language) languageSet.add(f.language);
    }

    const result = await aiBootstrapFromRepo(apiKey, {
      repoName: `${repo.repositoryOwner}/${repo.repositoryName}`,
      repoDescription: project.description,
      readme,
      packageJson,
      fileTree: fileTree.map((f) => ({ path: f.path, language: f.language, size: f.size })),
      languages: [...languageSet],
    });

    if (!project.description && result.projectDescription) {
      await context.prisma.project.update({
        where: { projectId: args.projectId },
        data: { description: result.projectDescription },
      });
    }

    const created = await Promise.all(
      result.tasks.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            priority: t.priority,
            estimatedHours: t.estimatedHours ?? null,
            taskType: t.taskType || 'task',
            status: 'todo',
            projectId: args.projectId,
            orgId: user.orgId,
          },
        })
      )
    );
    return created;
  },

  summarizeProject: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.loaders.projectById.load(args.projectId);
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }
    const tasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null },
      select: { title: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    if (tasks.length === 0) {
      throw new ValidationError('No tasks to summarize. Generate a task plan first.');
    }
    return aiSummarizeProject(apiKey, project.name, project.description ?? '', tasks);
  },
};

// ── AI queries ──

export const aiQueries = {
  projectChat: async (
    _parent: unknown,
    args: { projectId: string; question: string },
    context: Context
  ) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    if (!args.question.trim()) {
      throw new ValidationError('Question is required');
    }

    const tasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null, archived: false },
      include: { assignee: { select: { email: true } }, sprint: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    const sprints = await context.prisma.sprint.findMany({
      where: { projectId: args.projectId },
      include: { _count: { select: { tasks: true } } },
    });

    const activities = await context.prisma.activity.findMany({
      where: { projectId: args.projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Build a taskId→title map for activity references
    const activityTaskIds = [...new Set(activities.map((a: { taskId: string | null }) => a.taskId).filter(Boolean))] as string[];
    const activityTasks = activityTaskIds.length > 0
      ? await context.prisma.task.findMany({ where: { taskId: { in: activityTaskIds } }, select: { taskId: true, title: true } })
      : [];
    const taskTitleMap = new Map(activityTasks.map((t: { taskId: string; title: string }) => [t.taskId, t.title]));

    return aiProjectChat(apiKey, {
      question: args.question,
      projectName: project.name,
      projectDescription: project.description,
      tasks: tasks.map((t: { taskId: string; title: string; status: string; priority: string; assignee: { email: string } | null; sprint: { name: string } | null }) => ({
        taskId: t.taskId,
        title: t.title,
        status: t.status,
        priority: t.priority,
        assignee: t.assignee?.email ?? null,
        sprintName: t.sprint?.name ?? null,
      })),
      sprints: sprints.map((s: { name: string; isActive: boolean; _count: { tasks: number } }) => ({
        name: s.name,
        isActive: s.isActive,
        taskCount: s._count.tasks,
      })),
      recentActivity: activities.map((a: { action: string; field: string | null; taskId: string | null; createdAt: Date }) => ({
        action: a.action,
        field: a.field,
        taskTitle: a.taskId ? taskTitleMap.get(a.taskId) ?? null : null,
        createdAt: a.createdAt.toISOString(),
      })),
      knowledgeBase: project.knowledgeBase,
    });
  },

  analyzeRepoDrift: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context
  ) => {
    await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    const repo = await getProjectRepo(args.projectId);
    if (!repo) {
      throw new ValidationError('Project has no linked GitHub repository');
    }

    const [commits, prs, tasks] = await Promise.all([
      listRecentCommits(repo.installationId, repo.repositoryOwner, repo.repositoryName, 30),
      listOpenPullRequests(repo.installationId, repo.repositoryOwner, repo.repositoryName),
      context.prisma.task.findMany({
        where: { projectId: args.projectId, parentTaskId: null, archived: false },
        select: { taskId: true, title: true, status: true, description: true },
        take: 50,
      }),
    ]);

    return aiAnalyzeRepoDrift(apiKey, {
      repoName: `${repo.repositoryOwner}/${repo.repositoryName}`,
      recentCommits: commits,
      openPRs: prs,
      tasks: tasks.map((t: { taskId: string; title: string; status: string; description: string | null }) => ({
        taskId: t.taskId,
        title: t.title,
        status: t.status,
        description: t.description,
      })),
    });
  },

  analyzeSprintTransition: async (
    _parent: unknown,
    args: { sprintId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const sprint = await context.prisma.sprint.findFirst({
      where: { sprintId: args.sprintId },
    });
    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }
    const project = await context.prisma.project.findFirst({
      where: { projectId: sprint.projectId, orgId: user.orgId },
    });
    if (!project) {
      throw new NotFoundError('Project not found');
    }

    const sprintTasks = await context.prisma.task.findMany({
      where: { sprintId: args.sprintId, parentTaskId: null },
      include: { assignee: { select: { email: true } } },
    });

    const totalTasks = sprintTasks.length;
    const completedCount = sprintTasks.filter((t: { status: string }) => t.status === 'done').length;
    const completionRate = totalTasks > 0 ? Math.round((completedCount / totalTasks) * 100) : 0;

    const incompleteTasks = sprintTasks.filter((t: { status: string }) => t.status !== 'done');

    return aiAnalyzeSprintTransition(apiKey, {
      sprintName: sprint.name,
      tasks: incompleteTasks.map((t: { taskId: string; title: string; status: string; priority: string; storyPoints: number | null; assignee: { email: string } | null }) => ({
        taskId: t.taskId,
        title: t.title,
        status: t.status,
        priority: t.priority,
        storyPoints: t.storyPoints,
        assignee: t.assignee?.email ?? null,
      })),
      completionRate,
    });
  },

  reports: async (
    _parent: unknown,
    args: { projectId: string; type?: string | null; limit?: number | null; cursor?: string | null },
    context: Context
  ) => {
    await requireProject(context, args.projectId);
    const limit = args.limit ?? 20;
    const reports = await context.prisma.report.findMany({
      where: {
        projectId: args.projectId,
        ...(args.type ? { type: args.type } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(args.cursor ? { cursor: { id: args.cursor }, skip: 1 } : {}),
    });
    const hasMore = reports.length > limit;
    const items = hasMore ? reports.slice(0, limit) : reports;
    const nextCursor = hasMore ? items[items.length - 1].id : null;
    return { reports: items, hasMore, nextCursor };
  },

  aiPromptHistory: async (
    _parent: unknown,
    args: { taskId?: string | null; projectId?: string | null; limit?: number | null },
    context: Context
  ) => {
    const user = requireOrg(context);
    const where: Record<string, unknown> = { orgId: user.orgId };
    if (args.taskId) where.taskId = args.taskId;
    if (args.projectId) where.projectId = args.projectId;
    const logs = await context.prisma.aIPromptLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: args.limit ?? 20,
    });
    return logs.map((l: { id: string; feature: string; taskId: string | null; projectId: string | null; input: string; output: string; inputTokens: number; outputTokens: number; costUSD: number; latencyMs: number; model: string; cached: boolean; createdAt: Date }) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    }));
  },

  analyzeTrends: async (
    _parent: unknown,
    args: { projectId: string; period?: string | null },
    context: Context
  ) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);

    const reports = await context.prisma.report.findMany({
      where: { projectId: args.projectId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { type: true, title: true, data: true, createdAt: true },
    });

    const formattedReports = reports.map((r: { type: string; title: string; data: string; createdAt: Date }) => ({
      type: r.type,
      title: r.title,
      data: r.data,
      createdAt: r.createdAt.toISOString(),
    }));

    const { analyzeTrends: aiAnalyzeTrends } = await import('../../ai/aiService.js');
    return aiAnalyzeTrends(apiKey, {
      projectName: project.name,
      reports: formattedReports,
      period: args.period,
    });
  },

  aiUsage: async (_parent: unknown, args: { days?: number | null }, context: Context) => {
    const user = requireOrg(context);
    const days = args.days ?? 30;
    const since = new Date();
    since.setDate(since.getDate() - days);

    const logs = await context.prisma.aIUsageLog.findMany({
      where: { orgId: user.orgId, createdAt: { gte: since } },
    });

    let totalCostUSD = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const featureMap = new Map<string, { calls: number; costUSD: number; totalLatencyMs: number }>();

    for (const log of logs) {
      totalCostUSD += log.costUSD;
      totalInputTokens += log.inputTokens;
      totalOutputTokens += log.outputTokens;

      const entry = featureMap.get(log.feature) ?? { calls: 0, costUSD: 0, totalLatencyMs: 0 };
      entry.calls += 1;
      entry.costUSD += log.costUSD;
      entry.totalLatencyMs += log.latencyMs;
      featureMap.set(log.feature, entry);
    }

    const byFeature = Array.from(featureMap.entries())
      .map(([feature, data]) => ({
        feature,
        calls: data.calls,
        costUSD: data.costUSD,
        avgLatencyMs: Math.round(data.totalLatencyMs / data.calls),
      }))
      .sort((a, b) => b.costUSD - a.costUSD);

    const org = await context.prisma.org.findUnique({
      where: { orgId: user.orgId },
      select: { monthlyBudgetCentsUSD: true },
    });

    let budgetUsedPercent: number | null = null;
    if (org?.monthlyBudgetCentsUSD) {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const monthLogs = since <= startOfMonth
        ? logs.filter((l) => l.createdAt >= startOfMonth)
        : logs;

      const monthCost = monthLogs.reduce((sum, l) => sum + l.costUSD, 0);
      budgetUsedPercent = Math.round((monthCost * 100 * 100) / org.monthlyBudgetCentsUSD) / 100;
    }

    return {
      totalCostUSD,
      totalInputTokens,
      totalOutputTokens,
      totalCalls: logs.length,
      byFeature,
      budgetUsedPercent,
      budgetLimitCentsUSD: org?.monthlyBudgetCentsUSD ?? null,
    };
  },

  generateStandupReport: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);

    // Find tasks completed in the last 24 hours via activity log
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentDoneActivities = await context.prisma.activity.findMany({
      where: {
        projectId: args.projectId,
        field: 'status',
        newValue: 'done',
        createdAt: { gte: oneDayAgo },
        taskId: { not: null },
      },
      select: { taskId: true },
    });
    const doneTaskIds = [...new Set(recentDoneActivities.map((a) => a.taskId!))];
    const completedTasks = doneTaskIds.length > 0
      ? await context.prisma.task.findMany({
          where: { taskId: { in: doneTaskIds }, parentTaskId: null },
          select: { title: true },
        })
      : [];

    const inProgressTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null, status: 'in_progress' },
      select: { title: true },
    });

    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueTasks = await context.prisma.task.findMany({
      where: {
        projectId: args.projectId,
        parentTaskId: null,
        status: { not: 'done' },
        dueDate: { lt: todayStr, not: null },
      },
      select: { title: true },
    });

    const activeSprint = await context.prisma.sprint.findFirst({
      where: { projectId: args.projectId, isActive: true },
    });

    return aiGenerateStandupReport(apiKey, {
      projectName: project.name,
      sprintName: activeSprint?.name ?? null,
      sprintStart: activeSprint?.startDate ?? null,
      sprintEnd: activeSprint?.endDate ?? null,
      completedTasks: completedTasks.map((t) => t.title),
      inProgressTasks: inProgressTasks.map((t) => t.title),
      overdueTasks: overdueTasks.map((t) => t.title),
    });
  },

  generateSprintReport: async (_parent: unknown, args: { projectId: string; sprintId: string }, context: Context) => {
    await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    const sprint = await context.prisma.sprint.findFirst({
      where: { sprintId: args.sprintId, projectId: args.projectId },
    });
    if (!sprint) {
      throw new NotFoundError('Sprint not found');
    }

    const sprintTasks = await context.prisma.task.findMany({
      where: { sprintId: args.sprintId, parentTaskId: null },
      include: { assignee: { select: { email: true } } },
    });

    const totalTasks = sprintTasks.length;
    const completedCount = sprintTasks.filter((t) => t.status === 'done').length;

    return aiGenerateSprintReport(apiKey, {
      sprintName: sprint.name,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      tasks: sprintTasks.map((t) => ({
        title: t.title,
        status: t.status,
        priority: t.priority,
        assigneeEmail: t.assignee?.email ?? null,
      })),
      totalTasks,
      completedTasks: completedCount,
    });
  },

  analyzeProjectHealth: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);

    const allTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, parentTaskId: null, archived: false },
      select: { status: true, assigneeId: true, dueDate: true, createdAt: true },
    });

    const totalTasks = allTasks.length;
    if (totalTasks === 0) {
      throw new ValidationError('No tasks to analyze. Create some tasks first.');
    }

    const statusCounts: Record<string, number> = {};
    for (const t of allTasks) {
      statusCounts[t.status] = (statusCounts[t.status] ?? 0) + 1;
    }
    const tasksByStatus = Object.entries(statusCounts).map(([status, count]) => ({ status, count }));

    const todayStr = new Date().toISOString().slice(0, 10);
    const overdueCount = allTasks.filter(
      (t) => t.dueDate && t.dueDate < todayStr && t.status !== 'done'
    ).length;

    const unassignedCount = allTasks.filter((t) => !t.assigneeId && t.status !== 'done').length;
    const tasksWithoutDueDate = allTasks.filter((t) => !t.dueDate && t.status !== 'done').length;

    const now = Date.now();
    const openTasks = allTasks.filter((t) => t.status !== 'done');
    const avgTaskAgeInDays = openTasks.length > 0
      ? Math.round(openTasks.reduce((sum, t) => sum + (now - t.createdAt.getTime()) / (1000 * 60 * 60 * 24), 0) / openTasks.length)
      : 0;

    return aiAnalyzeProjectHealth(apiKey, {
      projectName: project.name,
      totalTasks,
      tasksByStatus,
      overdueCount,
      unassignedCount,
      tasksWithoutDueDate,
      avgTaskAgeInDays,
    });
  },

  extractTasksFromNotes: async (_parent: unknown, args: { projectId: string; notes: string }, context: Context) => {
    const { user, project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);

    const orgUsers = await context.prisma.user.findMany({
      where: { orgId: user.orgId },
      select: { email: true },
    });
    const teamMembers = orgUsers.map((u) => u.email);

    return aiExtractTasksFromNotes(apiKey, args.notes, project.name, teamMembers);
  },
};
