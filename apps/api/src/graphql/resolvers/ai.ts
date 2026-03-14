import type { Context } from '../context.js';
import {
  generateProjectOptions as aiGenerateProjectOptions,
  generateTaskPlan as aiGenerateTaskPlan,
  expandTask as aiExpandTask,
  generateTaskInstructions as aiGenerateTaskInstructions,
  summarizeProject as aiSummarizeProject,
} from '../../ai/index.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg, requireApiKey } from './auth.js';

// ── AI mutations ──

export const aiMutations = {
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
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }
    await context.prisma.task.deleteMany({
      where: { projectId: args.projectId, parentTaskId: null },
    });
    const taskPlans = await aiGenerateTaskPlan(
      apiKey,
      project.name,
      project.description ?? '',
      project.prompt ?? '',
      args.context
    );
    return Promise.all(
      taskPlans.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            instructions: t.instructions,
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
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }
    let fullContext = args.context ?? undefined;
    if (args.appendToTitles && args.appendToTitles.length > 0) {
      const existing = args.appendToTitles.map((t) => `"${t}"`).join(', ');
      fullContext = `These tasks already exist: ${existing}. Generate ONLY additional tasks not already in this list.${args.context ? ` Additional context: ${args.context}` : ''}`;
    }
    const taskPlans = await aiGenerateTaskPlan(
      apiKey,
      project.name,
      project.description ?? '',
      project.prompt ?? '',
      fullContext
    );
    return taskPlans.map((t) => ({
      title: t.title,
      description: t.description,
      instructions: t.instructions,
      suggestedTools: JSON.stringify(t.suggestedTools),
      estimatedHours: t.estimatedHours ?? null,
      priority: t.priority ?? 'medium',
      dependsOn: t.dependsOn ?? [],
      subtasks: t.subtasks ?? [],
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
      }>;
      clearExisting?: boolean | null;
    },
    context: Context
  ) => {
    const user = requireOrg(context);
    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
    if (!project || project.orgId !== user.orgId) {
      throw new NotFoundError('Project not found');
    }

    if (args.clearExisting) {
      await context.prisma.task.deleteMany({
        where: { projectId: args.projectId, parentTaskId: { not: null } },
      });
      await context.prisma.task.deleteMany({
        where: { projectId: args.projectId, parentTaskId: null },
      });
    }

    const created = await Promise.all(
      args.tasks.map((t) =>
        context.prisma.task.create({
          data: {
            title: t.title,
            description: t.description,
            instructions: t.instructions,
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
    const task = await context.prisma.task.findUnique({
      where: { taskId: args.taskId },
      include: { project: true },
    });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    await context.prisma.task.deleteMany({ where: { parentTaskId: args.taskId } });
    const subtaskPlans = await aiExpandTask(
      apiKey,
      task.title,
      task.description ?? '',
      task.project.name,
      args.context
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
    const task = await context.prisma.task.findUnique({
      where: { taskId: args.taskId },
      include: { project: true },
    });
    if (!task || task.orgId !== user.orgId) {
      throw new NotFoundError('Task not found');
    }
    const siblings = await context.prisma.task.findMany({
      where: { projectId: task.projectId, parentTaskId: null, NOT: { taskId: task.taskId } },
      select: { taskId: true, title: true },
      orderBy: { createdAt: 'asc' },
    });
    const result = await aiGenerateTaskInstructions(
      apiKey,
      task.title,
      task.description ?? '',
      task.project.name,
      siblings.map((s: { title: string }) => s.title)
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

  summarizeProject: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const user = requireOrg(context);
    const apiKey = requireApiKey(context);
    const project = await context.prisma.project.findUnique({
      where: { projectId: args.projectId },
    });
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
