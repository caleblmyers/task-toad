import type { Context } from '../../context.js';
import {
  generateProjectOptions as aiGenerateProjectOptions,
  generateTaskPlan as aiGenerateTaskPlan,
  expandTask as aiExpandTask,
  generateTaskInstructions as aiGenerateTaskInstructions,
  summarizeProject as aiSummarizeProject,
  reviewCode as aiReviewCode,
  parseBugReport as aiParseBugReport,
  breakdownPRD as aiBreakdownPRD,
  bootstrapFromRepo as aiBootstrapFromRepo,
  generateRepoProfile as aiGenerateRepoProfile,
  generateOnboardingQuestions as aiGenerateOnboardingQuestions,
} from '../../../ai/index.js';
import { NotFoundError, ValidationError } from '../../errors.js';
import { requireOrg, requireApiKey } from '../auth.js';
import { buildPromptLogContext, enforceBudget, ROOT_OR_EPIC_CHILD } from './helpers.js';
import { getProjectRepo, fetchProjectFileTree, fetchFileContent, getPullRequestDiff, resolveReviewContext } from '../../../github/index.js';
import type { RelevantFile } from '../../../github/index.js';
import { requireProject, sanitizeForPrompt } from '../../../utils/resolverHelpers.js';
import { EpicsInputSchema } from '../../../utils/zodSchemas.js';

