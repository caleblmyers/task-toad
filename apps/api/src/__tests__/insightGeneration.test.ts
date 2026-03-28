import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──

const mockExecute = vi.fn();
vi.mock('../actions/index.js', () => ({
  getExecutor: vi.fn(() => ({ execute: mockExecute })),
}));

vi.mock('../ai/aiUsageTracker.js', () => ({
  checkBudget: vi.fn().mockResolvedValue({ allowed: true }),
}));

vi.mock('../ai/aiClient.js', () => ({
  isRetryableAIError: vi.fn(() => false),
}));

const mockGenerateTaskInsights = vi.fn();
const mockGenerateCompletionSummary = vi.fn().mockResolvedValue({ whatWasBuilt: 'test', filesChanged: [], keyDecisions: [] });
vi.mock('../ai/aiService.js', () => ({
  generateTaskInsights: (...args: unknown[]) => mockGenerateTaskInsights(...args),
  generateCompletionSummary: (...args: unknown[]) => mockGenerateCompletionSummary(...args),
}));

const mockEmit = vi.fn();
vi.mock('../infrastructure/eventbus/index.js', () => ({
  getEventBus: () => ({ emit: mockEmit }),
}));

const mockEnqueue = vi.fn();
vi.mock('../infrastructure/jobqueue/index.js', () => ({
  getJobQueue: () => ({ enqueue: mockEnqueue }),
}));

vi.mock('../ai/knowledgeRetrieval.js', () => ({
  retrieveRelevantKnowledge: vi.fn().mockResolvedValue(null),
}));

vi.mock('../utils/encryption.js', () => ({
  decryptApiKey: vi.fn(() => 'test-api-key'),
}));

vi.mock('../utils/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { createHandler } from '../infrastructure/jobs/actionExecutor.js';

// ── Helpers ──

interface MockPrisma {
  taskAction: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  taskActionPlan: { findUnique: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  org: { findUnique: ReturnType<typeof vi.fn> };
  task: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };
  taskInsight: { create: ReturnType<typeof vi.fn> };
  $queryRaw: ReturnType<typeof vi.fn>;
}

function createMockPrisma(overrides: Record<string, unknown> = {}): MockPrisma {
  const basePrisma = {
    taskAction: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'action-1',
        actionType: 'generate_code',
        status: 'pending',
        config: '{}',
        label: 'Generate code',
        position: 1,
        plan: {
          id: 'plan-1',
          status: 'active',
          task: {
            taskId: 'task-1',
            title: 'Implement feature X',
            description: 'A feature',
            instructions: 'Build it',
            projectId: 'proj-1',
            parentTaskId: 'parent-1',
            status: 'in_progress',
            project: {
              projectId: 'proj-1',
              name: 'Test Project',
              description: 'A project',
              knowledgeBase: null,
            },
          },
        },
      }),
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null), // no next action
      update: vi.fn().mockResolvedValue({}),
    },
    taskActionPlan: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    org: {
      findUnique: vi.fn().mockResolvedValue({ anthropicApiKeyEncrypted: 'encrypted-key' }),
    },
    task: {
      findUnique: vi.fn().mockResolvedValue({ status: 'in_progress' }),
      findMany: vi.fn().mockResolvedValue([
        { taskId: 'sibling-1', title: 'Sibling task A' },
        { taskId: 'sibling-2', title: 'Sibling task B' },
      ]),
      update: vi.fn().mockResolvedValue({ taskId: 'task-1', title: 'Implement feature X', status: 'done', projectId: 'proj-1', orgId: 'org-1', taskType: 'task' }),
    },
    $queryRaw: vi.fn().mockResolvedValue([]),
    taskInsight: {
      create: vi.fn().mockResolvedValue({}),
    },
    ...overrides,
  } satisfies MockPrisma;
  return basePrisma;
}

const defaultPayload = {
  planId: 'plan-1',
  actionId: 'action-1',
  orgId: 'org-1',
  userId: 'user-1',
};

