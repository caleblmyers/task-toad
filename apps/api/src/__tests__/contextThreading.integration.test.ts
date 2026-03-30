import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';

/**
 * Context threading integration tests.
 *
 * These test the three context threading mechanisms by setting up
 * the required DB state and running the same queries/logic used
 * by the action executor (actionExecutor.ts):
 *
 * 1. previousStepContext — summaries from completed actions in the same plan
 * 2. upstreamTaskContext — completion summaries from dependency tasks
 * 3. failureContext — context from a previous failed attempt
 */

// ── Helpers ──

let orgId: string;
let userId: string;
let projectId: string;

async function createTaskInProject(title: string, overrides: Record<string, unknown> = {}) {
  const task = await prisma.task.create({
    data: { title, projectId, orgId, status: 'todo', ...overrides },
  });
  return task;
}

async function createPlanWithActions(
  taskId: string,
  actions: Array<{ actionType: string; label: string; position: number; status: string; result?: string }>,
) {
  const plan = await prisma.taskActionPlan.create({
    data: {
      taskId,
      orgId,
      createdById: userId,
      status: 'executing',
    },
  });
  for (const action of actions) {
    await prisma.taskAction.create({
      data: {
        planId: plan.id,
        actionType: action.actionType,
        label: action.label,
        config: '{}',
        position: action.position,
        status: action.status,
        result: action.result ?? null,
      },
    });
  }
  return plan;
}

/**
 * Replicates the previousStepContext logic from actionExecutor.ts lines 169-196
 */
async function buildPreviousStepContext(planId: string, currentPosition: number): Promise<string | undefined> {
  const previousActions = await prisma.taskAction.findMany({
    where: { planId, status: 'completed', position: { lt: currentPosition } },
    orderBy: { position: 'asc' },
  });
  const previousSummaries: string[] = [];
  for (const prev of previousActions) {
    if (prev.result) {
      try {
        const parsed = JSON.parse(prev.result) as Record<string, unknown>;
        const summary = (parsed.summary as string) || '';
        const files =
          (parsed.files as Array<{ path: string }>) ||
          (parsed.data as { files?: Array<{ path: string }> } | undefined)?.files ||
          [];
        if (summary || files.length > 0) {
          const fileList = files.map((f: { path: string }) => f.path).join(', ');
          previousSummaries.push(
            `Step "${prev.label}" (${prev.actionType}): ${summary}${fileList ? ` [Files: ${fileList}]` : ''}`,
          );
        }
      } catch {
        // ignore parse errors
      }
    }
  }
  return previousSummaries.length > 0 ? previousSummaries.join('\n') : undefined;
}

/**
 * Replicates the upstreamTaskContext logic from actionExecutor.ts lines 233-274
 */
async function buildUpstreamTaskContext(taskId: string): Promise<string | undefined> {
  const upstreamRows = await prisma.$queryRaw<
    Array<{ title: string; completion_summary: string | null; status: string }>
  >`
    SELECT t.title, t.completion_summary, t.status
    FROM task_dependencies td
    JOIN tasks t ON t.task_id = td.source_task_id
    WHERE td.target_task_id = ${taskId}
      AND td.link_type IN ('blocks', 'informs')
      AND t.status = 'done'
      AND t.completion_summary IS NOT NULL
  `;

  const completedUpstream = upstreamRows.map((row) => {
    const summary = JSON.parse(row.completion_summary!) as Record<string, unknown>;
    const filesChanged = (summary.filesChanged as string[]) || [];
    const filesSection = filesChanged.length > 0
      ? `Files changed:\n${filesChanged.map((f: string) => `  - ${f}`).join('\n')}\n`
      : '';
    const apiContracts = summary.apiContracts
      ? `API contracts:\n${JSON.stringify(summary.apiContracts, null, 2)}\n`
      : '';
    return (
      `## Upstream: ${row.title}\n` +
      `What was built: ${(summary.whatWasBuilt as string) || 'N/A'}\n` +
      filesSection +
      apiContracts +
      (summary.keyDecisions ? `Key decisions: ${((summary.keyDecisions as string[]) || []).join('; ')}\n` : '') +
      (summary.dependencyInfo ? `Note: ${summary.dependencyInfo as string}\n` : '')
    );
  });

  return completedUpstream.length > 0 ? completedUpstream.join('\n') : undefined;
}

