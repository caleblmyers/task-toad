import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { authMutations } from '../graphql/resolvers/auth.js';
import { taskMutations, taskQueries } from '../graphql/resolvers/task.js';
import { searchMutations } from '../graphql/resolvers/search.js';
import type { Context } from '../graphql/context.js';
import { createLoaders } from '../graphql/loaders.js';

// ── Helpers ──

let orgId: string;
let userId: string;
let projectId: string;

const noAuthCtx = () => ({ user: null, org: null, prisma, loaders: createLoaders(prisma, null) }) as Context;

function makeContext(overrides?: { userId?: string; email?: string }): Context {
  return {
    user: {
      userId: overrides?.userId ?? userId,
      email: overrides?.email ?? 'lifecycle@example.com',
      orgId,
      role: 'org:admin',
      emailVerifiedAt: null,
    },
    org: { orgId, name: 'Test Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, createdAt: new Date() },
    prisma,
    loaders: createLoaders(prisma, null),
  };
}

async function createOrgUser(email: string): Promise<string> {
  await authMutations.signup(null, { email, password: 'Password123' }, noAuthCtx());
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.user.update({ where: { userId: user.userId }, data: { orgId, role: 'org:member' } });
  return user.userId;
}

// ── Setup ──

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();

  // Create user + org + project
  await authMutations.signup(null, { email: 'lifecycle@example.com', password: 'Password123' }, noAuthCtx());
  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'lifecycle@example.com' } });
  const org = await prisma.org.create({ data: { name: 'Test Org' } });
  await prisma.user.update({ where: { userId: user.userId }, data: { orgId: org.orgId, role: 'org:admin' } });

  const project = await prisma.project.create({
    data: { name: 'Lifecycle Project', orgId: org.orgId, prompt: 'test' },
  });

  orgId = org.orgId;
  userId = user.userId;
  projectId = project.projectId;
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('Labels flow', () => {
  it('creates, assigns, queries, and removes labels from tasks', async () => {
    const ctx = makeContext();

    // Create a label (org-scoped, not project-scoped)
    const label = await searchMutations.createLabel(
      null,
      { name: 'Bug', color: '#FF0000' },
      ctx,
    );
    expect(label.name).toBe('Bug');
    expect(label.color).toBe('#FF0000');

    // Create a task
    const task = await taskMutations.createTask(null, { projectId, title: 'Label Task' }, ctx);

    // Add label to task
    const addResult = await searchMutations.addTaskLabel(
      null,
      { taskId: task.taskId, labelId: label.labelId },
      ctx,
    );
    expect(addResult).toBeDefined();

    // Query task labels via DB
    const taskWithLabels = await prisma.task.findUnique({
      where: { taskId: task.taskId },
      include: { labels: { include: { label: true } } },
    });
    expect(taskWithLabels!.labels).toHaveLength(1);
    expect(taskWithLabels!.labels[0].label.name).toBe('Bug');

    // Remove label from task (returns the task, not boolean)
    const removeResult = await searchMutations.removeTaskLabel(
      null,
      { taskId: task.taskId, labelId: label.labelId },
      ctx,
    );
    expect(removeResult).toBeDefined();

    // Verify removal
    const taskAfterRemove = await prisma.task.findUnique({
      where: { taskId: task.taskId },
      include: { labels: { include: { label: true } } },
    });
    expect(taskAfterRemove!.labels).toHaveLength(0);
  });
});

describe('Multi-assignee flow', () => {
  it('adds and removes multiple assignees from a task', async () => {
    const ctx = makeContext();

    // Create 2 additional users in the same org
    const user2Id = await createOrgUser('user2@example.com');
    const user3Id = await createOrgUser('user3@example.com');

    // Create a task
    const task = await taskMutations.createTask(null, { projectId, title: 'Multi-assignee Task' }, ctx);

    // Add both users as assignees
    const assignee1 = await taskMutations.addTaskAssignee(null, { taskId: task.taskId, userId: user2Id }, ctx);
    expect(assignee1).toHaveProperty('id');
    expect(assignee1.user.userId).toBe(user2Id);

    const assignee2 = await taskMutations.addTaskAssignee(null, { taskId: task.taskId, userId: user3Id }, ctx);
    expect(assignee2).toHaveProperty('id');
    expect(assignee2.user.userId).toBe(user3Id);

    // Verify both assignees present
    const taskAssignees = await prisma.taskAssignee.findMany({
      where: { taskId: task.taskId },
      include: { user: true },
    });
    expect(taskAssignees).toHaveLength(2);
    const assigneeIds = taskAssignees.map((a) => a.userId).sort();
    expect(assigneeIds).toEqual([user2Id, user3Id].sort());

    // Remove one assignee
    const removed = await taskMutations.removeTaskAssignee(null, { taskId: task.taskId, userId: user2Id }, ctx);
    expect(removed).toBe(true);

    // Verify only user3 remains
    const remainingAssignees = await prisma.taskAssignee.findMany({
      where: { taskId: task.taskId },
    });
    expect(remainingAssignees).toHaveLength(1);
    expect(remainingAssignees[0].userId).toBe(user3Id);
  });
});

