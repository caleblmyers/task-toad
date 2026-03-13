import { createSchema } from 'graphql-yoga';
import { GraphQLError } from 'graphql';
import bcrypt from 'bcryptjs';
import { SignJWT } from 'jose';
import { JWT_SECRET, type Context } from './context.js';
import { encryptApiKey, decryptApiKey } from '../utils/encryption.js';
import { generateToken } from '../utils/token.js';
import { sendEmail, verifyEmailText, resetPasswordText, inviteText } from '../utils/email.js';
import {
  generateProjectOptions as aiGenerateProjectOptions,
  generateTaskPlan as aiGenerateTaskPlan,
  expandTask as aiExpandTask,
  generateTaskInstructions as aiGenerateTaskInstructions,
  summarizeProject as aiSummarizeProject,
  planSprints as aiPlanSprints,
} from '../ai/index.js';
import { logActivity } from '../utils/activity.js';
import { createNotification } from '../utils/notification.js';

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
      emailVerifiedAt: String
    }

    type OrgInvite {
      inviteId:   ID!
      email:      String!
      role:       String!
      expiresAt:  String!
      createdAt:  String!
      acceptedAt: String
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
      statuses: String!
      createdAt: String!
      orgId: ID!
      archived: Boolean!
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
      status: String!
      projectId: ID!
      parentTaskId: ID
      createdAt: String!
      sprintId: ID
      sprintColumn: String
      assigneeId: ID
      archived: Boolean!
      position: Float
      dueDate: String
      labels: [Label!]!
    }

    type TaskConnection {
      tasks:   [Task!]!
      hasMore: Boolean!
      total:   Int!
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

    type Comment {
      commentId: ID!
      taskId: ID!
      userId: ID!
      userEmail: String!
      parentCommentId: ID
      content: String!
      createdAt: String!
      updatedAt: String!
      replies: [Comment!]!
    }

    type Activity {
      activityId: ID!
      projectId: ID
      taskId: ID
      sprintId: ID
      userId: ID!
      userEmail: String!
      action: String!
      field: String
      oldValue: String
      newValue: String
      createdAt: String!
    }

    type Label {
      labelId: ID!
      name: String!
      color: String!
    }

    type Notification {
      notificationId: ID!
      type: String!
      title: String!
      body: String
      linkUrl: String
      isRead: Boolean!
      createdAt: String!
    }

    type CountEntry {
      label: String!
      count: Int!
    }

    type AssigneeCount {
      userId: ID!
      email: String!
      count: Int!
    }

    type ProjectStats {
      totalTasks: Int!
      completedTasks: Int!
      overdueTasks: Int!
      completionPercent: Float!
      tasksByStatus: [CountEntry!]!
      tasksByPriority: [CountEntry!]!
      tasksByAssignee: [AssigneeCount!]!
      totalEstimatedHours: Float!
      completedEstimatedHours: Float!
    }

    type SprintVelocityPoint {
      sprintId: ID!
      sprintName: String!
      completedTasks: Int!
      completedHours: Float!
      totalTasks: Int!
      totalHours: Float!
    }

    type BurndownDay {
      date: String!
      remaining: Int!
      completed: Int!
      added: Int!
    }

    type SprintBurndownData {
      days: [BurndownDay!]!
      totalScope: Int!
      sprintName: String!
      startDate: String!
      endDate: String!
    }

    type AuthPayload {
      token: String!
    }

    type TaskSearchHit {
      task: Task!
      projectName: String!
    }

    type GlobalSearchResult {
      tasks: [TaskSearchHit!]!
      projects: [Project!]!
    }

    type Query {
      me: User
      org: Org
      projects(includeArchived: Boolean): [Project!]!
      project(projectId: ID!): Project
      tasks(projectId: ID!, parentTaskId: ID, limit: Int, offset: Int): TaskConnection!
      sprints(projectId: ID!): [Sprint!]!
      orgUsers: [OrgUser!]!
      orgInvites: [OrgInvite!]!
      comments(taskId: ID!): [Comment!]!
      activities(projectId: ID, taskId: ID, limit: Int): [Activity!]!
      projectStats(projectId: ID!): ProjectStats!
      labels: [Label!]!
      notifications(unreadOnly: Boolean, limit: Int): [Notification!]!
      unreadNotificationCount: Int!
      sprintVelocity(projectId: ID!): [SprintVelocityPoint!]!
      sprintBurndown(sprintId: ID!): SprintBurndownData!
      globalSearch(query: String!, limit: Int): GlobalSearchResult!
    }

    type Mutation {
      signup(email: String!, password: String!): Boolean!
      login(email: String!, password: String!): AuthPayload!

      sendVerificationEmail: Boolean!
      verifyEmail(token: String!): Boolean!

      requestPasswordReset(email: String!): Boolean!
      resetPassword(token: String!, newPassword: String!): Boolean!

      inviteOrgMember(email: String!, role: String): Boolean!
      acceptInvite(token: String!, password: String): AuthPayload!
      revokeInvite(inviteId: ID!): Boolean!
      createOrg(name: String!, apiKey: String): Org!
      setOrgApiKey(apiKey: String!): Org!
      createProject(name: String!): Project!
      updateProject(projectId: ID!, name: String, description: String, statuses: String): Project!
      archiveProject(projectId: ID!, archived: Boolean!): Project!
      createTask(projectId: ID!, title: String!, status: String): Task!
      updateTask(taskId: ID!, title: String, status: String, description: String, instructions: String, dependsOn: String, sprintId: ID, sprintColumn: String, assigneeId: ID, dueDate: String, position: Float, archived: Boolean): Task!
      bulkUpdateTasks(taskIds: [ID!]!, status: String, assigneeId: ID, sprintId: ID, archived: Boolean): [Task!]!

      createComment(taskId: ID!, content: String!, parentCommentId: ID): Comment!
      updateComment(commentId: ID!, content: String!): Comment!
      deleteComment(commentId: ID!): Boolean!

      createLabel(name: String!, color: String): Label!
      deleteLabel(labelId: ID!): Boolean!
      addTaskLabel(taskId: ID!, labelId: ID!): Task!
      removeTaskLabel(taskId: ID!, labelId: ID!): Task!

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

      markNotificationRead(notificationId: ID!): Notification!
      markAllNotificationsRead: Boolean!
    }
  `,
  resolvers: {
    User: {
      emailVerifiedAt: (parent: { emailVerifiedAt: Date | null }) =>
        parent.emailVerifiedAt ? parent.emailVerifiedAt.toISOString() : null,
    },

    OrgInvite: {
      expiresAt: (parent: { expiresAt: Date }) => parent.expiresAt.toISOString(),
      createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
      acceptedAt: (parent: { acceptedAt: Date | null }) =>
        parent.acceptedAt ? parent.acceptedAt.toISOString() : null,
    },

    Org: {
      hasApiKey: (parent: { anthropicApiKeyEncrypted?: string | null }) => !!parent.anthropicApiKeyEncrypted,
      apiKeyHint: (parent: { anthropicApiKeyEncrypted?: string | null }) => {
        if (!parent.anthropicApiKeyEncrypted) return null;
        try {
          const plaintext = decryptApiKey(parent.anthropicApiKeyEncrypted);
          return `...${plaintext.slice(-4)}`;
        } catch {
          return null;
        }
      },
    },

    Task: {
      labels: async (parent: { taskId: string }, _args: unknown, context: Context) => {
        const taskLabels = await context.prisma.taskLabel.findMany({
          where: { taskId: parent.taskId },
          include: { label: true },
        });
        return taskLabels.map((tl) => tl.label);
      },
    },

    Sprint: {
      closedAt: (parent: { closedAt: Date | null }) =>
        parent.closedAt ? parent.closedAt.toISOString() : null,
    },

    Notification: {
      createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    },

    Query: {
      me: (_parent, _args, context) => {
        return context.user;
      },

      org: (_parent, _args, context) => {
        requireOrg(context);
        return context.org;
      },

      projects: async (_parent, args: { includeArchived?: boolean | null }, context) => {
        const user = requireOrg(context);
        return context.prisma.project.findMany({
          where: {
            orgId: user.orgId,
            ...(args.includeArchived ? {} : { archived: false }),
          },
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

      orgInvites: async (_parent, _args, context) => {
        const user = requireOrg(context);
        if (user.role !== 'org:admin') {
          throw new GraphQLError('Admin role required', { extensions: { code: 'FORBIDDEN' } });
        }
        return context.prisma.orgInvite.findMany({
          where: { orgId: user.orgId, acceptedAt: null },
          orderBy: { createdAt: 'desc' },
        });
      },

      tasks: async (
        _parent,
        args: { projectId: string; parentTaskId?: string | null; limit?: number | null; offset?: number | null },
        context
      ) => {
        await requireProjectAccess(context, args.projectId);
        const limit = args.limit ?? 100;
        const offset = args.offset ?? 0;
        const where = {
          projectId: args.projectId,
          parentTaskId: args.parentTaskId !== undefined ? args.parentTaskId : null,
        };
        const [tasks, total] = await Promise.all([
          context.prisma.task.findMany({
            where,
            orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
            take: limit,
            skip: offset,
          }),
          context.prisma.task.count({ where }),
        ]);
        return { tasks, hasMore: offset + limit < total, total };
      },

      comments: async (_parent, args: { taskId: string }, context) => {
        const user = requireOrg(context);
        const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
        if (!task || task.orgId !== user.orgId) {
          throw new GraphQLError('Task not found', { extensions: { code: 'NOT_FOUND' } });
        }
        const comments = await context.prisma.comment.findMany({
          where: { taskId: args.taskId, parentCommentId: null },
          include: { user: { select: { email: true } }, replies: { include: { user: { select: { email: true } } }, orderBy: { createdAt: 'asc' } } },
          orderBy: { createdAt: 'asc' },
        });
        return comments.map((c) => ({
          ...c,
          userEmail: c.user.email,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
          replies: c.replies.map((r) => ({
            ...r,
            userEmail: r.user.email,
            createdAt: r.createdAt.toISOString(),
            updatedAt: r.updatedAt.toISOString(),
            replies: [],
          })),
        }));
      },

      activities: async (_parent, args: { projectId?: string | null; taskId?: string | null; limit?: number | null }, context) => {
        const user = requireOrg(context);
        const where: Record<string, unknown> = { orgId: user.orgId };
        if (args.projectId) where.projectId = args.projectId;
        if (args.taskId) where.taskId = args.taskId;
        const activities = await context.prisma.activity.findMany({
          where,
          include: { user: { select: { email: true } } },
          orderBy: { createdAt: 'desc' },
          take: args.limit ?? 50,
        });
        return activities.map((a) => ({
          ...a,
          userEmail: a.user.email,
          createdAt: a.createdAt.toISOString(),
        }));
      },

      projectStats: async (_parent, args: { projectId: string }, context) => {
        await requireProjectAccess(context, args.projectId);
        const tasks = await context.prisma.task.findMany({
          where: { projectId: args.projectId, parentTaskId: null, archived: false },
          select: { status: true, priority: true, assigneeId: true, estimatedHours: true, dueDate: true },
        });
        const orgUsers = await context.prisma.user.findMany({
          where: { orgId: context.user!.orgId! },
          select: { userId: true, email: true },
        });
        const userMap = new Map(orgUsers.map((u) => [u.userId, u.email]));

        const totalTasks = tasks.length;
        const completedTasks = tasks.filter((t) => t.status === 'done').length;
        const today = new Date().toISOString().slice(0, 10);
        const overdueTasks = tasks.filter((t) => t.dueDate && t.dueDate < today && t.status !== 'done').length;
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

      labels: async (_parent, _args, context) => {
        const user = requireOrg(context);
        return context.prisma.label.findMany({
          where: { orgId: user.orgId },
          orderBy: { name: 'asc' },
        });
      },

      notifications: async (_parent, args: { unreadOnly?: boolean | null; limit?: number | null }, context) => {
        const user = requireOrg(context);
        return context.prisma.notification.findMany({
          where: {
            userId: user.userId,
            orgId: user.orgId,
            ...(args.unreadOnly ? { isRead: false } : {}),
          },
          orderBy: { createdAt: 'desc' },
          take: args.limit ?? 50,
        });
      },

      unreadNotificationCount: async (_parent, _args, context) => {
        const user = requireOrg(context);
        return context.prisma.notification.count({
          where: { userId: user.userId, orgId: user.orgId, isRead: false },
        });
      },

      sprintVelocity: async (_parent, args: { projectId: string }, context) => {
        const { user } = await requireProjectAccess(context, args.projectId);
        const closedSprints = await context.prisma.sprint.findMany({
          where: { projectId: args.projectId, orgId: user.orgId, closedAt: { not: null } },
          orderBy: { closedAt: 'asc' },
        });
        const results = [];
        for (const sprint of closedSprints) {
          const tasks = await context.prisma.task.findMany({
            where: { sprintId: sprint.sprintId, parentTaskId: null },
          });
          const doneTasks = tasks.filter((t) => t.status === 'done');
          results.push({
            sprintId: sprint.sprintId,
            sprintName: sprint.name,
            completedTasks: doneTasks.length,
            completedHours: doneTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0),
            totalTasks: tasks.length,
            totalHours: tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0),
          });
        }
        return results;
      },

      sprintBurndown: async (_parent, args: { sprintId: string }, context) => {
        const user = requireOrg(context);
        const sprint = await context.prisma.sprint.findUnique({ where: { sprintId: args.sprintId } });
        if (!sprint || sprint.orgId !== user.orgId) {
          throw new GraphQLError('Sprint not found', { extensions: { code: 'NOT_FOUND' } });
        }
        if (!sprint.startDate || !sprint.endDate) {
          throw new GraphQLError('Sprint must have start and end dates', { extensions: { code: 'BAD_USER_INPUT' } });
        }

        const tasks = await context.prisma.task.findMany({
          where: { sprintId: sprint.sprintId, parentTaskId: null },
        });
        const totalScope = tasks.length;

        // Get status change activities for these tasks
        const taskIds = tasks.map((t) => t.taskId);
        const activities = await context.prisma.activity.findMany({
          where: {
            taskId: { in: taskIds },
            action: 'task.updated',
            field: 'status',
          },
          orderBy: { createdAt: 'asc' },
        });

        // Walk through each day
        const startDate = new Date(sprint.startDate + 'T00:00:00');
        const endDateOrToday = sprint.closedAt
          ? new Date(sprint.endDate + 'T23:59:59')
          : new Date(Math.min(new Date().getTime(), new Date(sprint.endDate + 'T23:59:59').getTime()));

        const days: Array<{ date: string; remaining: number; completed: number; added: number }> = [];
        let completedSoFar = 0;

        for (let d = new Date(startDate); d <= endDateOrToday; d.setDate(d.getDate() + 1)) {
          const dayStr = d.toISOString().split('T')[0];
          const dayEnd = new Date(dayStr + 'T23:59:59');

          // Count status changes to 'done' by this day
          const completedByDay = activities.filter((a) =>
            a.newValue === 'done' && a.createdAt <= dayEnd
          ).length;
          // Count status changes from 'done' (uncompleted) by this day
          const uncompletedByDay = activities.filter((a) =>
            a.oldValue === 'done' && a.createdAt <= dayEnd
          ).length;

          completedSoFar = completedByDay - uncompletedByDay;
          if (completedSoFar < 0) completedSoFar = 0;

          days.push({
            date: dayStr,
            remaining: totalScope - completedSoFar,
            completed: completedSoFar,
            added: 0,
          });
        }

        return {
          days,
          totalScope,
          sprintName: sprint.name,
          startDate: sprint.startDate,
          endDate: sprint.endDate,
        };
      },

      globalSearch: async (_parent, args: { query: string; limit?: number | null }, context) => {
        const user = requireOrg(context);
        const take = args.limit ?? 10;
        const [projects, tasks] = await Promise.all([
          context.prisma.project.findMany({
            where: { orgId: user.orgId, name: { contains: args.query, mode: 'insensitive' }, archived: false },
            take,
          }),
          context.prisma.task.findMany({
            where: {
              orgId: user.orgId,
              archived: false,
              OR: [
                { title: { contains: args.query, mode: 'insensitive' } },
                { description: { contains: args.query, mode: 'insensitive' } },
              ],
            },
            include: { project: { select: { name: true } } },
            take,
          }),
        ]);
        return {
          projects,
          tasks: tasks.map((t) => ({ task: t, projectName: (t as { project: { name: string } }).project.name })),
        };
      },
    },

    Mutation: {
      signup: async (_parent, args: { email: string; password: string }, context) => {
        if (args.password.length < 8) {
          throw new GraphQLError('Password must be at least 8 characters');
        }
        const existing = await context.prisma.user.findUnique({ where: { email: args.email } });
        if (existing) throw new GraphQLError('Email already in use');
        const passwordHash = await bcrypt.hash(args.password, 10);
        const verificationToken = generateToken();
        await context.prisma.user.create({
          data: { email: args.email, passwordHash, verificationToken },
        });
        await sendEmail(
          args.email,
          'Verify your TaskToad account',
          verifyEmailText(verificationToken)
        );
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

      sendVerificationEmail: async (_parent, _args, context) => {
        const user = requireAuth(context);
        const dbUser = await context.prisma.user.findUnique({ where: { userId: user.userId } });
        if (!dbUser) throw new GraphQLError('User not found');
        if (dbUser.emailVerifiedAt) return true;
        const verificationToken = generateToken();
        await context.prisma.user.update({
          where: { userId: user.userId },
          data: { verificationToken },
        });
        await sendEmail(
          dbUser.email,
          'Verify your TaskToad account',
          verifyEmailText(verificationToken)
        );
        return true;
      },

      verifyEmail: async (_parent, args: { token: string }, context) => {
        const user = await context.prisma.user.findUnique({
          where: { verificationToken: args.token },
        });
        if (!user) throw new GraphQLError('Invalid or expired verification token');
        await context.prisma.user.update({
          where: { userId: user.userId },
          data: { emailVerifiedAt: new Date(), verificationToken: null },
        });
        return true;
      },

      requestPasswordReset: async (_parent, args: { email: string }, context) => {
        const user = await context.prisma.user.findUnique({ where: { email: args.email } });
        if (!user) return true; // silent - no enumeration
        const resetToken = generateToken();
        const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
        await context.prisma.user.update({
          where: { userId: user.userId },
          data: { resetToken, resetTokenExpiry },
        });
        await sendEmail(
          user.email,
          'Reset your TaskToad password',
          resetPasswordText(resetToken)
        );
        return true;
      },

      resetPassword: async (_parent, args: { token: string; newPassword: string }, context) => {
        if (args.newPassword.length < 8) {
          throw new GraphQLError('Password must be at least 8 characters');
        }
        const user = await context.prisma.user.findFirst({
          where: {
            resetToken: args.token,
            resetTokenExpiry: { gt: new Date() },
          },
        });
        if (!user) throw new GraphQLError('Invalid or expired reset token');
        const passwordHash = await bcrypt.hash(args.newPassword, 10);
        await context.prisma.user.update({
          where: { userId: user.userId },
          data: { passwordHash, resetToken: null, resetTokenExpiry: null },
        });
        return true;
      },

      inviteOrgMember: async (_parent, args: { email: string; role?: string | null }, context) => {
        const user = requireOrg(context);
        if (user.role !== 'org:admin') {
          throw new GraphQLError('Admin role required', { extensions: { code: 'FORBIDDEN' } });
        }
        const existingUser = await context.prisma.user.findUnique({ where: { email: args.email } });
        if (existingUser?.orgId) {
          throw new GraphQLError('This email already belongs to an org member');
        }
        const token = generateToken();
        const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
        const role = args.role ?? 'org:member';
        await context.prisma.orgInvite.upsert({
          where: { token },
          update: {},
          create: {
            orgId: user.orgId,
            email: args.email,
            token,
            role,
            expiresAt,
          },
        });
        // If a prior invite exists for this email+org, replace it
        await context.prisma.orgInvite.deleteMany({
          where: {
            orgId: user.orgId,
            email: args.email,
            acceptedAt: null,
            token: { not: token },
          },
        });
        const org = await context.prisma.org.findUnique({ where: { orgId: user.orgId } });
        await sendEmail(
          args.email,
          `You're invited to join ${org?.name ?? 'TaskToad'}`,
          inviteText(org?.name ?? 'TaskToad', token)
        );
        return true;
      },

      acceptInvite: async (_parent, args: { token: string; password?: string | null }, context) => {
        const invite = await context.prisma.orgInvite.findUnique({ where: { token: args.token } });
        if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
          throw new GraphQLError('Invalid or expired invite');
        }
        let userId: string;
        const existingUser = await context.prisma.user.findUnique({ where: { email: invite.email } });
        if (existingUser) {
          if (existingUser.orgId) {
            throw new GraphQLError('Email already belongs to an org member');
          }
          await context.prisma.user.update({
            where: { userId: existingUser.userId },
            data: { orgId: invite.orgId, role: invite.role, emailVerifiedAt: new Date() },
          });
          userId = existingUser.userId;
        } else {
          if (!args.password || args.password.length < 8) {
            throw new GraphQLError('Password must be at least 8 characters');
          }
          const passwordHash = await bcrypt.hash(args.password, 10);
          const newUser = await context.prisma.user.create({
            data: {
              email: invite.email,
              passwordHash,
              orgId: invite.orgId,
              role: invite.role,
              emailVerifiedAt: new Date(),
            },
          });
          userId = newUser.userId;
        }
        await context.prisma.orgInvite.update({
          where: { inviteId: invite.inviteId },
          data: { acceptedAt: new Date() },
        });
        const updatedUser = await context.prisma.user.findUnique({ where: { userId } });
        if (!updatedUser) throw new GraphQLError('User not found');
        const token = await new SignJWT({ sub: updatedUser.userId, email: updatedUser.email })
          .setProtectedHeader({ alg: 'HS256' })
          .setExpirationTime('7d')
          .sign(JWT_SECRET);
        return { token };
      },

      revokeInvite: async (_parent, args: { inviteId: string }, context) => {
        const user = requireOrg(context);
        if (user.role !== 'org:admin') {
          throw new GraphQLError('Admin role required', { extensions: { code: 'FORBIDDEN' } });
        }
        const invite = await context.prisma.orgInvite.findUnique({ where: { inviteId: args.inviteId } });
        if (!invite || invite.orgId !== user.orgId) {
          throw new GraphQLError('Invite not found', { extensions: { code: 'NOT_FOUND' } });
        }
        await context.prisma.orgInvite.delete({ where: { inviteId: args.inviteId } });
        return true;
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

      updateProject: async (
        _parent,
        args: { projectId: string; name?: string | null; description?: string | null; statuses?: string | null },
        context
      ) => {
        const user = requireOrg(context);
        if (user.role !== 'org:admin') {
          throw new GraphQLError('Admin role required', { extensions: { code: 'FORBIDDEN' } });
        }
        const { project } = await requireProjectAccess(context, args.projectId);
        if (args.statuses !== undefined && args.statuses !== null) {
          try {
            const parsed = JSON.parse(args.statuses) as unknown;
            if (!Array.isArray(parsed) || parsed.length === 0 || !parsed.every((s) => typeof s === 'string')) {
              throw new Error();
            }
          } catch {
            throw new GraphQLError('statuses must be a non-empty JSON array of strings');
          }
        }
        const updated = await context.prisma.project.update({
          where: { projectId: args.projectId },
          data: {
            ...(args.name !== undefined && args.name !== null ? { name: args.name } : {}),
            ...(args.description !== undefined ? { description: args.description } : {}),
            ...(args.statuses !== undefined && args.statuses !== null ? { statuses: args.statuses } : {}),
          },
        });
        logActivity(context.prisma, {
          orgId: user.orgId, projectId: args.projectId, userId: user.userId,
          action: 'project.updated',
          ...(args.name && args.name !== project.name ? { field: 'name', oldValue: project.name, newValue: args.name } : {}),
        });
        return updated;
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
        const status = args.status ?? 'todo';
        const validStatuses = JSON.parse(project.statuses) as string[];
        if (!validStatuses.includes(status)) {
          throw new GraphQLError(`Invalid status "${status}". Valid: ${validStatuses.join(', ')}`);
        }
        const maxResult = await context.prisma.task.aggregate({
          where: { projectId: args.projectId, sprintId: null, parentTaskId: null },
          _max: { position: true },
        });
        const nextPosition = (maxResult._max.position ?? 0) + 1.0;
        const task = await context.prisma.task.create({
          data: {
            title: args.title,
            status,
            projectId: args.projectId,
            orgId: user.orgId,
            position: nextPosition,
          },
        });
        logActivity(context.prisma, {
          orgId: user.orgId, projectId: args.projectId, taskId: task.taskId, userId: user.userId,
          action: 'task.created',
        });
        return task;
      },

      updateTask: async (
        _parent,
        args: { taskId: string; title?: string; status?: string; description?: string; instructions?: string; dependsOn?: string | null; sprintId?: string | null; sprintColumn?: string | null; assigneeId?: string | null; dueDate?: string | null; position?: number | null; archived?: boolean },
        context
      ) => {
        const user = requireOrg(context);
        const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId }, include: { project: true } });
        if (!task || task.orgId !== user.orgId) {
          throw new GraphQLError('Task not found', { extensions: { code: 'NOT_FOUND' } });
        }
        if (args.status !== undefined) {
          const validStatuses = JSON.parse(task.project.statuses) as string[];
          if (!validStatuses.includes(args.status)) {
            throw new GraphQLError(`Invalid status "${args.status}". Valid: ${validStatuses.join(', ')}`);
          }
        }
        const updated = await context.prisma.task.update({
          where: { taskId: args.taskId },
          data: {
            ...(args.title !== undefined ? { title: args.title } : {}),
            ...(args.status !== undefined ? { status: args.status } : {}),
            ...(args.description !== undefined ? { description: args.description } : {}),
            ...(args.instructions !== undefined ? { instructions: args.instructions } : {}),
            ...(args.dependsOn !== undefined ? { dependsOn: args.dependsOn } : {}),
            ...(args.sprintId !== undefined ? { sprintId: args.sprintId } : {}),
            ...(args.sprintColumn !== undefined ? { sprintColumn: args.sprintColumn } : {}),
            ...(args.assigneeId !== undefined ? { assigneeId: args.assigneeId } : {}),
            ...(args.dueDate !== undefined ? { dueDate: args.dueDate } : {}),
            ...(args.position !== undefined ? { position: args.position } : {}),
            ...(args.archived !== undefined ? { archived: args.archived } : {}),
          },
        });
        // Log each changed field
        const fields: Array<[string, string | null | undefined, string | null | undefined]> = [
          ['title', task.title, args.title],
          ['status', task.status, args.status],
          ['assigneeId', task.assigneeId, args.assigneeId],
          ['sprintId', task.sprintId, args.sprintId],
          ['dueDate', task.dueDate, args.dueDate],
          ['dependsOn', task.dependsOn, args.dependsOn],
          ['archived', String(task.archived), args.archived !== undefined ? String(args.archived) : undefined],
        ];
        for (const [field, oldVal, newVal] of fields) {
          if (newVal !== undefined && newVal !== oldVal) {
            logActivity(context.prisma, {
              orgId: user.orgId, projectId: task.projectId, taskId: task.taskId, userId: user.userId,
              action: 'task.updated', field, oldValue: oldVal ?? null, newValue: newVal ?? null,
            });
          }
        }
        // Notify on assignment change
        if (args.assigneeId !== undefined && args.assigneeId !== task.assigneeId && args.assigneeId && args.assigneeId !== user.userId) {
          createNotification(context.prisma, {
            orgId: user.orgId,
            userId: args.assigneeId,
            type: 'assigned',
            title: `You were assigned to "${task.title}"`,
            linkUrl: `/app/projects/${task.projectId}`,
            relatedTaskId: task.taskId,
            relatedProjectId: task.projectId,
          });
        }
        // Notify on status change
        if (args.status !== undefined && args.status !== task.status && task.assigneeId && task.assigneeId !== user.userId) {
          const userRecord = await context.prisma.user.findUnique({ where: { userId: user.userId }, select: { email: true } });
          createNotification(context.prisma, {
            orgId: user.orgId,
            userId: task.assigneeId,
            type: 'status_changed',
            title: `${userRecord?.email ?? 'Someone'} changed "${task.title}" status to ${args.status}`,
            linkUrl: `/app/projects/${task.projectId}`,
            relatedTaskId: task.taskId,
            relatedProjectId: task.projectId,
          });
        }
        return updated;
      },

      archiveProject: async (_parent, args: { projectId: string; archived: boolean }, context) => {
        const user = requireOrg(context);
        if (user.role !== 'org:admin') {
          throw new GraphQLError('Admin role required', { extensions: { code: 'FORBIDDEN' } });
        }
        await requireProjectAccess(context, args.projectId);
        const result = await context.prisma.project.update({
          where: { projectId: args.projectId },
          data: { archived: args.archived },
        });
        logActivity(context.prisma, {
          orgId: user.orgId, projectId: args.projectId, userId: user.userId,
          action: args.archived ? 'project.archived' : 'project.unarchived',
        });
        return result;
      },

      createSprint: async (_parent, args: { projectId: string; name: string; columns?: string | null; startDate?: string | null; endDate?: string | null }, context) => {
        const user = requireOrg(context);
        const project = await context.prisma.project.findUnique({ where: { projectId: args.projectId } });
        if (!project || project.orgId !== user.orgId) {
          throw new GraphQLError('Project not found', { extensions: { code: 'NOT_FOUND' } });
        }
        const sprint = await context.prisma.sprint.create({
          data: {
            name: args.name,
            projectId: args.projectId,
            orgId: user.orgId,
            columns: args.columns ?? '["To Do","In Progress","Done"]',
            startDate: args.startDate ?? null,
            endDate: args.endDate ?? null,
          },
        });
        logActivity(context.prisma, {
          orgId: user.orgId, projectId: args.projectId, sprintId: sprint.sprintId, userId: user.userId,
          action: 'sprint.created',
        });
        return sprint;
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
        const updated = await context.prisma.sprint.update({
          where: { sprintId: args.sprintId },
          data: {
            ...(args.name !== undefined && args.name !== null ? { name: args.name } : {}),
            ...(args.columns !== undefined && args.columns !== null ? { columns: args.columns } : {}),
            ...(args.isActive !== undefined && args.isActive !== null ? { isActive: args.isActive } : {}),
            ...(args.startDate !== undefined ? { startDate: args.startDate } : {}),
            ...(args.endDate !== undefined ? { endDate: args.endDate } : {}),
          },
        });
        logActivity(context.prisma, {
          orgId: user.orgId, projectId: sprint.projectId, sprintId: sprint.sprintId, userId: user.userId,
          action: 'sprint.updated',
        });
        return updated;
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
        logActivity(context.prisma, {
          orgId: user.orgId, projectId: sprint.projectId, sprintId: sprint.sprintId, userId: user.userId,
          action: 'sprint.deleted',
        });
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
          select: { title: true, status: true },
          orderBy: { createdAt: 'asc' },
        });
        if (tasks.length === 0) {
          throw new GraphQLError('No tasks to summarize. Generate a task plan first.', {
            extensions: { code: 'NO_TASKS' },
          });
        }
        return aiSummarizeProject(apiKey, project.name, project.description ?? '', tasks);
      },

      bulkUpdateTasks: async (
        _parent,
        args: { taskIds: string[]; status?: string | null; assigneeId?: string | null; sprintId?: string | null; archived?: boolean | null },
        context
      ) => {
        const user = requireOrg(context);
        // Verify all tasks belong to user's org
        const tasks = await context.prisma.task.findMany({
          where: { taskId: { in: args.taskIds }, orgId: user.orgId },
        });
        if (tasks.length !== args.taskIds.length) {
          throw new GraphQLError('One or more tasks not found', { extensions: { code: 'NOT_FOUND' } });
        }
        const data: Record<string, unknown> = {};
        if (args.status !== undefined && args.status !== null) data.status = args.status;
        if (args.assigneeId !== undefined) data.assigneeId = args.assigneeId;
        if (args.sprintId !== undefined) data.sprintId = args.sprintId;
        if (args.archived !== undefined && args.archived !== null) data.archived = args.archived;

        await context.prisma.task.updateMany({
          where: { taskId: { in: args.taskIds }, orgId: user.orgId },
          data,
        });
        const updated = await context.prisma.task.findMany({
          where: { taskId: { in: args.taskIds } },
        });
        // Log activity for bulk action
        for (const task of tasks) {
          logActivity(context.prisma, {
            orgId: user.orgId, projectId: task.projectId, taskId: task.taskId, userId: user.userId,
            action: 'task.bulk_updated',
            ...(args.status ? { field: 'status', oldValue: task.status, newValue: args.status } : {}),
          });
        }
        return updated;
      },

      createComment: async (_parent, args: { taskId: string; content: string; parentCommentId?: string | null }, context) => {
        const user = requireOrg(context);
        const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
        if (!task || task.orgId !== user.orgId) {
          throw new GraphQLError('Task not found', { extensions: { code: 'NOT_FOUND' } });
        }
        if (args.parentCommentId) {
          const parent = await context.prisma.comment.findUnique({ where: { commentId: args.parentCommentId } });
          if (!parent || parent.taskId !== args.taskId) {
            throw new GraphQLError('Parent comment not found', { extensions: { code: 'NOT_FOUND' } });
          }
        }
        const comment = await context.prisma.comment.create({
          data: {
            taskId: args.taskId,
            userId: user.userId,
            content: args.content,
            parentCommentId: args.parentCommentId ?? null,
          },
          include: { user: { select: { email: true } } },
        });
        logActivity(context.prisma, {
          orgId: user.orgId, projectId: task.projectId, taskId: task.taskId, userId: user.userId,
          action: 'comment.created',
        });
        // Notify task assignee about new comment
        if (task.assigneeId && task.assigneeId !== user.userId) {
          createNotification(context.prisma, {
            orgId: user.orgId,
            userId: task.assigneeId,
            type: 'commented',
            title: `New comment on "${task.title}"`,
            body: args.content.length > 100 ? args.content.slice(0, 100) + '\u2026' : args.content,
            linkUrl: `/app/projects/${task.projectId}`,
            relatedTaskId: task.taskId,
            relatedProjectId: task.projectId,
          });
        }
        // Extract @mentions and create notifications
        const mentionPattern = /@(\S+@\S+)/g;
        let mentionMatch: RegExpExecArray | null;
        while ((mentionMatch = mentionPattern.exec(args.content)) !== null) {
          const mentionedEmail = mentionMatch[1];
          const mentionedUser = await context.prisma.user.findFirst({
            where: { email: mentionedEmail, orgId: user.orgId },
          });
          if (mentionedUser && mentionedUser.userId !== user.userId) {
            createNotification(context.prisma, {
              orgId: user.orgId,
              userId: mentionedUser.userId,
              type: 'mentioned',
              title: `You were mentioned in a comment on "${task.title}"`,
              body: args.content.length > 100 ? args.content.slice(0, 100) + '\u2026' : args.content,
              linkUrl: `/app/projects/${task.projectId}`,
              relatedTaskId: task.taskId,
              relatedProjectId: task.projectId,
            });
          }
        }
        return {
          ...comment,
          userEmail: comment.user.email,
          createdAt: comment.createdAt.toISOString(),
          updatedAt: comment.updatedAt.toISOString(),
          replies: [],
        };
      },

      updateComment: async (_parent, args: { commentId: string; content: string }, context) => {
        const user = requireAuth(context);
        const comment = await context.prisma.comment.findUnique({ where: { commentId: args.commentId } });
        if (!comment) throw new GraphQLError('Comment not found', { extensions: { code: 'NOT_FOUND' } });
        if (comment.userId !== user.userId) {
          throw new GraphQLError('Not authorized to edit this comment', { extensions: { code: 'FORBIDDEN' } });
        }
        const updated = await context.prisma.comment.update({
          where: { commentId: args.commentId },
          data: { content: args.content },
          include: { user: { select: { email: true } } },
        });
        return {
          ...updated,
          userEmail: updated.user.email,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
          replies: [],
        };
      },

      deleteComment: async (_parent, args: { commentId: string }, context) => {
        const user = requireOrg(context);
        const comment = await context.prisma.comment.findUnique({ where: { commentId: args.commentId } });
        if (!comment) throw new GraphQLError('Comment not found', { extensions: { code: 'NOT_FOUND' } });
        if (comment.userId !== user.userId && user.role !== 'org:admin') {
          throw new GraphQLError('Not authorized to delete this comment', { extensions: { code: 'FORBIDDEN' } });
        }
        // Delete replies first, then the comment
        await context.prisma.comment.deleteMany({ where: { parentCommentId: args.commentId } });
        await context.prisma.comment.delete({ where: { commentId: args.commentId } });
        return true;
      },

      createLabel: async (_parent, args: { name: string; color?: string | null }, context) => {
        const user = requireOrg(context);
        const existing = await context.prisma.label.findUnique({
          where: { orgId_name: { orgId: user.orgId, name: args.name } },
        });
        if (existing) {
          throw new GraphQLError('Label already exists', { extensions: { code: 'BAD_USER_INPUT' } });
        }
        return context.prisma.label.create({
          data: {
            orgId: user.orgId,
            name: args.name,
            color: args.color ?? '#6b7280',
          },
        });
      },

      deleteLabel: async (_parent, args: { labelId: string }, context) => {
        const user = requireOrg(context);
        const label = await context.prisma.label.findUnique({ where: { labelId: args.labelId } });
        if (!label || label.orgId !== user.orgId) {
          throw new GraphQLError('Label not found', { extensions: { code: 'NOT_FOUND' } });
        }
        await context.prisma.label.delete({ where: { labelId: args.labelId } });
        return true;
      },

      addTaskLabel: async (_parent, args: { taskId: string; labelId: string }, context) => {
        const user = requireOrg(context);
        const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
        if (!task || task.orgId !== user.orgId) {
          throw new GraphQLError('Task not found', { extensions: { code: 'NOT_FOUND' } });
        }
        const label = await context.prisma.label.findUnique({ where: { labelId: args.labelId } });
        if (!label || label.orgId !== user.orgId) {
          throw new GraphQLError('Label not found', { extensions: { code: 'NOT_FOUND' } });
        }
        await context.prisma.taskLabel.upsert({
          where: { taskId_labelId: { taskId: args.taskId, labelId: args.labelId } },
          create: { taskId: args.taskId, labelId: args.labelId },
          update: {},
        });
        return task;
      },

      removeTaskLabel: async (_parent, args: { taskId: string; labelId: string }, context) => {
        const user = requireOrg(context);
        const task = await context.prisma.task.findUnique({ where: { taskId: args.taskId } });
        if (!task || task.orgId !== user.orgId) {
          throw new GraphQLError('Task not found', { extensions: { code: 'NOT_FOUND' } });
        }
        await context.prisma.taskLabel.deleteMany({
          where: { taskId: args.taskId, labelId: args.labelId },
        });
        return task;
      },

      markNotificationRead: async (_parent, args: { notificationId: string }, context) => {
        const user = requireAuth(context);
        const notification = await context.prisma.notification.findUnique({ where: { notificationId: args.notificationId } });
        if (!notification || notification.userId !== user.userId) {
          throw new GraphQLError('Notification not found', { extensions: { code: 'NOT_FOUND' } });
        }
        return context.prisma.notification.update({
          where: { notificationId: args.notificationId },
          data: { isRead: true },
        });
      },

      markAllNotificationsRead: async (_parent, _args, context) => {
        const user = requireOrg(context);
        await context.prisma.notification.updateMany({
          where: { userId: user.userId, orgId: user.orgId, isRead: false },
          data: { isRead: true },
        });
        return true;
      },
    },
  },
});