/**
 * Replicates the failureContext logic from actionExecutor.ts lines 276-291
 */
async function buildFailureContext(actionId: string): Promise<string | undefined> {
  const previousAttempt = await prisma.taskAction.findUnique({
    where: { id: actionId },
    select: { result: true },
  });
  if (previousAttempt?.result) {
    try {
      const parsed = JSON.parse(previousAttempt.result) as Record<string, unknown>;
      if (parsed.failed) {
        return `Previous attempt failed: ${parsed.error}${parsed.errorCode ? `. Error code: ${parsed.errorCode}` : ''}. Avoid the same approach.`;
      }
    } catch {
      // ignore parse errors
    }
  }
  return undefined;
}

// ── Setup ──

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();

  const org = await prisma.org.create({ data: { name: 'Test Org' } });
  orgId = org.orgId;
  const dbUser = await prisma.user.create({
    data: {
      email: 'test@example.com',
      passwordHash: 'hashed',
      orgId,
      role: 'org:admin',
      emailVerifiedAt: new Date(),
    },
  });
  userId = dbUser.userId;
  const project = await prisma.project.create({
    data: { name: 'Test Project', orgId },
  });
  projectId = project.projectId;
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('previousStepContext', () => {
  it('builds context from completed actions before current position', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      {
        actionType: 'generate_code',
        label: 'Generate API endpoints',
        position: 0,
        status: 'completed',
        result: JSON.stringify({
          summary: 'Created REST endpoints for users',
          files: [{ path: 'src/routes/users.ts' }, { path: 'src/models/user.ts' }],
        }),
      },
      {
        actionType: 'create_pr',
        label: 'Create pull request',
        position: 1,
        status: 'completed',
        result: JSON.stringify({
          summary: 'PR #42 created',
        }),
      },
      {
        actionType: 'review_pr',
        label: 'Review pull request',
        position: 2,
        status: 'pending',
      },
    ]);

    // Building context for position 2 should include steps 0 and 1
    const context = await buildPreviousStepContext(plan.id, 2);
    expect(context).toBeDefined();
    expect(context).toContain('Generate API endpoints');
    expect(context).toContain('generate_code');
    expect(context).toContain('Created REST endpoints for users');
    expect(context).toContain('src/routes/users.ts');
    expect(context).toContain('src/models/user.ts');
    expect(context).toContain('Create pull request');
    expect(context).toContain('PR #42 created');
  });

  it('returns undefined when no previous completed actions exist', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      { actionType: 'generate_code', label: 'Generate code', position: 0, status: 'pending' },
    ]);

    const context = await buildPreviousStepContext(plan.id, 0);
    expect(context).toBeUndefined();
  });

  it('skips actions with no summary or files', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      {
        actionType: 'manual_step',
        label: 'Manual approval',
        position: 0,
        status: 'completed',
        result: JSON.stringify({ approved: true }),
      },
      { actionType: 'generate_code', label: 'Generate code', position: 1, status: 'pending' },
    ]);

    const context = await buildPreviousStepContext(plan.id, 1);
    expect(context).toBeUndefined();
  });

  it('skips failed actions (only includes completed)', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      {
        actionType: 'generate_code',
        label: 'Failed attempt',
        position: 0,
        status: 'failed',
        result: JSON.stringify({ summary: 'Should not appear', files: [{ path: 'x.ts' }] }),
      },
      { actionType: 'generate_code', label: 'Retry', position: 1, status: 'pending' },
    ]);

    const context = await buildPreviousStepContext(plan.id, 1);
    expect(context).toBeUndefined();
  });

  it('handles files nested under data.files', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      {
        actionType: 'generate_code',
        label: 'Generate code',
        position: 0,
        status: 'completed',
        result: JSON.stringify({
          data: { files: [{ path: 'src/index.ts' }], summary: 'Generated entry point' },
        }),
      },
      { actionType: 'create_pr', label: 'Create PR', position: 1, status: 'pending' },
    ]);

    const context = await buildPreviousStepContext(plan.id, 1);
    expect(context).toBeDefined();
    expect(context).toContain('src/index.ts');
  });

  it('handles malformed JSON in result gracefully', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      {
        actionType: 'generate_code',
        label: 'Generate code',
        position: 0,
        status: 'completed',
        result: 'not valid json',
      },
      { actionType: 'create_pr', label: 'Create PR', position: 1, status: 'pending' },
    ]);

    const context = await buildPreviousStepContext(plan.id, 1);
    expect(context).toBeUndefined();
  });
});