describe('Custom fields', () => {
  it('creates, sets values, updates, and deletes custom fields', async () => {
    const ctx = makeContext();

    // Create a custom field
    const field = await taskMutations.createCustomField(
      null,
      { projectId, name: 'Priority Level', fieldType: 'TEXT' },
      ctx,
    );
    expect(field.name).toBe('Priority Level');
    expect(field.fieldType).toBe('TEXT');

    // Create a task
    const task = await taskMutations.createTask(null, { projectId, title: 'CF Task' }, ctx);

    // Set custom field value
    const cfValue = await taskMutations.setCustomFieldValue(
      null,
      { taskId: task.taskId, customFieldId: field.customFieldId, value: 'High' },
      ctx,
    );
    expect(cfValue.value).toBe('High');

    // Query custom field values from DB
    const dbValues = await prisma.customFieldValue.findMany({
      where: { taskId: task.taskId },
    });
    expect(dbValues).toHaveLength(1);
    expect(dbValues[0].value).toBe('High');

    // Query custom fields for the project
    const fields = await taskQueries.customFields(null, { projectId }, ctx);
    expect(fields).toHaveLength(1);
    expect(fields[0].name).toBe('Priority Level');

    // Update custom field name
    const updatedField = await taskMutations.updateCustomField(
      null,
      { customFieldId: field.customFieldId, name: 'Urgency' },
      ctx,
    );
    expect(updatedField.name).toBe('Urgency');

    // Delete custom field
    const deleted = await taskMutations.deleteCustomField(
      null,
      { customFieldId: field.customFieldId },
      ctx,
    );
    expect(deleted).toBe(true);

    // Verify deletion
    const remainingFields = await taskQueries.customFields(null, { projectId }, ctx);
    expect(remainingFields).toHaveLength(0);
  });
});

describe('Bulk update', () => {
  it('bulk updates status for multiple tasks', async () => {
    const ctx = makeContext();

    // Create 3 tasks
    const t1 = await taskMutations.createTask(null, { projectId, title: 'Bulk 1' }, ctx);
    const t2 = await taskMutations.createTask(null, { projectId, title: 'Bulk 2' }, ctx);
    const t3 = await taskMutations.createTask(null, { projectId, title: 'Bulk 3' }, ctx);

    // Bulk update to done
    const result = await taskMutations.bulkUpdateTasks(
      null,
      { taskIds: [t1.taskId, t2.taskId, t3.taskId], status: 'done' },
      ctx,
    );

    expect(result).toHaveLength(3);
    for (const task of result) {
      expect(task.status).toBe('done');
    }

    // Verify in DB
    const dbTasks = await prisma.task.findMany({
      where: { taskId: { in: [t1.taskId, t2.taskId, t3.taskId] } },
    });
    for (const task of dbTasks) {
      expect(task.status).toBe('done');
    }
  });
});

describe('Subtask', () => {
  it('creates a subtask with parentTaskId set', async () => {
    const ctx = makeContext();

    // Create parent task
    const parent = await taskMutations.createTask(null, { projectId, title: 'Parent Task' }, ctx);

    // Create subtask
    const subtask = await taskMutations.createSubtask(
      null,
      { parentTaskId: parent.taskId, title: 'Subtask 1' },
      ctx,
    );
    expect(subtask.title).toBe('Subtask 1');
    expect(subtask.parentTaskId).toBe(parent.taskId);
    expect(subtask.projectId).toBe(projectId);

    // Verify parent's children
    const children = await prisma.task.findMany({
      where: { parentTaskId: parent.taskId },
    });
    expect(children).toHaveLength(1);
    expect(children[0].taskId).toBe(subtask.taskId);

    // Create a second subtask
    const subtask2 = await taskMutations.createSubtask(
      null,
      { parentTaskId: parent.taskId, title: 'Subtask 2' },
      ctx,
    );

    const allChildren = await prisma.task.findMany({
      where: { parentTaskId: parent.taskId },
    });
    expect(allChildren).toHaveLength(2);
    expect(allChildren.map((c) => c.taskId).sort()).toEqual([subtask.taskId, subtask2.taskId].sort());
  });
});

describe('Activity audit', () => {
  it('records activity entries for task and comment operations', async () => {
    const ctx = makeContext();

    // Create task (should log task.created)
    const task = await taskMutations.createTask(null, { projectId, title: 'Audit Task' }, ctx);

    // Update task status (should log task.updated)
    await taskMutations.updateTask(null, { taskId: task.taskId, status: 'in_progress' }, ctx);

    // Create comment (should log comment.created)
    await taskMutations.createComment(null, { taskId: task.taskId, content: 'Audit comment' }, ctx);

    // Allow fire-and-forget activity writes to settle
    await new Promise((r) => setTimeout(r, 100));

    // Query activities for this task
    const result = await taskQueries.activities(null, { taskId: task.taskId }, ctx);
    const actions = result.activities.map((a: { action: string }) => a.action);

    expect(actions).toContain('task.created');
    expect(actions).toContain('task.updated');
    expect(actions).toContain('comment.created');

    // Verify status change is captured in field/oldValue/newValue
    const statusUpdate = result.activities.find(
      (a: { action: string; field: string | null }) => a.action === 'task.updated' && a.field === 'status',
    );
    expect(statusUpdate).toBeDefined();
    expect(statusUpdate!.oldValue).toBe('todo');
    expect(statusUpdate!.newValue).toBe('in_progress');
  });
});
