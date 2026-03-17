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
import { requireOrgUser, requireProjectField } from '../utils/resolverHelpers.js';

// ── Shared state for two separate orgs ──

let org1Id: string;
let user1Id: string;
let project1Id: string;

let org2Id: string;
let user2Id: string;
let _project2Id: string;

function makeContext1(): Context {
  return {
    user: { userId: user1Id, email: 'user1@example.com', orgId: org1Id, role: 'org:admin', emailVerifiedAt: null },
    org: { orgId: org1Id, name: 'Org 1', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80 },
    prisma,
    loaders: createLoaders(prisma),
  };
}

function makeContext2(): Context {
  return {
    user: { userId: user2Id, email: 'user2@example.com', orgId: org2Id, role: 'org:admin', emailVerifiedAt: null },
    org: { orgId: org2Id, name: 'Org 2', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80 },
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

  const noAuthCtx = { user: null, org: null, prisma, loaders: createLoaders(prisma) } as Context;

  // Create user 1 via signup
  await authMutations.signup(null, { email: 'user1@example.com', password: 'Password1' }, noAuthCtx);
  const dbUser1 = await prisma.user.findUniqueOrThrow({ where: { email: 'user1@example.com' } });
  const org1 = await prisma.org.create({ data: { name: 'Org 1' } });
  await prisma.user.update({ where: { userId: dbUser1.userId }, data: { orgId: org1.orgId, role: 'org:admin' } });
  org1Id = org1.orgId;
  user1Id = dbUser1.userId;

  const proj1 = await prisma.project.create({ data: { name: 'Project 1', orgId: org1.orgId, prompt: 'test' } });
  project1Id = proj1.projectId;

  // Create user 2 via signup
  await authMutations.signup(null, { email: 'user2@example.com', password: 'Password2' }, noAuthCtx);
  const dbUser2 = await prisma.user.findUniqueOrThrow({ where: { email: 'user2@example.com' } });
  const org2 = await prisma.org.create({ data: { name: 'Org 2' } });
  await prisma.user.update({ where: { userId: dbUser2.userId }, data: { orgId: org2.orgId, role: 'org:admin' } });
  org2Id = org2.orgId;
  user2Id = dbUser2.userId;

  const proj2 = await prisma.project.create({ data: { name: 'Project 2', orgId: org2.orgId, prompt: 'test' } });
  _project2Id = proj2.projectId;
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('Cross-org authorization boundaries', () => {
  it('addTaskAssignee rejects cross-org user via requireOrgUser', async () => {
    // Create a task in org1
    const task = await taskMutations.createTask(null, { projectId: project1Id, title: 'Org1 Task' }, makeContext1());

    // Try to add user2 (org2) as assignee via org1 context — should throw
    await expect(
      taskMutations.addTaskAssignee(null, { taskId: task.taskId, userId: user2Id }, makeContext1()),
    ).rejects.toThrow('Target user is not a member of your organization');
  });

  it('updateTask rejects cross-org assigneeId', async () => {
    const task = await taskMutations.createTask(null, { projectId: project1Id, title: 'Assign Task' }, makeContext1());

    // Try to set assigneeId to user2 from org2
    await expect(
      taskMutations.updateTask(null, { taskId: task.taskId, assigneeId: user2Id }, makeContext1()),
    ).rejects.toThrow('Target user is not a member of your organization');
  });

  it('setCustomFieldValue rejects cross-project custom field via requireProjectField', async () => {
    // Create custom field in org2's project
    const field = await prisma.customField.create({
      data: {
        orgId: org2Id,
        projectId: _project2Id,
        name: 'Org2 Field',
        fieldType: 'TEXT',
        position: 1,
      },
    });

    // Create task in org1
    const task = await taskMutations.createTask(null, { projectId: project1Id, title: 'CF Task' }, makeContext1());

    // Try to set the cross-project field on org1's task
    await expect(
      taskMutations.setCustomFieldValue(null, { taskId: task.taskId, customFieldId: field.customFieldId, value: 'hack' }, makeContext1()),
    ).rejects.toThrow("Custom field does not belong to this task's project");
  });

  it('deleteComment from different org throws NotFound', async () => {
    // Create task + comment in org1
    const task = await taskMutations.createTask(null, { projectId: project1Id, title: 'Comment Task' }, makeContext1());
    const comment = await taskMutations.createComment(null, { taskId: task.taskId, content: 'Hello' }, makeContext1());

    // Try to delete the comment using org2 context — should throw
    await expect(
      taskMutations.deleteComment(null, { commentId: comment.commentId }, makeContext2()),
    ).rejects.toThrow('Comment not found');
  });

  it('requireOrgUser throws for a userId not in the caller org', async () => {
    // Direct test of the helper
    await expect(
      requireOrgUser(makeContext1(), user2Id),
    ).rejects.toThrow('Target user is not a member of your organization');
  });

  it('requireProjectField throws for a field in a different project', async () => {
    // Create a field in org1, project1
    const field = await prisma.customField.create({
      data: {
        orgId: org1Id,
        projectId: project1Id,
        name: 'Field A',
        fieldType: 'NUMBER',
        position: 1,
      },
    });

    // Create a second project in org1
    const proj1b = await prisma.project.create({ data: { name: 'Project 1b', orgId: org1Id, prompt: 'test' } });

    // Field from project1 should fail for project1b
    await expect(
      requireProjectField(makeContext1(), field.customFieldId, proj1b.projectId),
    ).rejects.toThrow("Custom field does not belong to this task's project");
  });
});

describe('Automation engine cross-org boundary', () => {
  it('assign_to silently skips when target user is in different org', async () => {
    // Create a task in org1
    const task = await taskMutations.createTask(null, { projectId: project1Id, title: 'Auto Task' }, makeContext1());

    // Create an automation rule that assigns to user2 (cross-org)
    await prisma.automationRule.create({
      data: {
        projectId: project1Id,
        orgId: org1Id,
        name: 'Cross-org assign',
        trigger: JSON.stringify({ event: 'task.status_changed', condition: { newStatus: 'in_progress' } }),
        action: JSON.stringify({ type: 'assign_to', userId: user2Id }),
        enabled: true,
      },
    });

    // Update task status to trigger automation
    await taskMutations.updateTask(null, { taskId: task.taskId, status: 'in_progress' }, makeContext1());

    // Wait briefly for the fire-and-forget automation to complete
    await new Promise((r) => setTimeout(r, 200));

    // The task should NOT be assigned to user2
    const updated = await prisma.task.findUnique({ where: { taskId: task.taskId } });
    expect(updated!.assigneeId).toBeNull();
  });
});