describe('upstreamTaskContext', () => {
  it('builds context from completed upstream blocking tasks', async () => {
    const upstream = await createTaskInProject('Build auth module', {
      status: 'done',
      completionSummary: JSON.stringify({
        whatWasBuilt: 'JWT authentication with refresh tokens',
        filesChanged: ['src/auth/jwt.ts', 'src/middleware/auth.ts'],
        apiContracts: [{ endpoint: '/api/login', method: 'POST', description: 'User login' }],
        keyDecisions: ['Used HS256 for JWT signing'],
        dependencyInfo: 'Auth middleware must be applied before protected routes',
      }),
    });
    const downstream = await createTaskInProject('Build user profile');

    await prisma.taskDependency.create({
      data: {
        sourceTaskId: upstream.taskId,
        targetTaskId: downstream.taskId,
        linkType: 'blocks',
      },
    });

    const context = await buildUpstreamTaskContext(downstream.taskId);
    expect(context).toBeDefined();
    expect(context).toContain('Build auth module');
    expect(context).toContain('JWT authentication with refresh tokens');
    expect(context).toContain('src/auth/jwt.ts');
    expect(context).toContain('src/middleware/auth.ts');
    expect(context).toContain('/api/login');
    expect(context).toContain('Used HS256 for JWT signing');
    expect(context).toContain('Auth middleware must be applied before protected routes');
  });

  it('includes informs dependencies', async () => {
    const informer = await createTaskInProject('Research API design', {
      status: 'done',
      completionSummary: JSON.stringify({
        whatWasBuilt: 'API design document',
        filesChanged: ['docs/api-design.md'],
      }),
    });
    const downstream = await createTaskInProject('Implement API');

    await prisma.taskDependency.create({
      data: {
        sourceTaskId: informer.taskId,
        targetTaskId: downstream.taskId,
        linkType: 'informs',
      },
    });

    const context = await buildUpstreamTaskContext(downstream.taskId);
    expect(context).toBeDefined();
    expect(context).toContain('Research API design');
    expect(context).toContain('API design document');
  });

  it('excludes upstream tasks that are not done', async () => {
    const upstream = await createTaskInProject('In-progress task', {
      status: 'in_progress',
      completionSummary: JSON.stringify({ whatWasBuilt: 'Should not appear', filesChanged: [] }),
    });
    const downstream = await createTaskInProject('Downstream task');

    await prisma.taskDependency.create({
      data: {
        sourceTaskId: upstream.taskId,
        targetTaskId: downstream.taskId,
        linkType: 'blocks',
      },
    });

    const context = await buildUpstreamTaskContext(downstream.taskId);
    expect(context).toBeUndefined();
  });

  it('excludes upstream tasks without completion summaries', async () => {
    const upstream = await createTaskInProject('Done but no summary', { status: 'done' });
    const downstream = await createTaskInProject('Downstream task');

    await prisma.taskDependency.create({
      data: {
        sourceTaskId: upstream.taskId,
        targetTaskId: downstream.taskId,
        linkType: 'blocks',
      },
    });

    const context = await buildUpstreamTaskContext(downstream.taskId);
    expect(context).toBeUndefined();
  });

  it('combines multiple upstream tasks', async () => {
    const upstream1 = await createTaskInProject('Build auth', {
      status: 'done',
      completionSummary: JSON.stringify({ whatWasBuilt: 'Auth system', filesChanged: ['src/auth.ts'] }),
    });
    const upstream2 = await createTaskInProject('Build database', {
      status: 'done',
      completionSummary: JSON.stringify({ whatWasBuilt: 'Database layer', filesChanged: ['src/db.ts'] }),
    });
    const downstream = await createTaskInProject('Build API');

    await prisma.taskDependency.createMany({
      data: [
        { sourceTaskId: upstream1.taskId, targetTaskId: downstream.taskId, linkType: 'blocks' },
        { sourceTaskId: upstream2.taskId, targetTaskId: downstream.taskId, linkType: 'blocks' },
      ],
    });

    const context = await buildUpstreamTaskContext(downstream.taskId);
    expect(context).toBeDefined();
    expect(context).toContain('Build auth');
    expect(context).toContain('Auth system');
    expect(context).toContain('Build database');
    expect(context).toContain('Database layer');
  });

  it('returns undefined when no dependencies exist', async () => {
    const task = await createTaskInProject('Standalone task');
    const context = await buildUpstreamTaskContext(task.taskId);
    expect(context).toBeUndefined();
  });

  it('handles summary with empty optional fields', async () => {
    const upstream = await createTaskInProject('Minimal task', {
      status: 'done',
      completionSummary: JSON.stringify({
        whatWasBuilt: 'Something simple',
        filesChanged: [],
      }),
    });
    const downstream = await createTaskInProject('Downstream');

    await prisma.taskDependency.create({
      data: {
        sourceTaskId: upstream.taskId,
        targetTaskId: downstream.taskId,
        linkType: 'blocks',
      },
    });

    const context = await buildUpstreamTaskContext(downstream.taskId);
    expect(context).toBeDefined();
    expect(context).toContain('Something simple');
    expect(context).not.toContain('Files changed');
    expect(context).not.toContain('API contracts');
  });
});

