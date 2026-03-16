import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@sentry/node', () => ({ captureException: vi.fn() }));
vi.mock('../aiClient.js', () => ({
  callAI: vi.fn(),
}));
vi.mock('../aiLogger.js', () => ({
  logAICall: vi.fn(),
}));

import { callAI } from '../aiClient.js';
import {
  generateProjectOptions,
  generateTaskPlan,
  expandTask,
  summarizeProject,
} from '../aiService.js';

const mockCallAI = vi.mocked(callAI);

function makeResult(raw: string, cached = false) {
  return {
    raw,
    usage: { inputTokens: 100, outputTokens: 200, stopReason: 'end_turn' },
    cached,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── generateProjectOptions ──

describe('generateProjectOptions', () => {
  it('returns parsed options from callAI response', async () => {
    const options = [
      { title: 'Option 1', description: 'Desc 1' },
      { title: 'Option 2', description: 'Desc 2' },
      { title: 'Option 3', description: 'Desc 3' },
    ];
    mockCallAI.mockResolvedValue(makeResult(JSON.stringify(options)));

    const result = await generateProjectOptions('test-key', 'Build a todo app');
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('Option 1');
    expect(result[0].description).toBe('Desc 1');
  });

  it('limits to 3 options even if AI returns more', async () => {
    const options = [
      { title: 'A', description: 'a' },
      { title: 'B', description: 'b' },
      { title: 'C', description: 'c' },
      { title: 'D', description: 'd' },
    ];
    mockCallAI.mockResolvedValue(makeResult(JSON.stringify(options)));

    const result = await generateProjectOptions('test-key', 'prompt');
    expect(result).toHaveLength(3);
  });

  it('throws when callAI returns empty array', async () => {
    mockCallAI.mockResolvedValue(makeResult('[]'));

    await expect(generateProjectOptions('test-key', 'prompt')).rejects.toThrow(
      'Failed to parse AI response',
    );
  });
});

// ── generateTaskPlan ──

describe('generateTaskPlan', () => {
  it('returns parsed task plans from callAI response', async () => {
    const tasks = [
      {
        title: 'Setup auth',
        description: 'Implement authentication',
        instructions: 'Use JWT',
        suggestedTools: [{ name: 'jose', category: 'auth', reason: 'JWT signing' }],
        estimatedHours: 4,
        priority: 'high',
        dependsOn: [],
        subtasks: [],
        acceptanceCriteria: 'Login works',
      },
      {
        title: 'Add DB',
        description: 'Setup database',
        instructions: 'Use Prisma',
        estimatedHours: 2,
        priority: 'medium',
        dependsOn: [],
        subtasks: [],
        acceptanceCriteria: 'Queries work',
      },
      {
        title: 'Build UI',
        description: 'Frontend',
        instructions: 'React + Vite',
        estimatedHours: 6,
        priority: 'medium',
        dependsOn: ['Setup auth'],
        subtasks: [{ title: 'Login page', description: 'Create login form' }],
        acceptanceCriteria: 'UI renders',
      },
    ];
    mockCallAI.mockResolvedValue(makeResult(JSON.stringify(tasks)));

    const result = await generateTaskPlan('test-key', 'My App', 'A web app', 'Build it');
    expect(result).toHaveLength(3);
    expect(result[0].title).toBe('Setup auth');
    expect(result[0].suggestedTools).toHaveLength(1);
    expect(result[2].dependsOn).toEqual(['Setup auth']);
  });

  it('throws on empty task plan', async () => {
    mockCallAI.mockResolvedValue(makeResult('[]'));

    await expect(
      generateTaskPlan('test-key', 'App', 'Desc', 'Prompt'),
    ).rejects.toThrow('Failed to parse AI response');
  });
});

// ── expandTask ──

describe('expandTask', () => {
  it('returns parsed subtasks', async () => {
    const subtasks = [
      { title: 'Sub 1', description: 'First subtask' },
      { title: 'Sub 2', description: 'Second subtask' },
    ];
    mockCallAI.mockResolvedValue(makeResult(JSON.stringify(subtasks)));

    const result = await expandTask('test-key', 'Parent Task', 'Parent desc', 'Project');
    expect(result).toHaveLength(2);
    expect(result[0].title).toBe('Sub 1');
  });

  it('throws on empty subtask array', async () => {
    mockCallAI.mockResolvedValue(makeResult('[]'));

    await expect(
      expandTask('test-key', 'Task', 'Desc', 'Project'),
    ).rejects.toThrow('Failed to parse AI response');
  });
});

// ── summarizeProject ──

describe('summarizeProject', () => {
  it('returns raw string directly without JSON parsing', async () => {
    mockCallAI.mockResolvedValue(makeResult('The project is progressing well.'));

    const result = await summarizeProject('test-key', 'My Project', 'Description', [
      { title: 'Task 1', status: 'done' },
      { title: 'Task 2', status: 'in_progress' },
    ]);
    expect(result).toBe('The project is progressing well.');
  });
});

// ── isArraySchema ──

describe('isArraySchema (tested via callAndParse prefill behavior)', () => {
  it('uses [ prefill for array schemas (generateProjectOptions)', async () => {
    const options = [{ title: 'A', description: 'a' }];
    mockCallAI.mockResolvedValue(makeResult(JSON.stringify(options)));

    await generateProjectOptions('test-key', 'prompt');

    // callAI should have been called with prefill: '['
    expect(mockCallAI).toHaveBeenCalledWith(
      expect.objectContaining({ prefill: '[' }),
    );
  });

  it('uses { prefill for object schemas (summarizeProject has no prefill)', async () => {
    mockCallAI.mockResolvedValue(makeResult('Summary text'));

    await summarizeProject('test-key', 'P', 'D', []);

    // summarizeProject calls callAI directly without prefill (no callAndParse)
    expect(mockCallAI).toHaveBeenCalledWith(
      expect.not.objectContaining({ prefill: '[' }),
    );
  });
});

// ── Retry on validation failure ──

describe('retry on validation failure', () => {
  it('retries when first call returns invalid JSON and second returns valid', async () => {
    // generateProjectOptions has retryOnValidationFailure: true
    // First call returns invalid (not matching schema), second returns valid
    mockCallAI
      .mockResolvedValueOnce(makeResult('not valid json at all'))
      .mockResolvedValueOnce(
        makeResult(
          JSON.stringify([
            { title: 'A', description: 'a' },
            { title: 'B', description: 'b' },
            { title: 'C', description: 'c' },
          ]),
        ),
      );

    const result = await generateProjectOptions('test-key', 'prompt');
    expect(result).toHaveLength(3);
    expect(mockCallAI).toHaveBeenCalledTimes(2);

    // Second call should have cacheTTLMs: 0
    expect(mockCallAI.mock.calls[1][0]).toEqual(
      expect.objectContaining({ cacheTTLMs: 0 }),
    );
  });

  it('does not retry when cached result fails validation', async () => {
    // Cached results should NOT trigger retry
    mockCallAI.mockResolvedValue({
      raw: 'invalid',
      usage: { inputTokens: 0, outputTokens: 0, stopReason: 'cache_hit' },
      cached: true,
    });

    await expect(generateProjectOptions('test-key', 'prompt')).rejects.toThrow();
    // Should only be called once (no retry for cached results)
    expect(mockCallAI).toHaveBeenCalledTimes(1);
  });
});

// ── Direct isArraySchema testing ──

describe('isArraySchema helper', () => {
  // We can't import isArraySchema directly since it's not exported.
  // Instead, we test its behavior through the prefill parameter passed to callAI.

  it('detects array schema — generateTaskPlan uses [ prefill', async () => {
    const tasks = [{ title: 'T', description: 'D' }];
    mockCallAI.mockResolvedValue(makeResult(JSON.stringify(tasks)));

    await generateTaskPlan('test-key', 'P', 'D', 'Prompt');

    expect(mockCallAI).toHaveBeenCalledWith(
      expect.objectContaining({ prefill: '[' }),
    );
  });
});
