import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { stripFences, parseJSON } from '../responseParser.js';

vi.mock('../../utils/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('stripFences', () => {
  it('returns bare JSON unchanged', () => {
    const json = '{"title":"hello"}';
    expect(stripFences(json)).toBe(json);
  });

  it('extracts content from ```json fences', () => {
    const raw = '```json\n{"title":"hello"}\n```';
    expect(stripFences(raw)).toBe('{"title":"hello"}');
  });

  it('extracts content from fences without language tag', () => {
    const raw = '```\n[1,2,3]\n```';
    expect(stripFences(raw)).toBe('[1,2,3]');
  });

  it('extracts from preamble text before fences', () => {
    const raw = 'Here are the tasks:\n```json\n[{"id":1}]\n```';
    expect(stripFences(raw)).toBe('[{"id":1}]');
  });

  it('extracts bare JSON with trailing text by bracket matching', () => {
    const raw = '{"title":"hi"} hope that helps!';
    expect(stripFences(raw)).toBe('{"title":"hi"}');
  });

  it('extracts array JSON with trailing text', () => {
    const raw = 'Sure! [1,2,3] there you go';
    expect(stripFences(raw)).toBe('[1,2,3]');
  });

  it('returns trimmed string when no JSON found', () => {
    const raw = '  just some plain text  ';
    expect(stripFences(raw)).toBe('just some plain text');
  });
});

describe('parseJSON', () => {
  const testSchema = z.object({ title: z.string() });

  it('parses valid JSON matching schema', () => {
    const result = parseJSON('{"title":"hello"}', testSchema);
    expect(result).toEqual({ title: 'hello' });
  });

  it('parses JSON inside markdown fences', () => {
    const result = parseJSON('```json\n{"title":"fenced"}\n```', testSchema);
    expect(result).toEqual({ title: 'fenced' });
  });

  it('throws on invalid JSON', () => {
    expect(() => parseJSON('not json at all {{{', testSchema)).toThrowError(
      'Failed to parse AI response'
    );
  });

  it('throws when JSON does not match schema', () => {
    // Valid JSON but wrong shape
    expect(() => parseJSON('{"name":"wrong"}', testSchema)).toThrowError(
      'AI response did not match expected format'
    );
  });

  it('throws when JSON has wrong types for schema', () => {
    expect(() => parseJSON('{"title":123}', testSchema)).toThrowError(
      'AI response did not match expected format'
    );
  });
});
