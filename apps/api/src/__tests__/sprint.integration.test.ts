import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { authMutations } from '../graphql/resolvers/auth.js';
import { sprintMutations } from '../graphql/resolvers/sprint.js';
import type { Context } from '../graphql/context.js';
import { createLoaders } from '../graphql/loaders.js';

// ── Helpers ──

let orgId: string;
let userId: string;
let projectId: string;

function makeContext(): Context {
  return {
    user: { userId, email: 'sprint-test@example.com', orgId, role: 'org:admin', emailVerifiedAt: null },
    org: { orgId, name: 'Test Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, createdAt: new Date() },
    prisma,
    loaders: createLoaders(prisma),
  };
}

// ── Setup ──

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();

  await authMutations.signup(null, { email: 'sprint-test@example.com', password: 'Password123' }, {
    user: null, org: null, prisma, loaders: createLoaders(prisma),
  } as Context);

  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'sprint-test@example.com' } });
  const org = await prisma.org.create({ data: { name: 'Test Org' } });
  await prisma.user.update({ where: { userId: user.userId }, data: { orgId: org.orgId, role: 'org:admin' } });

  const project = await prisma.project.create({
    data: { name: 'Sprint Test Project', orgId: org.orgId, prompt: 'test' },
  });

  orgId = org.orgId;
  userId = user.userId;
  projectId = project.projectId;
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('createSprint', () => {
  it('creates a sprint with correct defaults', async () => {
    const sprint = await sprintMutations.createSprint(null, { projectId, name: 'Sprint 1' }, makeContext());
    expect(sprint.name).toBe('Sprint 1');
    expect(sprint.projectId).toBe(projectId);
    expect(sprint.orgId).toBe(orgId);
    expect(sprint.isActive).toBe(false);
  });
});

describe('updateSprint', () => {
  it('activates a sprint', async () => {
    const sprint = await sprintMutations.createSprint(null, { projectId, name: 'Sprint A' }, makeContext());
    const updated = await sprintMutations.updateSprint(null, { sprintId: sprint.sprintId, isActive: true }, makeContext());
    expect(updated.isActive).toBe(true);
  });

  it('enforces single active sprint per project', async () => {
    const s1 = await sprintMutations.createSprint(null, { projectId, name: 'Sprint 1' }, makeContext());
    const s2 = await sprintMutations.createSprint(null, { projectId, name: 'Sprint 2' }, makeContext());

    // Activate sprint 1
    await sprintMutations.updateSprint(null, { sprintId: s1.sprintId, isActive: true }, makeContext());
    // Activate sprint 2 — should deactivate sprint 1
    await sprintMutations.updateSprint(null, { sprintId: s2.sprintId, isActive: true }, makeContext());

    const dbS1 = await prisma.sprint.findUnique({ where: { sprintId: s1.sprintId } });
    const dbS2 = await prisma.sprint.findUnique({ where: { sprintId: s2.sprintId } });
    expect(dbS1!.isActive).toBe(false);
    expect(dbS2!.isActive).toBe(true);
  });
});

describe('deleteSprint', () => {
  it('deletes a sprint and unlinks tasks', async () => {
    const sprint = await sprintMutations.createSprint(null, { projectId, name: 'Doomed Sprint' }, makeContext());

    // Create a task and assign it to the sprint
    const task = await prisma.task.create({
      data: {
        title: 'Sprint Task',
        status: 'todo',
        projectId,
        orgId,
        sprintId: sprint.sprintId,
        sprintColumn: 'To Do',
        position: 1,
      },
    });

    const result = await sprintMutations.deleteSprint(null, { sprintId: sprint.sprintId }, makeContext());
    expect(result).toBe(true);

    const dbSprint = await prisma.sprint.findUnique({ where: { sprintId: sprint.sprintId } });
    expect(dbSprint).toBeNull();

    // Task should be unlinked
    const dbTask = await prisma.task.findUnique({ where: { taskId: task.taskId } });
    expect(dbTask!.sprintId).toBeNull();
    expect(dbTask!.sprintColumn).toBeNull();
  });
});
