import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { sessionQueries, sessionMutations } from '../graphql/resolvers/session.js';
import { createLoaders } from '../graphql/loaders.js';
import type { Context } from '../graphql/context.js';

// ── Helpers ──

function makeContext(user: { userId: string; email: string; orgId: string; role: string }): Context {
  return {
    user: { ...user, emailVerifiedAt: new Date(), displayName: null },
    org: {
      orgId: user.orgId,
      name: 'Test Org',
      anthropicApiKeyEncrypted: null,
      promptLoggingEnabled: true,
      monthlyBudgetCentsUSD: null,
      budgetAlertThreshold: 80,
      plan: 'free',
      createdAt: new Date(),
      trialEndsAt: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
    },
    prisma,
    loaders: createLoaders(prisma, user.orgId),
  };
}

const validConfig = {
  autonomyLevel: 'full',
  failurePolicy: 'pause_immediately',
};

let org: { orgId: string };
let user: { userId: string; email: string; orgId: string; role: string };
let ctx: Context;
let projectId: string;
let taskIds: string[];

// ── Setup ──

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();

  org = await prisma.org.create({ data: { name: 'Test Org' } });
  const dbUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      passwordHash: 'hashed',
      orgId: org.orgId,
      role: 'org:admin',
      emailVerifiedAt: new Date(),
    },
  });
  user = { userId: dbUser.userId, email: dbUser.email, orgId: org.orgId, role: 'org:admin' };
  ctx = makeContext(user);

  const project = await prisma.project.create({
    data: { name: 'Test Project', orgId: org.orgId },
  });
  projectId = project.projectId;

  const t1 = await prisma.task.create({
    data: { title: 'Task 1', projectId, orgId: org.orgId, status: 'todo' },
  });
  const t2 = await prisma.task.create({
    data: { title: 'Task 2', projectId, orgId: org.orgId, status: 'todo' },
  });
  const t3 = await prisma.task.create({
    data: { title: 'Task 3', projectId, orgId: org.orgId, status: 'todo' },
  });
  taskIds = [t1.taskId, t2.taskId, t3.taskId];
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('Session CRUD', () => {
  it('creates a session in draft status with initialized progress', async () => {
    const session = await sessionMutations.createSession(null, {
      projectId,
      taskIds,
      config: validConfig,
    }, ctx);

    expect(session.status).toBe('draft');
    expect(session.projectId).toBe(projectId);
    expect(session.orgId).toBe(org.orgId);
    expect(session.createdById).toBe(user.userId);

    const config = JSON.parse(session.config);
    expect(config.autonomyLevel).toBe('full');
    expect(config.failurePolicy).toBe('pause_immediately');

    const progress = JSON.parse(session.progress!);
    expect(progress.tasksCompleted).toBe(0);
    expect(progress.tasksFailed).toBe(0);
    expect(progress.tasksSkipped).toBe(0);
    expect(progress.tokensUsed).toBe(0);
    expect(progress.estimatedCostCents).toBe(0);

    const storedTaskIds = JSON.parse(session.taskIds);
    expect(storedTaskIds).toEqual(taskIds);
  });

  it('rejects creation with empty task list', async () => {
    await expect(
      sessionMutations.createSession(null, {
        projectId,
        taskIds: [],
        config: validConfig,
      }, ctx),
    ).rejects.toThrow('At least one task ID is required');
  });

  it('rejects creation with invalid autonomy level', async () => {
    await expect(
      sessionMutations.createSession(null, {
        projectId,
        taskIds,
        config: { autonomyLevel: 'invalid', failurePolicy: 'pause_immediately' },
      }, ctx),
    ).rejects.toThrow('Invalid autonomyLevel');
  });

  it('rejects creation with invalid failure policy', async () => {
    await expect(
      sessionMutations.createSession(null, {
        projectId,
        taskIds,
        config: { autonomyLevel: 'full', failurePolicy: 'invalid' },
      }, ctx),
    ).rejects.toThrow('Invalid failurePolicy');
  });

  it('rejects creation with task IDs not in project', async () => {
    await expect(
      sessionMutations.createSession(null, {
        projectId,
        taskIds: ['nonexistent-id'],
        config: validConfig,
      }, ctx),
    ).rejects.toThrow('Tasks not found in project');
  });

  it('rejects creation with task from another org', async () => {
    const otherOrg = await prisma.org.create({ data: { name: 'Other Org' } });
    const otherProject = await prisma.project.create({
      data: { name: 'Other Project', orgId: otherOrg.orgId },
    });
    const otherTask = await prisma.task.create({
      data: { title: 'Other Task', projectId: otherProject.projectId, orgId: otherOrg.orgId, status: 'todo' },
    });

    await expect(
      sessionMutations.createSession(null, {
        projectId,
        taskIds: [otherTask.taskId],
        config: validConfig,
      }, ctx),
    ).rejects.toThrow('Tasks not found in project');
  });

  it('queries sessions for a project', async () => {
    await sessionMutations.createSession(null, { projectId, taskIds: [taskIds[0]], config: validConfig }, ctx);
    await sessionMutations.createSession(null, { projectId, taskIds: [taskIds[1]], config: validConfig }, ctx);

    const sessions = await sessionQueries.sessions(null, { projectId }, ctx);
    expect(sessions).toHaveLength(2);
    // Most recent first
    expect(new Date(sessions[0].createdAt).getTime()).toBeGreaterThanOrEqual(
      new Date(sessions[1].createdAt).getTime(),
    );
  });

  it('queries a single session by ID', async () => {
    const created = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);

    const found = await sessionQueries.session(null, { sessionId: created.id }, ctx);
    expect(found).not.toBeNull();
    expect(found!.id).toBe(created.id);
  });

  it('returns null for session from another org', async () => {
    const created = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);

    const otherOrg = await prisma.org.create({ data: { name: 'Other Org' } });
    const otherUser = await prisma.user.create({
      data: { email: 'other@example.com', passwordHash: 'hashed', orgId: otherOrg.orgId, role: 'org:admin', emailVerifiedAt: new Date() },
    });
    const otherCtx = makeContext({ userId: otherUser.userId, email: otherUser.email, orgId: otherOrg.orgId, role: 'org:admin' });

    const found = await sessionQueries.session(null, { sessionId: created.id }, otherCtx);
    expect(found).toBeNull();
  });

  it('stores optional config fields', async () => {
    const session = await sessionMutations.createSession(null, {
      projectId,
      taskIds,
      config: {
        autonomyLevel: 'approve_external',
        failurePolicy: 'skip_and_continue',
        budgetCapCents: 5000,
        maxRetries: 3,
        scopeLimit: 10,
        timeLimitMinutes: 60,
      },
    }, ctx);

    const config = JSON.parse(session.config);
    expect(config.budgetCapCents).toBe(5000);
    expect(config.maxRetries).toBe(3);
    expect(config.scopeLimit).toBe(10);
    expect(config.timeLimitMinutes).toBe(60);
  });
});

