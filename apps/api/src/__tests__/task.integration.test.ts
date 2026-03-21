import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { authMutations } from '../graphql/resolvers/auth.js';
import { taskMutations } from '../graphql/resolvers/task.js';
import type { Context } from '../graphql/context.js';
import { createLoaders } from '../graphql/loaders.js';

// ── Helpers ──

let orgId: string;
let userId: string;
let projectId: string;

function makeContext(): Context {
  return {
    user: { userId, email: 'task-test@example.com', orgId, role: 'org:admin', emailVerifiedAt: null },
    org: { orgId, name: 'Test Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, createdAt: new Date() },
    prisma,
    loaders: createLoaders(prisma, null),
  };
}

// ── Setup ──

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();

  // Create user + org + project
  await authMutations.signup(null, { email: 'task-test@example.com', password: 'Password123' }, {
    user: null, org: null, prisma, loaders: createLoaders(prisma, null),
  } as Context);

  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'task-test@example.com' } });
  const org = await prisma.org.create({ data: { name: 'Test Org' } });
  await prisma.user.update({ where: { userId: user.userId }, data: { orgId: org.orgId, role: 'org:admin' } });

  const project = await prisma.project.create({
    data: { name: 'Test Project', orgId: org.orgId, prompt: 'test' },
  });

  orgId = org.orgId;
  userId = user.userId;
  projectId = project.projectId;
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('createTask', () => {
  it('creates a task with correct defaults', async () => {
    const task = await taskMutations.createTask(null, { projectId, title: 'My Task' }, makeContext());
    expect(task.title).toBe('My Task');
    expect(task.status).toBe('todo');
    expect(task.projectId).toBe(projectId);
    expect(task.orgId).toBe(orgId);

    const dbTask = await prisma.task.findUnique({ where: { taskId: task.taskId } });
    expect(dbTask).not.toBeNull();
    expect(dbTask!.title).toBe('My Task');
  });

  it('rejects empty title', async () => {
    await expect(
      taskMutations.createTask(null, { projectId, title: '' }, makeContext()),
    ).rejects.toThrow();
  });
});

describe('updateTask', () => {
  it('updates task status', async () => {
    const task = await taskMutations.createTask(null, { projectId, title: 'Status Task' }, makeContext());
    const result = await taskMutations.updateTask(null, { taskId: task.taskId, status: 'in_progress' }, makeContext());
    expect(result.task.status).toBe('in_progress');
    expect(result.warnings).toEqual([]);
  });

  it('updates task title', async () => {
    const task = await taskMutations.createTask(null, { projectId, title: 'Old Title' }, makeContext());
    const result = await taskMutations.updateTask(null, { taskId: task.taskId, title: 'New Title' }, makeContext());
    expect(result.task.title).toBe('New Title');
  });

  it('updates task description', async () => {
    const task = await taskMutations.createTask(null, { projectId, title: 'Desc Task' }, makeContext());
    const result = await taskMutations.updateTask(null, { taskId: task.taskId, description: 'New desc' }, makeContext());
    expect(result.task.description).toBe('New desc');
  });
});

describe('archiveTask', () => {
  it('archives a task via updateTask', async () => {
    const task = await taskMutations.createTask(null, { projectId, title: 'Archive Me' }, makeContext());
    const result = await taskMutations.updateTask(null, { taskId: task.taskId, archived: true }, makeContext());
    expect(result.task.archived).toBe(true);

    const dbTask = await prisma.task.findUnique({ where: { taskId: task.taskId } });
    expect(dbTask!.archived).toBe(true);
  });
});

describe('bulkUpdateTasks', () => {
  it('bulk updates status for multiple tasks', async () => {
    const t1 = await taskMutations.createTask(null, { projectId, title: 'Bulk 1' }, makeContext());
    const t2 = await taskMutations.createTask(null, { projectId, title: 'Bulk 2' }, makeContext());
    const t3 = await taskMutations.createTask(null, { projectId, title: 'Bulk 3' }, makeContext());

    const result = await taskMutations.bulkUpdateTasks(
      null,
      { taskIds: [t1.taskId, t2.taskId, t3.taskId], status: 'done' },
      makeContext(),
    );

    expect(result).toHaveLength(3);
    for (const task of result) {
      expect(task.status).toBe('done');
    }
  });
});