describe('failureContext', () => {
  it('builds context from a failed action result', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      {
        actionType: 'generate_code',
        label: 'Generate code',
        position: 0,
        status: 'failed',
        result: JSON.stringify({
          failed: true,
          error: 'Syntax error in generated TypeScript',
          errorCode: 'COMPILE_ERROR',
        }),
      },
    ]);

    const actions = await prisma.taskAction.findMany({ where: { planId: plan.id } });
    const context = await buildFailureContext(actions[0].id);

    expect(context).toBeDefined();
    expect(context).toContain('Syntax error in generated TypeScript');
    expect(context).toContain('COMPILE_ERROR');
    expect(context).toContain('Avoid the same approach');
  });

  it('returns undefined when action has no result', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      { actionType: 'generate_code', label: 'Generate code', position: 0, status: 'pending' },
    ]);

    const actions = await prisma.taskAction.findMany({ where: { planId: plan.id } });
    const context = await buildFailureContext(actions[0].id);
    expect(context).toBeUndefined();
  });

  it('returns undefined when result is not a failure', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      {
        actionType: 'generate_code',
        label: 'Generate code',
        position: 0,
        status: 'completed',
        result: JSON.stringify({ summary: 'Success', files: [{ path: 'src/api.ts' }] }),
      },
    ]);

    const actions = await prisma.taskAction.findMany({ where: { planId: plan.id } });
    const context = await buildFailureContext(actions[0].id);
    expect(context).toBeUndefined();
  });

  it('handles failure without error code', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      {
        actionType: 'generate_code',
        label: 'Generate code',
        position: 0,
        status: 'failed',
        result: JSON.stringify({ failed: true, error: 'Unknown failure' }),
      },
    ]);

    const actions = await prisma.taskAction.findMany({ where: { planId: plan.id } });
    const context = await buildFailureContext(actions[0].id);

    expect(context).toBeDefined();
    expect(context).toContain('Unknown failure');
    expect(context).not.toContain('Error code');
  });

  it('handles malformed JSON gracefully', async () => {
    const task = await createTaskInProject('Build API');
    const plan = await createPlanWithActions(task.taskId, [
      {
        actionType: 'generate_code',
        label: 'Generate code',
        position: 0,
        status: 'failed',
        result: 'not valid json',
      },
    ]);

    const actions = await prisma.taskAction.findMany({ where: { planId: plan.id } });
    const context = await buildFailureContext(actions[0].id);
    expect(context).toBeUndefined();
  });
});