export const generationMutations = {
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

  generateProjectOptions: async (_parent: unknown, args: { prompt: string }, context: Context) => {
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
    const plc = await buildPromptLogContext(context);
    return aiGenerateProjectOptions(apiKey, args.prompt, plc);
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
    await enforceBudget(context);
    const existingTasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, archived: false },
      select: { title: true },
    });
    const existingTitles = existingTasks.map((t: { title: string }) => t.title);
    await context.prisma.task.deleteMany({
      where: { projectId: args.projectId, parentTaskId: null },
    });
    const plc = await buildPromptLogContext(context);
    const taskPlans = await aiGenerateTaskPlan(
      apiKey,
      project.name,
      project.description ?? '',
      project.prompt ?? '',
      args.context,
      project.knowledgeBase,
      existingTitles,
      plc
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
    await enforceBudget(context);
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
    const plc = await buildPromptLogContext(context);
    const taskPlans = await aiGenerateTaskPlan(
      apiKey,
      project.name,
      project.description ?? '',
      project.prompt ?? '',
      fullContext,
      project.knowledgeBase,
      allExistingTitles,
      plc
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
      tasks: (t.tasks ?? []).map((ct) => ({
        title: ct.title,
        description: ct.description,
        instructions: ct.instructions || null,
        estimatedHours: ct.estimatedHours ?? null,
        priority: ct.priority || null,
        acceptanceCriteria: ct.acceptanceCriteria || null,
        suggestedTools: ct.suggestedTools ? JSON.stringify(ct.suggestedTools) : null,
      })),
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
        tasks: Array<{ title: string; description: string; instructions?: string | null; estimatedHours?: number | null; priority?: string | null; acceptanceCriteria?: string | null; suggestedTools?: string | null }>;
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
            taskType: 'epic',
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

    // Map epic title → epicId for dependency resolution
    const titleToId = new Map<string, string>();
    created.forEach((task) => titleToId.set(task.title, task.taskId));

    // Resolve epic-level dependencies and create TaskDependency records
    const epicDeps = new Map<string, string[]>(); // epicId → [dependencyEpicIds]
    for (let i = 0; i < created.length; i++) {
      const inputTask = args.tasks[i];
      const resolvedDeps = inputTask.dependsOn
        .map((title) => titleToId.get(title))
        .filter((id): id is string => id !== undefined);
      if (resolvedDeps.length > 0) {
        epicDeps.set(created[i].taskId, resolvedDeps);
        // Create TaskDependency records (sourceTask blocks targetTask)
        await Promise.all(
          resolvedDeps.map((depId) =>
            context.prisma.taskDependency.create({
              data: { sourceTaskId: depId, targetTaskId: created[i].taskId, linkType: 'blocks' },
            }).catch(() => { /* ignore duplicate constraint violations */ })
          )
        );
      }
    }

    // Create child tasks for each epic
    await Promise.all(
      created.map(async (task, i) => {
        const inputTask = args.tasks[i];
        if (inputTask.tasks.length > 0) {
          await context.prisma.task.createMany({
            data: inputTask.tasks.map((ct) => ({
              title: ct.title,
              description: ct.description,
              instructions: ct.instructions || null,
              estimatedHours: ct.estimatedHours ?? null,
              priority: ct.priority ?? 'medium',
              acceptanceCriteria: ct.acceptanceCriteria || null,
              suggestedTools: ct.suggestedTools || null,
              status: 'todo',
              taskType: 'task',
              projectId: args.projectId,
              parentTaskId: task.taskId,
              orgId: user.orgId,
            })),
          });
        }
      })
    );

    // Propagate epic dependencies to child tasks:
    // If Epic A depends on Epic B, each child task of A depends on all child tasks of B
    if (epicDeps.size > 0) {
      // Fetch all child tasks grouped by parent epic
      const allChildTasks = await context.prisma.task.findMany({
        where: { projectId: args.projectId, taskType: 'task', parentTaskId: { in: created.map((c) => c.taskId) } },
        select: { taskId: true, parentTaskId: true },
      });
      const childrenByEpic = new Map<string, string[]>();
      for (const ct of allChildTasks) {
        if (!ct.parentTaskId) continue;
        const list = childrenByEpic.get(ct.parentTaskId) ?? [];
        list.push(ct.taskId);
        childrenByEpic.set(ct.parentTaskId, list);
      }

      // For each epic with dependencies, create TaskDependency records for children
      const depCreates: Promise<unknown>[] = [];
      for (const [epicId, depEpicIds] of epicDeps) {
        const myChildren = childrenByEpic.get(epicId) ?? [];
        if (myChildren.length === 0) continue;
        const depTaskIds: string[] = [];
        for (const depEpicId of depEpicIds) {
          const depChildren = childrenByEpic.get(depEpicId) ?? [];
          depTaskIds.push(...depChildren);
        }
        if (depTaskIds.length === 0) continue;
        for (const childId of myChildren) {
          for (const depTaskId of depTaskIds) {
            depCreates.push(
              context.prisma.taskDependency.create({
                data: { sourceTaskId: depTaskId, targetTaskId: childId, linkType: 'blocks' },
              }).catch(() => { /* ignore duplicate constraint violations */ })
            );
          }
        }
      }
      await Promise.all(depCreates);
    }

    return context.prisma.task.findMany({
      where: { projectId: args.projectId, taskType: { not: 'epic' } },
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
    await enforceBudget(context);
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
    const plc = await buildPromptLogContext(context);
    const childTaskPlans = await aiExpandTask(
      apiKey,
      task.title,
      task.description ?? '',
      project.name,
      args.context,
      project.knowledgeBase,
      siblings.map((s: { title: string }) => s.title),
      plc
    );
    return Promise.all(
      childTaskPlans.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            instructions: t.instructions,
            suggestedTools: JSON.stringify(t.suggestedTools),
            estimatedHours: t.estimatedHours ?? null,
            priority: t.priority ?? 'medium',
            acceptanceCriteria: t.acceptanceCriteria || null,
            status: 'todo',
            taskType: 'task',
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
    await enforceBudget(context);
    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    const project = await context.loaders.projectById.load(task.projectId);
    if (!project) throw new NotFoundError('Project not found');
    const siblings = await context.prisma.task.findMany({
      where: { projectId: task.projectId, taskType: { not: 'epic' }, NOT: { taskId: task.taskId }, ...ROOT_OR_EPIC_CHILD },
      select: { taskId: true, title: true },
      orderBy: { createdAt: 'asc' },
    });
    const plc = await buildPromptLogContext(context);
    const result = await aiGenerateTaskInstructions(
      apiKey,
      task.title,
      task.description ?? '',
      project.name,
      siblings.map((s: { title: string }) => s.title),
      project.knowledgeBase,
      plc
    );
    const titleToId = new Map(siblings.map((s: { title: string; taskId: string }) => [s.title, s.taskId]));
    const resolvedDeps = result.dependsOn
      .map((title) => titleToId.get(title))
      .filter((id): id is string => id !== undefined);
    await context.prisma.task.deleteMany({ where: { parentTaskId: task.taskId } });
    if (result.tasks.length > 0) {
      await context.prisma.task.createMany({
        data: result.tasks.map((ct) => ({
          title: ct.title,
          description: ct.description,
          instructions: ct.instructions || null,
          estimatedHours: ct.estimatedHours ?? null,
          priority: ct.priority ?? 'medium',
          acceptanceCriteria: ct.acceptanceCriteria || null,
          suggestedTools: ct.suggestedTools ? JSON.stringify(ct.suggestedTools) : null,
          status: 'todo',
          taskType: 'task',
          projectId: task.projectId,
          parentTaskId: task.taskId,
          orgId: user.orgId,
        })),
      });
    }
    // Create TaskDependency records for resolved dependencies
    if (resolvedDeps.length > 0) {
      await Promise.all(
        resolvedDeps.map((depId) =>
          context.prisma.taskDependency.create({
            data: { sourceTaskId: depId, targetTaskId: args.taskId, linkType: 'blocks' },
          }).catch(() => { /* ignore duplicate constraint violations */ })
        )
      );
    }
    return context.prisma.task.update({
      where: { taskId: args.taskId },
      data: {
        instructions: result.instructions,
        suggestedTools: JSON.stringify(result.suggestedTools),
        estimatedHours: result.estimatedHours,
        priority: result.priority,
      },
    });
  },

  reviewPullRequest: async (
    _parent: unknown,
    args: { taskId: string; prNumber: number },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
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

    // Extract changed file paths from the diff for repo context
    let relevantFiles: RelevantFile[] | undefined;
    const repo = await getProjectRepo(task.projectId);
    if (repo) {
      const changedPaths = [...diff.matchAll(/^diff --git a\/(.+?) b\//gm)].map((m) => m[1]);
      if (changedPaths.length > 0) {
        const repoContext = await resolveReviewContext(repo, changedPaths, 10_000).catch(() => null);
        relevantFiles = repoContext?.relevantFiles;
      }
    }

    const plc = await buildPromptLogContext(context);
    return aiReviewCode(apiKey, {
      taskTitle: task.title,
      taskDescription: task.description ?? '',
      taskInstructions: task.instructions ?? undefined,
      acceptanceCriteria: (task as Record<string, unknown>).acceptanceCriteria as string | undefined,
      diff,
      projectName: project.name,
      repoContext: relevantFiles,
    }, plc);
  },

  parseBugReport: async (
    _parent: unknown,
    args: { projectId: string; bugReport: string },
    context: Context
  ) => {
    const { user, project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
    if (!args.bugReport.trim()) {
      throw new ValidationError('Bug report text is required');
    }
    const plc = await buildPromptLogContext(context);
    const result = await aiParseBugReport(apiKey, {
      bugReport: args.bugReport,
      projectName: project.name,
      projectDescription: project.description,
    }, plc);
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
    await enforceBudget(context);
    if (!args.prd.trim()) {
      throw new ValidationError('PRD text is required');
    }
    const plc = await buildPromptLogContext(context);
    return aiBreakdownPRD(apiKey, {
      prd: args.prd,
      projectName: project.name,
      projectDescription: project.description,
    }, plc);
  },

  commitPRDBreakdown: async (
    _parent: unknown,
    args: { projectId: string; epics: string },
    context: Context
  ) => {
    const { user } = await requireProject(context, args.projectId);
    let epics: Array<{ title: string; description: string; tasks: Array<{ title: string; description: string; priority: string; estimatedHours?: number; acceptanceCriteria?: string }> }>;
    try {
      const parsed = JSON.parse(args.epics);
      const result = EpicsInputSchema.safeParse(parsed);
      if (!result.success) {
        throw new ValidationError(`Invalid epics structure: ${result.error.message}`);
      }
      epics = result.data;
    } catch (err) {
      if (err instanceof ValidationError) throw err;
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
    // Return only non-epic tasks (epics shown in dedicated Epics view)
    return allCreated.filter((t) => t.taskType !== 'epic');
  },

  bootstrapProjectFromRepo: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context
  ) => {
    const { user, project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
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

    const plc = await buildPromptLogContext(context);
    const result = await aiBootstrapFromRepo(apiKey, {
      repoName: `${repo.repositoryOwner}/${repo.repositoryName}`,
      repoDescription: project.description,
      readme,
      packageJson,
      fileTree: fileTree.map((f) => ({ path: f.path, language: f.language, size: f.size })),
      languages: [...languageSet],
    }, plc);

    // Update project description and knowledge base (repo profile)
    const projectUpdates: Record<string, string> = {};
    if (!project.description && result.projectDescription) {
      projectUpdates.description = result.projectDescription;
    }
    if (result.repoProfile) {
      projectUpdates.knowledgeBase = result.repoProfile;
    }
    if (Object.keys(projectUpdates).length > 0) {
      await context.prisma.project.update({
        where: { projectId: args.projectId },
        data: projectUpdates,
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

  refreshRepoProfile: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const { project: _project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
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

    const plc = await buildPromptLogContext(context);
    const profile = await aiGenerateRepoProfile(apiKey, {
      repoName: `${repo.repositoryOwner}/${repo.repositoryName}`,
      readme,
      packageJson,
      fileTree: fileTree.map((f) => ({ path: f.path, language: f.language, size: f.size })),
      languages: [...languageSet],
    }, plc);

    return context.prisma.project.update({
      where: { projectId: args.projectId },
      data: { knowledgeBase: profile },
    });
  },

  summarizeProject: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
    const project = await context.loaders.projectById.load(args.projectId);
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }
    const tasks = await context.prisma.task.findMany({
      where: { projectId: args.projectId, taskType: { not: 'epic' }, ...ROOT_OR_EPIC_CHILD },
      select: { title: true, status: true },
      orderBy: { createdAt: 'asc' },
    });
    if (tasks.length === 0) {
      throw new ValidationError('No tasks to summarize. Generate a task plan first.');
    }
    const plc = await buildPromptLogContext(context);
    return aiSummarizeProject(apiKey, project.name, project.description ?? '', tasks, plc);
  },

  generateOnboardingQuestions: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context
  ) => {
    const { project } = await requireProject(context, args.projectId);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
    const existingEntries = await context.prisma.knowledgeEntry.findMany({
      where: { projectId: args.projectId },
      select: { title: true },
    });
    const existingTopics = existingEntries.map((e: { title: string }) => e.title);
    const plc = await buildPromptLogContext(context);
    const result = await aiGenerateOnboardingQuestions(
      apiKey,
      project.name,
      project.description ?? '',
      existingTopics,
      plc
    );
    return result.questions;
  },

  saveOnboardingAnswers: async (
    _parent: unknown,
    args: { projectId: string; answers: Array<{ question: string; answer: string; category: string }> },
    context: Context
  ) => {
    const { user } = await requireProject(context, args.projectId);
    if (args.answers.length === 0) {
      throw new ValidationError('At least one answer is required');
    }
    const entries = await Promise.all(
      args.answers.map((a) =>
        context.prisma.knowledgeEntry.create({
          data: {
            projectId: args.projectId,
            orgId: user.orgId,
            title: a.question.slice(0, 80),
            content: `Q: ${a.question}\nA: ${a.answer}`,
            source: 'onboarding',
            category: a.category,
          },
        })
      )
    );
    return entries;
  },
};
