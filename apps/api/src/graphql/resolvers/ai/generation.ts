import type { Context } from '../../context.js';
import {
  generateTaskPlan as aiGenerateTaskPlan,
  expandTask as aiExpandTask,
  generateTaskInstructions as aiGenerateTaskInstructions,
  summarizeProject as aiSummarizeProject,
  reviewCode as aiReviewCode,
  parseBugReport as aiParseBugReport,
  breakdownPRD as aiBreakdownPRD,
  bootstrapFromRepo as aiBootstrapFromRepo,
  generateRepoProfile as aiGenerateRepoProfile,

  generateHierarchicalPlan as aiGenerateHierarchicalPlan,
  generateManualTaskSpec as aiGenerateManualTaskSpec,
} from '../../../ai/index.js';
import { NotFoundError, ValidationError } from '../../errors.js';
import { requireOrg, requireApiKey } from '../auth.js';
import { requirePermission, Permission } from '../../../auth/permissions.js';
import { buildPromptLogContext, enforceBudget, ROOT_OR_EPIC_CHILD } from './helpers.js';
import { batchDetectCycles } from '../../../utils/cyclicDependencyCheck.js';
import { getProjectRepo, fetchProjectFileTree, fetchFileContent, getPullRequestDiff, resolveReviewContext } from '../../../github/index.js';
import type { RelevantFile } from '../../../github/index.js';
import { requireProject, sanitizeForPrompt } from '../../../utils/resolverHelpers.js';
import { EpicsInputSchema } from '../../../utils/zodSchemas.js';
import { retrieveRelevantKnowledge } from '../../../ai/knowledgeRetrieval.js';

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

  // generateProjectOptions moved to resolvers/project.ts (uses single-recommendation prompt)

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

  commitHierarchicalPlan: async (
    _parent: unknown,
    args: {
      projectId: string;
      epics: Array<{
        title: string;
        description: string;
        instructions?: string | null;
        estimatedHours?: number | null;
        priority?: string | null;
        acceptanceCriteria?: string | null;
        autoComplete?: boolean | null;
        dependsOn?: Array<{ title: string; linkType: string }> | null;
        tasks?: Array<{
          title: string;
          description: string;
          instructions?: string | null;
          estimatedHours?: number | null;
          priority?: string | null;
          acceptanceCriteria?: string | null;
          autoComplete?: boolean | null;
          dependsOn?: Array<{ title: string; linkType: string }> | null;
          subtasks?: Array<{
            title: string;
            description: string;
            estimatedHours?: number | null;
            priority?: string | null;
            acceptanceCriteria?: string | null;
          }> | null;
        }> | null;
      }>;
      clearExisting?: boolean | null;
    },
    context: Context
  ) => {
    const { user } = await requireProject(context, args.projectId);
    await requirePermission(context, args.projectId, Permission.CREATE_TASKS);

    return context.prisma.$transaction(async (tx) => {
      // Clear existing hierarchy if requested
      if (args.clearExisting) {
        // Delete subtasks first (tasks whose parent is also a child task)
        await tx.task.deleteMany({
          where: {
            projectId: args.projectId,
            parentTaskId: { not: null },
            parentTask: { parentTaskId: { not: null } },
          },
        });
        // Delete tasks (children of epics)
        await tx.task.deleteMany({
          where: { projectId: args.projectId, parentTaskId: { not: null } },
        });
        // Delete epics (root tasks)
        await tx.task.deleteMany({
          where: { projectId: args.projectId, parentTaskId: null },
        });
      }

      // Calculate starting position
      const lastTask = await tx.task.findFirst({
        where: { projectId: args.projectId, parentTaskId: null },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      let nextPosition = (lastTask?.position ?? 0) + 1.0;

      // Title → taskId map for dependency resolution
      const titleToId = new Map<string, string>();
      // Collect all created tasks
      const allCreated: Array<{ taskId: string }> = [];
      // Collect nodes with dependsOn for resolution
      const nodesWithDeps: Array<{
        taskId: string;
        dependsOn: Array<{ title: string; linkType: string }>;
      }> = [];

      // Create epics
      for (const epicInput of args.epics) {
        const epic = await tx.task.create({
          data: {
            title: epicInput.title,
            description: epicInput.description,
            instructions: epicInput.instructions || null,
            estimatedHours: epicInput.estimatedHours ?? null,
            priority: epicInput.priority ?? 'medium',
            acceptanceCriteria: epicInput.acceptanceCriteria || null,
            autoComplete: epicInput.autoComplete ?? false,
            status: 'todo',
            taskType: 'epic',
            position: nextPosition,
            projectId: args.projectId,
            orgId: user.orgId,
          },
        });
        nextPosition += 1.0;
        titleToId.set(epicInput.title, epic.taskId);
        allCreated.push(epic);

        if (epicInput.dependsOn && epicInput.dependsOn.length > 0) {
          nodesWithDeps.push({ taskId: epic.taskId, dependsOn: epicInput.dependsOn });
        }

        // Create tasks under this epic
        let taskPosition = 1.0;
        for (const taskInput of epicInput.tasks ?? []) {
          const task = await tx.task.create({
            data: {
              title: taskInput.title,
              description: taskInput.description,
              instructions: taskInput.instructions || null,
              estimatedHours: taskInput.estimatedHours ?? null,
              priority: taskInput.priority ?? 'medium',
              acceptanceCriteria: taskInput.acceptanceCriteria || null,
              autoComplete: taskInput.autoComplete ?? false,
              status: 'todo',
              taskType: 'task',
              position: taskPosition,
              parentTaskId: epic.taskId,
              projectId: args.projectId,
              orgId: user.orgId,
            },
          });
          taskPosition += 1.0;
          titleToId.set(taskInput.title, task.taskId);
          allCreated.push(task);

          if (taskInput.dependsOn && taskInput.dependsOn.length > 0) {
            nodesWithDeps.push({ taskId: task.taskId, dependsOn: taskInput.dependsOn });
          }

          // Create subtasks under this task
          let subtaskPosition = 1.0;
          for (const subtaskInput of taskInput.subtasks ?? []) {
            const subtask = await tx.task.create({
              data: {
                title: subtaskInput.title,
                description: subtaskInput.description,
                estimatedHours: subtaskInput.estimatedHours ?? null,
                priority: subtaskInput.priority ?? 'medium',
                acceptanceCriteria: subtaskInput.acceptanceCriteria || null,
                status: 'todo',
                taskType: 'task',
                position: subtaskPosition,
                parentTaskId: task.taskId,
                projectId: args.projectId,
                orgId: user.orgId,
              },
            });
            subtaskPosition += 1.0;
            titleToId.set(subtaskInput.title, subtask.taskId);
            allCreated.push(subtask);
          }
        }
      }

      // Resolve dependencies and build proposed edges
      const proposedEdges: Array<{ sourceTaskId: string; targetTaskId: string; linkType: string }> = [];
      for (const node of nodesWithDeps) {
        for (const dep of node.dependsOn) {
          const targetId = titleToId.get(dep.title);
          if (!targetId) continue; // Skip unresolvable references
          proposedEdges.push({
            sourceTaskId: targetId,
            targetTaskId: node.taskId,
            linkType: dep.linkType === 'informs' ? 'informs' : 'blocks',
          });
        }
      }

      // Batch cycle check
      if (proposedEdges.length > 0) {
        const violations = await batchDetectCycles(
          tx as unknown as Parameters<typeof batchDetectCycles>[0],
          proposedEdges
        );
        if (violations.length > 0) {
          const details = violations.map((v) => v.error).join('; ');
          throw new ValidationError(`Cycle detected in dependencies: ${details}`);
        }

        // Create TaskDependency records (ignore duplicates gracefully)
        for (const edge of proposedEdges) {
          await tx.taskDependency.create({
            data: {
              sourceTaskId: edge.sourceTaskId,
              targetTaskId: edge.targetTaskId,
              linkType: edge.linkType,
            },
          }).catch(() => {});
        }
      }

      // Return all created tasks
      return tx.task.findMany({
        where: { taskId: { in: allCreated.map((t) => t.taskId) } },
        orderBy: { createdAt: 'asc' },
      });
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
    await requirePermission(context, task.projectId, Permission.EDIT_TASKS);
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
      acceptanceCriteria: task.acceptanceCriteria ?? undefined,
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
    const { user, project: _project } = await requireProject(context, args.projectId);
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

    // Store as KnowledgeEntry (primary) — upsert by finding existing auto-generated profile
    const existingEntry = await context.prisma.knowledgeEntry.findFirst({
      where: {
        projectId: args.projectId,
        source: 'learned',
        title: 'Repository Profile (auto-generated)',
      },
    });
    if (existingEntry) {
      await context.prisma.knowledgeEntry.update({
        where: { knowledgeEntryId: existingEntry.knowledgeEntryId },
        data: { content: profile },
      });
    } else {
      await context.prisma.knowledgeEntry.create({
        data: {
          projectId: args.projectId,
          orgId: user.orgId,
          title: 'Repository Profile (auto-generated)',
          content: profile,
          source: 'learned',
          category: 'standard',
        },
      });
    }

    // Still update legacy field for backward compat
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

  generateManualTaskSpec: async (
    _parent: unknown,
    args: { taskId: string },
    context: Context
  ) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    await enforceBudget(context);
    const task = await context.loaders.taskById.load(args.taskId);
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    await requirePermission(context, task.projectId, Permission.EDIT_TASKS);
    const project = await context.loaders.projectById.load(task.projectId);
    if (!project) throw new NotFoundError('Project not found');

    // Retrieve relevant knowledge base entries
    const taskContext = `${task.title}: ${task.description ?? ''}`;
    let knowledgeBase: string | null = null;
    try {
      knowledgeBase = await retrieveRelevantKnowledge(context.prisma, task.projectId, taskContext, apiKey);
    } catch {
      knowledgeBase = project.knowledgeBase ?? null;
    }

    // Load repo file tree if GitHub connected
    let repoFiles: Array<{ path: string; language: string }> | undefined;
    const repo = await getProjectRepo(task.projectId);
    if (repo) {
      const fileTree = await fetchProjectFileTree(repo).catch(() => []);
      repoFiles = fileTree
        .filter((f: { language?: string | null }) => f.language)
        .map((f: { path: string; language?: string | null }) => ({ path: f.path, language: f.language! }));
    }

    const plc = await buildPromptLogContext(context);
    return aiGenerateManualTaskSpec(
      apiKey,
      task.title,
      task.description ?? '',
      task.instructions ?? '',
      project.name,
      project.description ?? '',
      knowledgeBase,
      repoFiles,
      task.acceptanceCriteria ?? undefined,
      plc
    );
  },
};

export const generationQueries = {
  previewHierarchicalPlan: async (
    _parent: unknown,
    args: { projectId: string; prompt: string },
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

    // Retrieve relevant knowledge base entries
    const taskContext = `${project.name}: ${args.prompt}`;
    let knowledgeBase: string | null = null;
    try {
      knowledgeBase = await retrieveRelevantKnowledge(context.prisma, args.projectId, taskContext, apiKey);
    } catch {
      // Fall back to project-level knowledge base
      knowledgeBase = project.knowledgeBase ?? null;
    }

    const plc = await buildPromptLogContext(context);
    return aiGenerateHierarchicalPlan(
      apiKey,
      project.name,
      project.description ?? '',
      args.prompt,
      knowledgeBase,
      existingTitles,
      plc
    );
  },
};