describe('Session lifecycle', () => {
  it('starts a draft session and marks tasks autoComplete', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);
    const started = await sessionMutations.startSession(null, { sessionId: session.id }, ctx);

    expect(started.status).toBe('running');
    expect(started.startedAt).toBeTruthy();
    expect(started.pausedAt).toBeNull();

    // Verify tasks are marked autoComplete
    const tasks = await prisma.task.findMany({
      where: { taskId: { in: taskIds } },
    });
    expect(tasks.every(t => t.autoComplete)).toBe(true);
  });

  it('rejects starting a running session', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);
    await sessionMutations.startSession(null, { sessionId: session.id }, ctx);

    await expect(
      sessionMutations.startSession(null, { sessionId: session.id }, ctx),
    ).rejects.toThrow("Cannot start session with status 'running'");
  });

  it('rejects starting when another session is running', async () => {
    const session1 = await sessionMutations.createSession(null, { projectId, taskIds: [taskIds[0]], config: validConfig }, ctx);
    const session2 = await sessionMutations.createSession(null, { projectId, taskIds: [taskIds[1]], config: validConfig }, ctx);

    await sessionMutations.startSession(null, { sessionId: session1.id }, ctx);

    await expect(
      sessionMutations.startSession(null, { sessionId: session2.id }, ctx),
    ).rejects.toThrow('Another session is already running');
  });

  it('pauses a running session', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);
    await sessionMutations.startSession(null, { sessionId: session.id }, ctx);
    const paused = await sessionMutations.pauseSession(null, { sessionId: session.id }, ctx);

    expect(paused.status).toBe('paused');
    expect(paused.pausedAt).toBeTruthy();
  });

  it('rejects pausing a non-running session', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);

    await expect(
      sessionMutations.pauseSession(null, { sessionId: session.id }, ctx),
    ).rejects.toThrow("Cannot pause session with status 'draft'");
  });

  it('resumes a paused session', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);
    await sessionMutations.startSession(null, { sessionId: session.id }, ctx);
    await sessionMutations.pauseSession(null, { sessionId: session.id }, ctx);

    const resumed = await sessionMutations.startSession(null, { sessionId: session.id }, ctx);
    expect(resumed.status).toBe('running');
    expect(resumed.pausedAt).toBeNull();
  });

  it('cleans up archived tasks on resume', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);
    await sessionMutations.startSession(null, { sessionId: session.id }, ctx);
    await sessionMutations.pauseSession(null, { sessionId: session.id }, ctx);

    // Archive one task while paused
    await prisma.task.update({
      where: { taskId: taskIds[0] },
      data: { archived: true },
    });

    const resumed = await sessionMutations.startSession(null, { sessionId: session.id }, ctx);
    const resumedTaskIds = JSON.parse(resumed.taskIds) as string[];
    expect(resumedTaskIds).not.toContain(taskIds[0]);
    expect(resumedTaskIds).toHaveLength(2);

    // Archived task should have autoComplete cleared
    const archivedTask = await prisma.task.findUnique({ where: { taskId: taskIds[0] } });
    expect(archivedTask!.autoComplete).toBe(false);
  });

  it('cleans up deleted tasks on resume', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);
    await sessionMutations.startSession(null, { sessionId: session.id }, ctx);
    await sessionMutations.pauseSession(null, { sessionId: session.id }, ctx);

    // Delete one task while paused
    await prisma.task.delete({ where: { taskId: taskIds[2] } });

    const resumed = await sessionMutations.startSession(null, { sessionId: session.id }, ctx);
    const resumedTaskIds = JSON.parse(resumed.taskIds) as string[];
    expect(resumedTaskIds).not.toContain(taskIds[2]);
    expect(resumedTaskIds).toHaveLength(2);
  });

  it('cancels a running session and cancels action plans', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);
    await sessionMutations.startSession(null, { sessionId: session.id }, ctx);

    // Create a mock action plan for one task
    await prisma.taskActionPlan.create({
      data: {
        taskId: taskIds[0],
        orgId: org.orgId,
        createdById: user.userId,
        status: 'executing',
      },
    });

    const cancelled = await sessionMutations.cancelSession(null, { sessionId: session.id }, ctx);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.completedAt).toBeTruthy();

    // Verify action plan was cancelled
    const plan = await prisma.taskActionPlan.findFirst({ where: { taskId: taskIds[0] } });
    expect(plan!.status).toBe('cancelled');
  });

  it('rejects cancelling a completed session', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);
    // Manually set to completed
    await prisma.session.update({
      where: { id: session.id },
      data: { status: 'completed', completedAt: new Date() },
    });

    await expect(
      sessionMutations.cancelSession(null, { sessionId: session.id }, ctx),
    ).rejects.toThrow("Cannot cancel session with status 'completed'");
  });

  it('rejects cancelling an already cancelled session', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);
    await sessionMutations.startSession(null, { sessionId: session.id }, ctx);
    await sessionMutations.cancelSession(null, { sessionId: session.id }, ctx);

    await expect(
      sessionMutations.cancelSession(null, { sessionId: session.id }, ctx),
    ).rejects.toThrow("Cannot cancel session with status 'cancelled'");
  });
});

