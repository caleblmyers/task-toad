import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { jwtVerify } from 'jose';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { authMutations } from '../graphql/resolvers/auth.js';
import { orgMutations } from '../graphql/resolvers/org.js';
import { projectMutations, projectQueries } from '../graphql/resolvers/project.js';
import { taskMutations, taskQueries } from '../graphql/resolvers/task.js';
import { sprintMutations } from '../graphql/resolvers/sprint.js';
import { JWT_SECRET, type Context } from '../graphql/context.js';
import { createLoaders } from '../graphql/loaders.js';

// ── Helpers ──

function noAuthContext(): Context {
  return { user: null, org: null, prisma, loaders: createLoaders(prisma, null) } as Context;
}

function makeContext(user: { userId: string; email: string; orgId: string; role: string }, orgName: string): Context {
  return {
    user: { ...user, emailVerifiedAt: new Date() },
    org: { orgId: user.orgId, name: orgName, anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, createdAt: new Date() },
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
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('E2E happy path: signup through export', () => {
  it('walks through the full user journey', async () => {
    const email = 'e2e@example.com';
    const password = 'SecurePass123';

    // 1. Signup
    const signupResult = await authMutations.signup(null, { email, password }, noAuthContext());
    expect(signupResult).toBe(true);

    // 2. Mark email as verified (skip email flow)
    await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });

    // 3. Login — get JWT token and verify it decodes
    const loginResult = await authMutations.login(null, { email, password }, noAuthContext());
    expect(loginResult).toHaveProperty('token');
    expect(typeof loginResult.token).toBe('string');

    const { payload } = await jwtVerify(loginResult.token, JWT_SECRET);
    expect(payload.email).toBe(email);
    const userId = payload.sub as string;

    // 4. Create org
    const userCtxNoOrg: Context = {
      user: { userId, email, orgId: null, role: null, emailVerifiedAt: new Date() },
      org: null,
      prisma,
      loaders: createLoaders(prisma, null),
    };
    const org = await orgMutations.createOrg(null, { name: 'E2E Org' }, userCtxNoOrg);
    expect(org).toHaveProperty('orgId');
    expect(org.name).toBe('E2E Org');

    // Verify user now has org:admin role
    const updatedUser = await prisma.user.findUniqueOrThrow({ where: { userId } });
    expect(updatedUser.orgId).toBe(org.orgId);
    expect(updatedUser.role).toBe('org:admin');

    const ctx = makeContext(
      { userId, email, orgId: org.orgId, role: 'org:admin' },
      'E2E Org',
    );

    // 5. Create project
    const project = await projectMutations.createProject(null, { name: 'E2E Project' }, ctx);
    expect(project.name).toBe('E2E Project');
    expect(project.orgId).toBe(org.orgId);
    expect(project.statuses).toBeDefined();

    // Verify project appears in list
    const projects = await projectQueries.projects(null, {}, ctx);
    expect(projects).toHaveLength(1);
    expect(projects[0].projectId).toBe(project.projectId);

    // 6. Create task
    const task = await taskMutations.createTask(
      null,
      { projectId: project.projectId, title: 'E2E Task', status: 'todo' },
      ctx,
    );
    expect(task.title).toBe('E2E Task');
    expect(task.status).toBe('todo');
    expect(task.projectId).toBe(project.projectId);

    // 7. Update task
    const updateResult = await taskMutations.updateTask(
      null,
      { taskId: task.taskId, status: 'in_progress', description: 'Updated via E2E test' },
      ctx,
    );
    expect(updateResult.task.status).toBe('in_progress');
    expect(updateResult.task.description).toBe('Updated via E2E test');

    // 8. Create comment
    const comment = await taskMutations.createComment(
      null,
      { taskId: task.taskId, content: 'E2E comment content' },
      ctx,
    );
    expect(comment).toHaveProperty('commentId');
    expect(comment.content).toBe('E2E comment content');

    // Allow fire-and-forget activity writes to settle
    await new Promise((r) => setTimeout(r, 100));

    // Verify activity was logged for the comment
    const activities = await taskQueries.activities(
      null,
      { taskId: task.taskId },
      ctx,
    );
    const commentActivity = activities.activities.find(
      (a: { action: string }) => a.action === 'comment.created',
    );
    expect(commentActivity).toBeDefined();

    // 9. Create sprint
    const sprint = await sprintMutations.createSprint(
      null,
      { projectId: project.projectId, name: 'Sprint 1', columns: '["To Do","In Progress","Done"]' },
      ctx,
    );
    expect(sprint.name).toBe('Sprint 1');
    expect(sprint.projectId).toBe(project.projectId);

    // 10. Assign task to sprint
    const sprintResult = await taskMutations.updateTask(
      null,
      { taskId: task.taskId, sprintId: sprint.sprintId },
      ctx,
    );
    expect(sprintResult.task.sprintId).toBe(sprint.sprintId);

    // 11. Verify export data (query DB directly to check exportable state)
    const exportProject = await prisma.project.findUnique({
      where: { projectId: project.projectId },
    });
    expect(exportProject).not.toBeNull();

    const exportTasks = await prisma.task.findMany({
      where: { projectId: project.projectId },
      include: {
        labels: { include: { label: true } },
        comments: { include: { user: { select: { email: true } } } },
        assignee: { select: { email: true } },
      },
    });
    expect(exportTasks).toHaveLength(1);
    expect(exportTasks[0].title).toBe('E2E Task');
    expect(exportTasks[0].sprintId).toBe(sprint.sprintId);
    expect(exportTasks[0].comments).toHaveLength(1);
    expect(exportTasks[0].comments[0].content).toBe('E2E comment content');

    const exportSprints = await prisma.sprint.findMany({
      where: { projectId: project.projectId },
    });
    expect(exportSprints).toHaveLength(1);
    expect(exportSprints[0].name).toBe('Sprint 1');
  });
});

