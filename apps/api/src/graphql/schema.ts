import { createSchema } from 'graphql-yoga';
import { GraphQLError } from 'graphql';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { JWT_SECRET, type Context } from './context.js';
import { encryptApiKey, decryptApiKey } from '../utils/encryption.js';
import {
  generateProjectOptions as aiGenerateProjectOptions,
  generateTaskPlan as aiGenerateTaskPlan,
  expandTask as aiExpandTask,
  generateTaskInstructions as aiGenerateTaskInstructions,
  summarizeProject as aiSummarizeProject,
  planSprints as aiPlanSprints,
} from './ai.js';

function requireAuth(context: Context) {
  if (!context.user) {
    throw new GraphQLError('Not authenticated', { extensions: { code: 'UNAUTHENTICATED' } });
  }
  return context.user;
}

function requireOrg(context: Context) {
  const user = requireAuth(context);
  if (!user.orgId) {
    throw new GraphQLError('No organization; create one first', { extensions: { code: 'FORBIDDEN' } });
  }
  return user as typeof user & { orgId: string };
}

async function requireProjectAccess(context: Context, projectId: string) {
  const user = requireOrg(context);
  const project = await context.prisma.project.findFirst({
    where: { projectId, orgId: user.orgId },
  });
  if (!project) {
    throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
  }
  return { user, project };
}

function requireApiKey(context: Context): string {
  requireOrg(context);
  const encrypted = context.org?.anthropicApiKeyEncrypted;
  if (!encrypted) {
    throw new GraphQLError('No Anthropic API key configured. Add one in Settings.', {
      extensions: { code: 'API_KEY_MISSING' },
    });
  }
  try {
    return decryptApiKey(encrypted);
  } catch {
    throw new GraphQLError('Failed to decrypt API key. Re-enter your key in Settings.', {
      extensions: { code: 'API_KEY_DECRYPT_FAILED' },
    });
  }
}