describe('actionExecutor — insight generation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls generateTaskInsights after successful generate_code action', async () => {
    const prisma = createMockPrisma();
    const handler = createHandler(prisma as never);

    mockExecute.mockResolvedValue({
      success: true,
      data: {
        files: [{ path: 'src/feature.ts', language: 'typescript' }],
        summary: 'Implemented feature X',
      },
    });

    mockGenerateTaskInsights.mockResolvedValue({
      insights: [
        { type: 'dependency', content: 'This task affects Sibling task A', targetTaskTitle: 'Sibling task A' },
      ],
    });

    await handler(defaultPayload);

    expect(mockGenerateTaskInsights).toHaveBeenCalledOnce();
    expect(mockGenerateTaskInsights).toHaveBeenCalledWith(
      'test-api-key',
      'Implement feature X',
      'Build it',
      [{ path: 'src/feature.ts', language: 'typescript' }],
      'Implemented feature X',
      ['Sibling task A', 'Sibling task B'],
      'Test Project',
      null, // knowledgeContext
    );
    expect(prisma.taskInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sourceTaskId: 'task-1',
        targetTaskId: 'sibling-1',
        type: 'dependency',
        content: 'This task affects Sibling task A',
      }),
    });
  });

  it('does NOT generate insights for non-generate_code actions', async () => {
    const prisma = createMockPrisma();
    // Override action type to create_pr
    prisma.taskAction.findUnique.mockResolvedValue({
      id: 'action-1',
      actionType: 'create_pr',
      status: 'pending',
      config: '{}',
      label: 'Create PR',
      position: 1,
      plan: {
        id: 'plan-1',
        status: 'active',
        task: {
          taskId: 'task-1',
          title: 'Create PR',
          description: null,
          instructions: null,
          projectId: 'proj-1',
          parentTaskId: null,
          status: 'in_progress',
          project: {
            projectId: 'proj-1',
            name: 'Test Project',
            description: null,
            knowledgeBase: null,
          },
        },
      },
    });

    mockExecute.mockResolvedValue({ success: true, data: { prUrl: 'https://github.com/pr/1' } });
    const handler = createHandler(prisma as never);
    await handler(defaultPayload);

    expect(mockGenerateTaskInsights).not.toHaveBeenCalled();
  });

  it('does NOT generate insights when there is no API key', async () => {
    const prisma = createMockPrisma();
    // No API key in org
    prisma.org.findUnique.mockResolvedValue({ anthropicApiKeyEncrypted: null });

    mockExecute.mockResolvedValue({
      success: true,
      data: { files: [{ path: 'src/a.ts' }], summary: 'Done' },
    });

    const handler = createHandler(prisma as never);
    await handler(defaultPayload);

    expect(mockGenerateTaskInsights).not.toHaveBeenCalled();
  });

  it('still succeeds when generateTaskInsights throws (non-blocking)', async () => {
    const prisma = createMockPrisma();
    const handler = createHandler(prisma as never);

    mockExecute.mockResolvedValue({
      success: true,
      data: {
        files: [{ path: 'src/feature.ts' }],
        summary: 'Done',
      },
    });

    mockGenerateTaskInsights.mockRejectedValue(new Error('AI service down'));

    await handler(defaultPayload);

    // Action should still be marked completed (not failed)
    expect(prisma.taskAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
    // Plan should complete (since no next action)
    expect(prisma.taskActionPlan.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'completed' }),
      }),
    );
  });

  it('creates TaskInsight records with matched target task IDs', async () => {
    const prisma = createMockPrisma();
    const handler = createHandler(prisma as never);

    mockExecute.mockResolvedValue({
      success: true,
      data: {
        files: [{ path: 'src/feature.ts' }],
        summary: 'Done',
      },
    });

    mockGenerateTaskInsights.mockResolvedValue({
      insights: [
        { type: 'impact', content: 'Affects Sibling task B', targetTaskTitle: 'Sibling task B' },
        { type: 'warning', content: 'General warning', targetTaskTitle: null },
      ],
    });

    await handler(defaultPayload);

    // First insight matched to sibling-2
    expect(prisma.taskInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetTaskId: 'sibling-2',
        type: 'impact',
      }),
    });
    // Second insight has no target
    expect(prisma.taskInsight.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        targetTaskId: null,
        type: 'warning',
      }),
    });
    expect(prisma.taskInsight.create).toHaveBeenCalledTimes(2);
  });

  it('skips insight generation when no sibling tasks exist', async () => {
    const prisma = createMockPrisma();
    // No siblings
    prisma.task.findMany.mockResolvedValue([]);

    mockExecute.mockResolvedValue({
      success: true,
      data: {
        files: [{ path: 'src/feature.ts' }],
        summary: 'Done',
      },
    });

    const handler = createHandler(prisma as never);
    await handler(defaultPayload);

    // siblingTitles is empty → condition in executor skips insight generation
    expect(mockGenerateTaskInsights).not.toHaveBeenCalled();
  });

  it('skips insight generation when no files are generated', async () => {
    const prisma = createMockPrisma();

    mockExecute.mockResolvedValue({
      success: true,
      data: {
        files: [],
        summary: 'Nothing generated',
      },
    });

    const handler = createHandler(prisma as never);
    await handler(defaultPayload);

    expect(mockGenerateTaskInsights).not.toHaveBeenCalled();
  });
});
