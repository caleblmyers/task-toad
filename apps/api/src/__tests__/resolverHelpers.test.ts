// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
import {
  validateStatus,
  parseInput,
  sanitizeForPrompt,
  CreateTaskInput,
  UpdateTaskInput,
  CreateCommentInput,
  CreateProjectInput,
} from '../utils/resolverHelpers.js';

// ── validateStatus ──

describe('validateStatus', () => {
  const validStatuses = ['TODO', 'IN_PROGRESS', 'DONE', 'CANCELLED'];

  it('accepts valid statuses', () => {
    for (const s of validStatuses) {
      expect(() => validateStatus(validStatuses, s)).not.toThrow();
    }
  });

  it('throws ValidationError for invalid status', () => {
    expect(() => validateStatus(validStatuses, 'INVALID')).toThrow(
      /Invalid status "INVALID"/,
    );
  });

  it('includes valid statuses in error message', () => {
    expect(() => validateStatus(validStatuses, 'BAD')).toThrow(
      /Valid: TODO, IN_PROGRESS, DONE, CANCELLED/,
    );
  });

  it('throws with BAD_USER_INPUT error code', () => {
    try {
      validateStatus(validStatuses, 'NOPE');
      expect.unreachable('should have thrown');
    } catch (e: unknown) {
      const err = e as { extensions?: { code?: string } };
      expect(err.extensions?.code).toBe('BAD_USER_INPUT');
    }
  });

  it('handles empty valid statuses list', () => {
    expect(() => validateStatus([], 'TODO')).toThrow(/Invalid status/);
  });
});

// ── parseInput ──

describe('parseInput', () => {
  describe('CreateTaskInput', () => {
    it('passes valid input through', () => {
      const result = parseInput(CreateTaskInput, { title: 'My Task' });
      expect(result).toEqual({ title: 'My Task' });
    });

    it('passes input with optional description', () => {
      const result = parseInput(CreateTaskInput, {
        title: 'Task',
        description: 'A description',
      });
      expect(result).toEqual({ title: 'Task', description: 'A description' });
    });

    it('throws for missing title', () => {
      expect(() => parseInput(CreateTaskInput, {})).toThrow();
    });

    it('throws for empty title', () => {
      expect(() => parseInput(CreateTaskInput, { title: '' })).toThrow(
        /Title is required/,
      );
    });

    it('throws for title exceeding max length', () => {
      expect(() =>
        parseInput(CreateTaskInput, { title: 'x'.repeat(501) }),
      ).toThrow(/500 characters/);
    });

    it('throws for description exceeding max length', () => {
      expect(() =>
        parseInput(CreateTaskInput, {
          title: 'OK',
          description: 'x'.repeat(10001),
        }),
      ).toThrow(/10000 characters/);
    });

    it('throws with BAD_USER_INPUT code', () => {
      try {
        parseInput(CreateTaskInput, {});
        expect.unreachable('should have thrown');
      } catch (e: unknown) {
        const err = e as { extensions?: { code?: string } };
        expect(err.extensions?.code).toBe('BAD_USER_INPUT');
      }
    });
  });

  describe('UpdateTaskInput', () => {
    it('allows all fields optional', () => {
      const result = parseInput(UpdateTaskInput, {});
      expect(result).toEqual({});
    });

    it('validates title min length when provided', () => {
      expect(() => parseInput(UpdateTaskInput, { title: '' })).toThrow(
        /Title is required/,
      );
    });
  });

  describe('CreateCommentInput', () => {
    it('passes valid comment', () => {
      const result = parseInput(CreateCommentInput, { content: 'Hello' });
      expect(result).toEqual({ content: 'Hello' });
    });

    it('throws for empty comment', () => {
      expect(() => parseInput(CreateCommentInput, { content: '' })).toThrow(
        /Comment body is required/,
      );
    });

    it('throws for comment exceeding max length', () => {
      expect(() =>
        parseInput(CreateCommentInput, { content: 'x'.repeat(5001) }),
      ).toThrow(/5000 characters/);
    });
  });

  describe('CreateProjectInput', () => {
    it('passes valid project name', () => {
      const result = parseInput(CreateProjectInput, { name: 'My Project' });
      expect(result).toEqual({ name: 'My Project' });
    });

    it('throws for empty name', () => {
      expect(() => parseInput(CreateProjectInput, { name: '' })).toThrow(
        /Name is required/,
      );
    });

    it('throws for name exceeding max length', () => {
      expect(() =>
        parseInput(CreateProjectInput, { name: 'x'.repeat(201) }),
      ).toThrow(/200 characters/);
    });
  });

  it('joins multiple error messages with semicolons', () => {
    const schema = CreateTaskInput;
    // Missing title + description too long
    try {
      parseInput(schema, { description: 'x'.repeat(10001) });
      expect.unreachable('should have thrown');
    } catch (e: unknown) {
      const err = e as { message: string };
      expect(err.message).toContain(';');
    }
  });
});

// ── sanitizeForPrompt ──

describe('sanitizeForPrompt', () => {
  it('escapes backslashes', () => {
    expect(sanitizeForPrompt('a\\b')).toBe('a\\\\b');
  });

  it('escapes double quotes', () => {
    expect(sanitizeForPrompt('say "hello"')).toBe('say \\"hello\\"');
  });

  it('escapes newlines', () => {
    expect(sanitizeForPrompt('line1\nline2')).toBe('line1\\nline2');
  });

  it('handles combined escapes', () => {
    const input = 'path\\to\n"file"';
    const result = sanitizeForPrompt(input);
    expect(result).toBe('path\\\\to\\n\\"file\\"');
  });

  it('passes through safe strings unchanged', () => {
    expect(sanitizeForPrompt('hello world')).toBe('hello world');
  });

  it('handles empty string', () => {
    expect(sanitizeForPrompt('')).toBe('');
  });

  it('escapes potential script injection', () => {
    const malicious = '<script>alert("xss")</script>';
    const result = sanitizeForPrompt(malicious);
    expect(result).toBe('<script>alert(\\"xss\\")</script>');
    expect(result).not.toContain('"xss"');
  });
});