describe('E2E authorization boundaries: tenant isolation', () => {
  it('prevents cross-org access to projects and tasks', async () => {
    // Set up org 1
    await authMutations.signup(null, { email: 'org1@example.com', password: 'Password1' }, noAuthContext());
    const user1 = await prisma.user.findUniqueOrThrow({ where: { email: 'org1@example.com' } });
    const org1 = await prisma.org.create({ data: { name: 'Org 1' } });
    await prisma.user.update({ where: { userId: user1.userId }, data: { orgId: org1.orgId, role: 'org:admin' } });

    const ctx1 = makeContext(
      { userId: user1.userId, email: 'org1@example.com', orgId: org1.orgId, role: 'org:admin' },
      'Org 1',
    );

    // Create project and task in org 1
    const project1 = await projectMutations.createProject(null, { name: 'Org1 Project' }, ctx1);
    const task1 = await taskMutations.createTask(
      null,
      { projectId: project1.projectId, title: 'Org1 Task' },
      ctx1,
    );

    // Set up org 2
    await authMutations.signup(null, { email: 'org2@example.com', password: 'Password2' }, noAuthContext());
    const user2 = await prisma.user.findUniqueOrThrow({ where: { email: 'org2@example.com' } });
    const org2 = await prisma.org.create({ data: { name: 'Org 2' } });
    await prisma.user.update({ where: { userId: user2.userId }, data: { orgId: org2.orgId, role: 'org:admin' } });

    const ctx2 = makeContext(
      { userId: user2.userId, email: 'org2@example.com', orgId: org2.orgId, role: 'org:admin' },
      'Org 2',
    );

    // Org 2 cannot see org 1's project
    const project1FromOrg2 = await projectQueries.project(
      null,
      { projectId: project1.projectId },
      ctx2,
    );
    expect(project1FromOrg2).toBeNull();

    // Org 2 cannot list org 1's projects
    const org2Projects = await projectQueries.projects(null, {}, ctx2);
    expect(org2Projects).toHaveLength(0);

    // Org 2 cannot update org 1's task
    await expect(
      taskMutations.updateTask(null, { taskId: task1.taskId, title: 'Hacked' }, ctx2),
    ).rejects.toThrow();

    // Org 2 cannot create tasks in org 1's project
    await expect(
      taskMutations.createTask(null, { projectId: project1.projectId, title: 'Injected' }, ctx2),
    ).rejects.toThrow();

    // Org 2 cannot comment on org 1's tasks
    await expect(
      taskMutations.createComment(null, { taskId: task1.taskId, content: 'Spying' }, ctx2),
    ).rejects.toThrow();

    // Org 2 cannot add themselves as assignee to org 1's task
    await expect(
      taskMutations.addTaskAssignee(null, { taskId: task1.taskId, userId: user2.userId }, ctx2),
    ).rejects.toThrow();
  });
});
