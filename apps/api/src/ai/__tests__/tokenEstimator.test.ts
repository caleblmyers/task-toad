import { describe, it, expect, vi } from 'vitest';

const { mockWarn } = vi.hoisted(() => ({
  mockWarn: vi.fn(),
}));

vi.mock('../../utils/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: mockWarn,
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { estimateTokens, checkPromptSize } from '../tokenEstimator.js';

describe('estimateTokens', () => {
  it('returns 0 for empty string', () => {
    expect(estimateTokens('')).toBe(0);
  });

  it('estimates short text correctly', () => {
    // "hello world" = 11 chars → ceil(11/4) = 3
    expect(estimateTokens('hello world')).toBe(3);
  });

  it('estimates longer text proportionally', () => {
    const text = 'a'.repeat(1000);
    expect(estimateTokens(text)).toBe(250);
  });

  it('always returns a number >= 0', () => {
    expect(estimateTokens('x')).toBeGreaterThanOrEqual(0);
    expect(estimateTokens('')).toBeGreaterThanOrEqual(0);
    expect(estimateTokens('hello world foo bar baz')).toBeGreaterThanOrEqual(0);
  });
});

describe('checkPromptSize', () => {
  it('returns input estimate for normal-sized prompts', () => {
    const result = checkPromptSize('system', 'user', 8192);
    expect(result).toBeGreaterThan(0);
    expect(typeof result).toBe('number');
  });

  it('throws PROMPT_TOO_LARGE when exceeding context window', () => {
    // CONTEXT_WINDOW = 200_000. Create prompts that exceed it.
    const hugePrompt = 'x'.repeat(800_000); // 200k tokens
    expect(() => checkPromptSize(hugePrompt, '', 1000)).toThrowError(
      /Prompt is too large/
    );
    try {
      checkPromptSize(hugePrompt, '', 1000);
    } catch (err: unknown) {
      const gqlErr = err as { extensions?: { code?: string } };
      expect(gqlErr.extensions?.code).toBe('PROMPT_TOO_LARGE');
    }
  });

  it('warns when prompt is near context limit (>80%)', () => {
    mockWarn.mockClear();
    // 200k * 0.8 = 160k tokens. We need total > 160k but <= 200k.
    // 170k tokens = 680k chars for system, 0 for user, 0 for output
    const largePrompt = 'x'.repeat(680_000);
    checkPromptSize(largePrompt, '', 0);

    expect(mockWarn).toHaveBeenCalled();
  });

  it('does not throw for prompts within budget', () => {
    expect(() => checkPromptSize('short system', 'short user', 4096)).not.toThrow();
  });
});
