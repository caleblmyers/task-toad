import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { authMutations } from '../graphql/resolvers/auth.js';
import { generationMutations } from '../graphql/resolvers/ai/generation.js';
import type { Context } from '../graphql/context.js';
import { createLoaders } from '../graphql/loaders.js';

// ── Helpers ──

let orgId: string;
let userId: string;
let projectId: string;

function makeContext(): Context {
  return {
    user: { userId, email: 'plan-test@example.com', orgId, role: 'org:admin', emailVerifiedAt: null },
    org: { orgId, name: 'Test Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, plan: 'free', createdAt: new Date(), trialEndsAt: null, stripeCustomerId: null, stripeSubscriptionId: null },
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

  await authMutations.signup(null, { email: 'plan-test@example.com', password: 'Password123' }, {
    user: null, org: null, prisma, loaders: createLoaders(prisma, null),
  } as Context);

  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'plan-test@example.com' } });
  const org = await prisma.org.create({ data: { name: 'Test Org' } });
  await prisma.user.update({ where: { userId: user.userId }, data: { orgId: org.orgId, role: 'org:admin' } });

  const project = await prisma.project.create({
    data: { name: 'Plan Test Project', orgId: org.orgId, prompt: 'test' },
  });

  orgId = org.orgId;
  userId = user.userId;
  projectId = project.projectId;
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('commitHierarchicalPlan', () => {
  it('creates epic/task/subtask hierarchy', async () => {
    const result = await generationMutations.commitHierarchicalPlan(
      null,
      {
        projectId,
        epics: [
          {
            title: 'Auth Epic',
            description: 'Authentication system',
            priority: 'high',
            tasks: [
              {
                title: 'Login page',
                description: 'Build login form',
                subtasks: [
                  { title: 'Email input', description: 'Add email field' },
                  { title: 'Password input', description: 'Add password field' },
                ],
              },
              {
                title: 'Token refresh',
                description: 'Handle token rotation',
              },
            ],
          },
        ],
      },
      makeContext(),
    );

    expect(result.length).toBe(5); // 1 epic + 2 tasks + 2 subtasks

    const epic = result.find((t: { taskType: string }) => t.taskType === 'epic');
    expect(epic).toBeDefined();
    expect(epic!.title).toBe('Auth Epic');
    expect(epic!.parentTaskId).toBeNull();

    const tasks = result.filter((t: { parentTaskId: string | null }) => t.parentTaskId === epic!.taskId);
    expect(tasks.length).toBe(2);

    const loginTask = tasks.find((t: { title: string }) => t.title === 'Login page');
    expect(loginTask).toBeDefined();

    const subtasks = result.filter((t: { parentTaskId: string | null }) => t.parentTaskId === loginTask!.taskId);
    expect(subtasks.length).toBe(2);
  });

  it('creates dependencies between tasks', async () => {
    await generationMutations.commitHierarchicalPlan(
      null,
      {
        projectId,
        epics: [
          {
            title: 'Backend Epic',
            description: 'API work',
            tasks: [
              {
                title: 'Database schema',
                description: 'Create schema',
              },
              {
                title: 'API endpoints',
                description: 'Build endpoints',
                dependsOn: [{ title: 'Database schema', linkType: 'blocks' }],
              },
            ],
          },
        ],
      },
      makeContext(),
    );

    const schemaTask = await prisma.task.findFirst({ where: { title: 'Database schema', projectId } });
    const apiTask = await prisma.task.findFirst({ where: { title: 'API endpoints', projectId } });
    expect(schemaTask).toBeDefined();
    expect(apiTask).toBeDefined();

    const dep = await prisma.taskDependency.findFirst({
      where: { sourceTaskId: schemaTask!.taskId, targetTaskId: apiTask!.taskId },
    });
    expect(dep).toBeDefined();
    expect(dep!.linkType).toBe('blocks');
  });

  it('sets autoComplete flag on tasks', async () => {
    const result = await generationMutations.commitHierarchicalPlan(
      null,
      {
        projectId,
        epics: [
          {
            title: 'Auto Epic',
            description: 'Automated work',
            autoComplete: true,
            tasks: [
              {
                title: 'Auto Task',
                description: 'Should auto-complete',
                autoComplete: true,
              },
              {
                title: 'Manual Task',
                description: 'No auto-complete',
                autoComplete: false,
              },
            ],
          },
        ],
      },
      makeContext(),
    );

    const autoEpic = result.find((t: { title: string }) => t.title === 'Auto Epic');
    const autoTask = result.find((t: { title: string }) => t.title === 'Auto Task');
    const manualTask = result.find((t: { title: string }) => t.title === 'Manual Task');

    expect(autoEpic!.autoComplete).toBe(true);
    expect(autoTask!.autoComplete).toBe(true);
    expect(manualTask!.autoComplete).toBe(false);
  });

  it('handles empty epics array gracefully', async () => {
    const result = await generationMutations.commitHierarchicalPlan(
      null,
      { projectId, epics: [] },
      makeContext(),
    );
    expect(result.length).toBe(0);
  });

  it('clears existing tasks when clearExisting is true', async () => {
    // Create initial tasks
    await generationMutations.commitHierarchicalPlan(
      null,
      {
        projectId,
        epics: [{ title: 'Old Epic', description: 'Will be deleted' }],
      },
      makeContext(),
    );

    const beforeCount = await prisma.task.count({ where: { projectId } });
    expect(beforeCount).toBe(1);

    // Commit with clearExisting
    await generationMutations.commitHierarchicalPlan(
      null,
      {
        projectId,
        epics: [{ title: 'New Epic', description: 'Replacement' }],
        clearExisting: true,
      },
      makeContext(),
    );

    const afterTasks = await prisma.task.findMany({ where: { projectId } });
    expect(afterTasks.length).toBe(1);
    expect(afterTasks[0].title).toBe('New Epic');
  });
});