export const schema = createSchema<Context>({
  typeDefs: /* GraphQL */ `
    type User {
      userId: ID!
      email: String!
      orgId: ID
      role: String
    }

    type Org {
      orgId: ID!
      name: String!
      createdAt: String!
      hasApiKey: Boolean!
      apiKeyHint: String
    }

    type Project {
      projectId: ID!
      name: String!
      description: String
      prompt: String
      createdAt: String!
      orgId: ID!
    }

    type Task {
      taskId: ID!
      title: String!
      description: String
      instructions: String
      suggestedTools: String
      estimatedHours: Float
      priority: String!
      dependsOn: String
      status: TaskStatus!
      projectId: ID!
      parentTaskId: ID
      createdAt: String!
      sprintId: ID
      sprintColumn: String
      assigneeId: ID
      archived: Boolean!
    }

    type Sprint {
      sprintId:  ID!
      projectId: ID!
      name:      String!
      isActive:  Boolean!
      columns:   String!
      startDate: String
      endDate:   String
      createdAt: String!
      closedAt:  String
    }

    type OrgUser {
      userId: ID!
      email:  String!
      role:   String
    }

    type ProjectOption {
      title: String!
      description: String!
    }

    type SubtaskPreview {
      title: String!
      description: String!
    }

    type TaskPlanPreview {
      title: String!
      description: String!
      instructions: String!
      suggestedTools: String!
      estimatedHours: Float
      priority: String!
      dependsOn: [String!]!
      subtasks: [SubtaskPreview!]!
    }

    type SprintPlanItem {
      name:       String!
      taskIds:    [ID!]!
      totalHours: Float!
    }

    input IncompleteTaskAction {
      taskId:         ID!
      action:         String!
      targetSprintId: ID
    }

    type CloseSprintResult {
      sprint:     Sprint!
      nextSprint: Sprint
    }

    input SprintPlanInput {
      name:    String!
      taskIds: [ID!]!
    }

    input SubtaskInput {
      title: String!
      description: String!
    }

    input CommitTaskInput {
      title: String!
      description: String!
      instructions: String!
      suggestedTools: String!
      estimatedHours: Float
      priority: String
      dependsOn: [String!]!
      subtasks: [SubtaskInput!]!
    }

    enum TaskStatus {
      todo
      in_progress
      done
    }

    type AuthPayload {
      token: String!
    }

    type Query {
      me: User
      org: Org
      projects: [Project!]!
      project(projectId: ID!): Project
      tasks(projectId: ID!, parentTaskId: ID): [Task!]!
      sprints(projectId: ID!): [Sprint!]!
      orgUsers: [OrgUser!]!
    }

    type Mutation {
      signup(email: String!, password: String!): Boolean!
      login(email: String!, password: String!): AuthPayload!
      createOrg(name: String!, apiKey: String): Org!
      setOrgApiKey(apiKey: String!): Org!
      createProject(name: String!): Project!
      createTask(projectId: ID!, title: String!, status: TaskStatus): Task!
      updateTask(taskId: ID!, title: String, status: TaskStatus, sprintId: ID, sprintColumn: String, assigneeId: ID): Task!

      createSprint(projectId: ID!, name: String!, columns: String, startDate: String, endDate: String): Sprint!
      updateSprint(sprintId: ID!, name: String, columns: String, isActive: Boolean, startDate: String, endDate: String): Sprint!
      deleteSprint(sprintId: ID!): Boolean!
      closeSprint(sprintId: ID!, incompleteTaskActions: [IncompleteTaskAction!]!): CloseSprintResult!

      previewSprintPlan(projectId: ID!, sprintLengthWeeks: Int!, teamSize: Int!): [SprintPlanItem!]!
      commitSprintPlan(projectId: ID!, sprints: [SprintPlanInput!]!): [Sprint!]!

      generateProjectOptions(prompt: String!): [ProjectOption!]!
      createProjectFromOption(prompt: String!, title: String!, description: String!): Project!
      generateTaskPlan(projectId: ID!, context: String): [Task!]!
      previewTaskPlan(projectId: ID!, context: String, appendToTitles: [String!]): [TaskPlanPreview!]!
      commitTaskPlan(projectId: ID!, tasks: [CommitTaskInput!]!, clearExisting: Boolean): [Task!]!
      expandTask(taskId: ID!, context: String): [Task!]!
      generateTaskInstructions(taskId: ID!): Task!
      summarizeProject(projectId: ID!): String!
    }
  `,
  resolvers: {
    Org: {
      hasApiKey: (parent: { anthropicApiKeyEncrypted?: string | null }) => !!parent.anthropicApiKeyEncrypted,
      apiKeyHint: (_parent: { anthropicApiKeyEncrypted?: string | null }) => null,
    },

    Sprint: {
      closedAt: (parent: { closedAt: Date | null }) =>
        parent.closedAt ? parent.closedAt.toISOString() : null,
    },

    Query: {
      me: (_parent, _args, context) => {
        return context.user;
      },

      org: (_parent, _args, context) => {
        requireOrg(context);
        return context.org;
      },

      projects: async (_parent, _args, context) => {
        const user = requireOrg(context);
        return context.prisma.project.findMany({
          where: { orgId: user.orgId },
          orderBy: { createdAt: 'desc' },
        });
      },

      project: async (_parent, args: { projectId: string }, context) => {
        try {
          const { project } = await requireProjectAccess(context, args.projectId);
          return project;
        } catch {
          return null;
        }
      },

      sprints: async (_parent, args: { projectId: string }, context) => {
        const { user } = await requireProjectAccess(context, args.projectId);
        return context.prisma.sprint.findMany({
          where: { projectId: args.projectId, orgId: user.orgId },
          orderBy: { createdAt: 'asc' },
        });
      },

      orgUsers: async (_parent, _args, context) => {
        const user = requireOrg(context);
        return context.prisma.user.findMany({
          where: { orgId: user.orgId },
          select: { userId: true, email: true, role: true },
        });
      },

      tasks: async (_parent, args: { projectId: string; parentTaskId?: string | null }, context) => {
        await requireProjectAccess(context, args.projectId);
        return context.prisma.task.findMany({
          where: {
            projectId: args.projectId,
            parentTaskId: args.parentTaskId !== undefined ? args.parentTaskId : null,
          },
          orderBy: { createdAt: 'asc' },
        });
      },
    },

    Mutation: {
      signup: async (_parent, args: { email: string; password: string }, context) => {
        const existing = await context.prisma.user.findUnique({ where: { email: args.email } });
        if (existing) throw new GraphQLError('Email already in use');
        const passwordHash = await bcrypt.hash(args.password, 10);
        await context.prisma.user.create({ data: { email: args.email, passwordHash } });
        return true;
      },

      login: async (_parent, args: { email: string; password: string }, context) => {
        const user = await context.prisma.user.findUnique({ where: { email: args.email } });
        if (!user) throw new GraphQLError('Invalid email or password');
        const valid = await bcrypt.compare(args.password, user.passwordHash);
        if (!valid) throw new GraphQLError('Invalid email or password');
        const token = await new SignJWT({ sub: user.userId, email: user.email })
          .setProtectedHeader({ alg: 'HS256' })
          .setExpirationTime('7d')
          .sign(JWT_SECRET);
        return { token };
      },

      createOrg: async (_parent, args: { name: string; apiKey?: string | null }, context) => {
        const user = requireAuth(context);
        const org = await context.prisma.org.create({
          data: {
            name: args.name,
            ...(args.apiKey ? { anthropicApiKeyEncrypted: encryptApiKey(args.apiKey) } : {}),
          },
        });
        await context.prisma.user.update({
          where: { userId: user.userId },
          data: { orgId: org.orgId, role: 'org:admin' },
        });
        return org;
      },

      setOrgApiKey: async (_parent, args: { apiKey: string }, context) => {
        const user = requireOrg(context);
        if (user.role !== 'org:admin') {
          throw new GraphQLError('Admin role required', { extensions: { code: 'FORBIDDEN' } });
        }
        return context.prisma.org.update({
          where: { orgId: user.orgId },
          data: { anthropicApiKeyEncrypted: encryptApiKey(args.apiKey) },
        });
      },

      createProject: async (_parent, args: { name: string }, context) => {
        const user = requireOrg(context);
        if (user.role !== 'org:admin') {
          throw new GraphQLError('Admin role required', { extensions: { code: 'FORBIDDEN' } });
        }
        return context.prisma.project.create({
          data: { name: args.name, orgId: user.orgId },
        });
      },

      createTask: async (
        _parent,
        args: { projectId: string; title: string; status?: string },
        context
      ) => {
        const user = requireOrg(context);
        const project = await context.prisma.project.findUnique({
          where: { projectId: args.projectId },
        });
        if (!project || project.orgId !== user.orgId) {
          throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
        }
        return context.prisma.task.create({
          data: {
            title: args.title,
            status: args.status ?? 'todo',
            projectId: args.projectId,
            orgId: user.orgId,
          },
        });
      },

      updateTask: async (
        _parent,
        args: { taskId: string; title?: string; status?: string; sprintId?: string | null; sprintColumn?: string | null; assigneeId?: string | null },
        context
      ) => {
        const user = requireOrg(context);
        const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
        if (!task || task.orgId !== user.orgId) {
          throw new GraphQLError('Task not found', { extensions: { code: 'NOT_FOUND' } });
        }
        return context.prisma.task.update({
          where: { taskId: args.taskId },
          data: {
            ...(args.title !== undefined ? { title: args.title } : {}),
            ...(args.status !== undefined ? { status: args.status } : {}),
            ...(args.sprintId !== undefined ? { sprintId: args.sprintId } : {}),
            ...(args.sprintColumn !== undefined ? { sprintColumn: args.sprintColumn } : {}),
            ...(args.assigneeId !== undefined ? { assigneeId: args.assigneeId } : {}),
          },
        });
      },

      createSprint: async (_parent, args: { projectId: string; name: string; columns?: string | null; startDate?: string | null; endDate?: string | null }, context) => {
        const user = requireOrg(context);
        const project = await context.prisma.project.findUnique({ where: { projectId: args.projectId } });
        if (!project || project.orgId !== user.orgId) {
          throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
        }
        return context.prisma.sprint.create({
          data: {
            name: args.name,
            projectId: args.projectId,
            orgId: user.orgId,
            columns: args.columns ?? '["To Do","In Progress","Done"]',
            startDate: args.startDate ?? null,
            endDate: args.endDate ?? null,
          },
        });
      },

      updateSprint: async (_parent, args: { sprintId: string; name?: string | null; columns?: string | null; isActive?: boolean | null; startDate?: string | null; endDate?: string | null }, context) => {
        const user = requireOrg(context);
        const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
        if (!sprint || sprint.orgId !== user.orgId) {
          throw new GraphQLError('Sprint not found', { extensions: { code: 'NOT_FOUND' } });
        }
        if (args.isActive === true) {
          await context.prisma.sprint.updateMany({
            where: { projectId: sprint.projectId },
            data: { isActive: false },
          });
        }
        return context.prisma.sprint.update({
          where: { sprintId: args.sprintId },
          data: {
            ...(args.name !== undefined && args.name !== null ? { name: args.name } : {}),
            ...(args.columns !== undefined && args.columns !== null ? { columns: args.columns } : {}),
            ...(args.isActive !== undefined && args.isActive !== null ? { isActive: args.isActive } : {}),
            ...(args.startDate !== undefined ? { startDate: args.startDate } : {}),
            ...(args.endDate !== undefined ? { endDate: args.endDate } : {}),
          },
        });
      },

      deleteSprint: async (_parent, args: { sprintId: string }, context) => {
        const user = requireOrg(context);
        const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
        if (!sprint || sprint.orgId !== user.orgId) {
          throw new GraphQLError('Sprint not found', { extensions: { code: 'NOT_FOUND' } });
        }
        await context.prisma.task.updateMany({
          where: { sprintId: args.sprintId },
          data: { sprintId: null, sprintColumn: null },
        });
        await context.prisma.sprint.delete({ where: { sprintId: args.sprintId } });
        return true;
      },

      closeSprint: async (
        _parent,
        args: {
          sprintId: string;
          incompleteTaskActions: Array<{ taskId: string; action: string; targetSprintId?: string | null }>;
        },
        context
      ) => {
        const user = requireOrg(context);
        const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
        if (!sprint || sprint.orgId !== user.orgId) {
          throw new GraphQLError('Sprint not found', { extensions: { code: 'NOT_FOUND' } });
        }

        for (const item of args.incompleteTaskActions) {
          const task = await context.prisma.task.findUnique({ where: { taskId: item.taskId } });
          if (!task || task.orgId !== user.orgId) continue;

          if (item.action === 'backlog') {
            await context.prisma.task.update({
              where: { taskId: item.taskId },
              data: { sprintId: null, sprintColumn: null },
            });
          } else if (item.action === 'sprint' && item.targetSprintId) {
            const target = await context.prisma.sprint.findUnique({ where: { sprintId: item.targetSprintId } });
            if (target && target.orgId === user.orgId) {
              const cols = JSON.parse(target.columns) as string[];
              await context.prisma.task.update({
                where: { taskId: item.taskId },
                data: { sprintId: item.targetSprintId, sprintColumn: cols[0] ?? 'To Do' },
              });
            }
          } else if (item.action === 'archive') {
            await context.prisma.task.update({
              where: { taskId: item.taskId },
              data: { archived: true, sprintId: null, sprintColumn: null },
            });
          }
        }

        const closedSprint = await context.prisma.sprint.update({
          where: { sprintId: args.sprintId },
          data: { isActive: false, closedAt: new Date() },
        });

        const nextSprint = await context.prisma.sprint.findFirst({
          where: {
            projectId: sprint.projectId,
            closedAt: null,
            sprintId: { not: args.sprintId },
          },
          orderBy: { createdAt: 'asc' },
        });

        return { sprint: closedSprint, nextSprint: nextSprint ?? null };
      },

      previewSprintPlan: async (
        _parent,
        args: { projectId: string; sprintLengthWeeks: number; teamSize: number },
        context
      ) => {
        const user = requireOrg(context);
        const apiKey = requireApiKey(context);
        const project = await context.prisma.project.findUnique({ where: { projectId: args.projectId } });
        if (!project || project.orgId !== user.orgId) {
          throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
        }
        const backlogTasks = await context.prisma.task.findMany({
          where: { projectId: args.projectId, parentTaskId: null, sprintId: null },
          orderBy: { createdAt: 'asc' },
        });
        if (backlogTasks.length === 0) {
          throw new GraphQLError('No backlog tasks to plan. All tasks are already assigned to sprints.', {
            extensions: { code: 'NO_BACKLOG_TASKS' },
          });
        }
        const plans = await aiPlanSprints(
          apiKey,
          project.name,
          backlogTasks.map((t) => ({
            title: t.title,
            estimatedHours: t.estimatedHours,
            priority: t.priority,
            dependsOn: t.dependsOn,
          })),
          args.sprintLengthWeeks,
          args.teamSize
        );
        return plans.map((p) => ({
          name: p.name,
          taskIds: p.taskIndices
            .filter((i) => i >= 0 && i < backlogTasks.length)
            .map((i) => backlogTasks[i].taskId),
          totalHours: p.totalHours,
        }));
      },

      commitSprintPlan: async (
        _parent,
        args: { projectId: string; sprints: Array<{ name: string; taskIds: string[] }> },
        context
      ) => {
        const user = requireOrg(context);
        const project = await context.prisma.project.findUnique({ where: { projectId: args.projectId } });
        if (!project || project.orgId !== user.orgId) {
          throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
        }
        const defaultColumns = '["To Do","In Progress","Done"]';
        const firstColumn = 'To Do';
        const created = await Promise.all(
          args.sprints.map(async (sprintInput) => {
            const sprint = await context.prisma.sprint.create({
              data: {
                name: sprintInput.name,
                projectId: args.projectId,
                orgId: user.orgId,
                columns: defaultColumns,
              },
            });
            if (sprintInput.taskIds.length > 0) {
              await context.prisma.task.updateMany({
                where: { taskId: { in: sprintInput.taskIds }, orgId: user.orgId },
                data: { sprintId: sprint.sprintId, sprintColumn: firstColumn },
              });
            }
            return sprint;
          })
        );
        return created;
      },

      generateProjectOptions: async (_parent, args: { prompt: string }, context) => {
        const apiKey = requireApiKey(context);
        return aiGenerateProjectOptions(apiKey, args.prompt);
      },

      createProjectFromOption: async (
        _parent,
        args: { prompt: string; title: string; description: string },
        context
      ) => {
        const user = requireOrg(context);
        // Only create the project — task generation happens via previewTaskPlan + commitTaskPlan
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
        _parent,
        args: { projectId: string; context?: string | null },
        context
      ) => {
        const user = requireOrg(context);
        const apiKey = requireApiKey(context);
        const project = await context.prisma.project.findUnique({
          where: { projectId: args.projectId },
        });
        if (!project || project.orgId !== user.orgId) {
          throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
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
        _parent,
        args: { projectId: string; context?: string | null; appendToTitles?: string[] | null },
        context
      ) => {
        const user = requireOrg(context);
        const apiKey = requireApiKey(context);
        const project = await context.prisma.project.findUnique({
          where: { projectId: args.projectId },
        });
        if (!project || project.orgId !== user.orgId) {
          throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
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
        _parent,
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
        context
      ) => {
        const user = requireOrg(context);
        const project = await context.prisma.project.findUnique({
          where: { projectId: args.projectId },
        });
        if (!project || project.orgId !== user.orgId) {
          throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
        }

        if (args.clearExisting) {
          // Delete subtasks first to avoid FK constraint issues, then parent tasks
          await context.prisma.task.deleteMany({
            where: { projectId: args.projectId, parentTaskId: { not: null } },
          });
          await context.prisma.task.deleteMany({
            where: { projectId: args.projectId, parentTaskId: null },
          });
        }

        // Create all top-level tasks
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

        // Build title → taskId map for dependency resolution
        const titleToId = new Map<string, string>();
        created.forEach((task) => titleToId.set(task.title, task.taskId));

        // Update dependsOn with resolved task IDs, and create subtasks
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

        // Return the created top-level tasks with updated dependsOn
        return context.prisma.task.findMany({
          where: { projectId: args.projectId, parentTaskId: null },
          orderBy: { createdAt: 'asc' },
        });
      },

      expandTask: async (
        _parent,
        args: { taskId: string; context?: string | null },
        context
      ) => {
        const user = requireOrg(context);
        const apiKey = requireApiKey(context);
        const task = await context.prisma.task.findUnique({
          where: { taskId: args.taskId },
          include: { project: true },
        });
        if (!task || task.orgId !== user.orgId) {
          throw new GraphQLError('Task not found', { extensions: { code: 'NOT_FOUND' } });
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

      generateTaskInstructions: async (_parent, args: { taskId: string }, context) => {
        const user = requireOrg(context);
        const apiKey = requireApiKey(context);
        const task = await context.prisma.task.findUnique({
          where: { taskId: args.taskId },
          include: { project: true },
        });
        if (!task || task.orgId !== user.orgId) {
          throw new GraphQLError('Task not found', { extensions: { code: 'NOT_FOUND' } });
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
          siblings.map((s) => s.title)
        );
        const titleToId = new Map(siblings.map((s) => [s.title, s.taskId]));
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

      summarizeProject: async (_parent, args: { projectId: string }, context) => {
        const user = requireOrg(context);
        const apiKey = requireApiKey(context);
        const project = await context.prisma.project.findUnique({
          where: { projectId: args.projectId },
        });
        if (!project || project.orgId !== user.orgId) {
          throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
        }
        const tasks = await context.prisma.task.findMany({
          where: { projectId: args.projectId, parentTaskId: null },
          select: { title: true, description: true, status: true },
          orderBy: { createdAt: 'asc' },
        });
        if (tasks.length === 0) {
          throw new GraphQLError('No tasks to summarize. Generate a task plan first.', {
            extensions: { code: 'NO_TASKS' },
          });
        }
        return aiSummarizeProject(apiKey, project.name, project.description ?? '', tasks);
      },
    },
  },
});