describe('Session auth isolation', () => {
  it('rejects start/pause/cancel from another org', async () => {
    const session = await sessionMutations.createSession(null, { projectId, taskIds, config: validConfig }, ctx);
    await sessionMutations.startSession(null, { sessionId: session.id }, ctx);

    const otherOrg = await prisma.org.create({ data: { name: 'Other Org' } });
    const otherUser = await prisma.user.create({
      data: { email: 'other@example.com', passwordHash: 'hashed', orgId: otherOrg.orgId, role: 'org:admin', emailVerifiedAt: new Date() },
    });
    const otherCtx = makeContext({ userId: otherUser.userId, email: otherUser.email, orgId: otherOrg.orgId, role: 'org:admin' });

    await expect(
      sessionMutations.pauseSession(null, { sessionId: session.id }, otherCtx),
    ).rejects.toThrow('Session not found');

    await expect(
      sessionMutations.cancelSession(null, { sessionId: session.id }, otherCtx),
    ).rejects.toThrow('Session not found');
  });
});

describe('Session config validation', () => {
  it('accepts all valid autonomy levels', async () => {
    for (const level of ['full', 'approve_external', 'approve_all']) {
      const session = await sessionMutations.createSession(null, {
        projectId,
        taskIds: [taskIds[0]],
        config: { autonomyLevel: level, failurePolicy: 'pause_immediately' },
      }, ctx);
      expect(JSON.parse(session.config).autonomyLevel).toBe(level);
    }
  });

  it('accepts all valid failure policies', async () => {
    for (const policy of ['retry_then_pause', 'pause_immediately', 'skip_and_continue']) {
      const session = await sessionMutations.createSession(null, {
        projectId,
        taskIds: [taskIds[0]],
        config: { autonomyLevel: 'full', failurePolicy: policy },
      }, ctx);
      expect(JSON.parse(session.config).failurePolicy).toBe(policy);
    }
  });
});
