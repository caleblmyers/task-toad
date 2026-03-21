import { describe, it, expect } from 'vitest';
import { parseTQL, TQLParseError } from '../utils/tqlParser.js';
import type { FilterGroupInput } from '../utils/tqlParser.js';

describe('TQL Parser', () => {
  it('parses a simple field filter', () => {
    const result = parseTQL('status:done');
    expect(result).toEqual({
      operator: 'AND',
      conditions: [{ field: 'status', op: 'eq', value: 'done' }],
    });
  });

  it('parses multiple fields as AND', () => {
    const result = parseTQL('status:done priority:high');
    expect(result.operator).toBe('AND');
    expect(result.conditions).toEqual([
      { field: 'status', op: 'eq', value: 'done' },
      { field: 'priority', op: 'eq', value: 'high' },
    ]);
  });

  it('parses negation with dash prefix', () => {
    const result = parseTQL('-status:done');
    expect(result).toEqual({
      operator: 'AND',
      conditions: [{ field: 'status', op: 'neq', value: 'done' }],
    });
  });

  it('parses negation with NOT keyword', () => {
    const result = parseTQL('NOT status:done');
    expect(result).toEqual({
      operator: 'AND',
      conditions: [{ field: 'status', op: 'neq', value: 'done' }],
    });
  });

  it('parses multi-value filter', () => {
    const result = parseTQL('status:done,in_progress');
    expect(result).toEqual({
      operator: 'AND',
      conditions: [{ field: 'status', op: 'in', value: 'done,in_progress' }],
    });
  });

  it('parses comparison operators', () => {
    expect(parseTQL('storyPoints>5')).toEqual({
      operator: 'AND',
      conditions: [{ field: 'storyPoints', op: 'gt', value: '5' }],
    });

    expect(parseTQL('estimatedHours<=8')).toEqual({
      operator: 'AND',
      conditions: [{ field: 'estimatedHours', op: 'lte', value: '8' }],
    });

    expect(parseTQL('dueDate<2026-04-01')).toEqual({
      operator: 'AND',
      conditions: [{ field: 'dueDate', op: 'lt', value: '2026-04-01' }],
    });

    expect(parseTQL('storyPoints>=3')).toEqual({
      operator: 'AND',
      conditions: [{ field: 'storyPoints', op: 'gte', value: '3' }],
    });
  });

  it('parses bare text as search', () => {
    const result = parseTQL('fix bug');
    expect(result).toEqual({
      operator: 'AND',
      conditions: [{ field: 'search', op: 'contains', value: 'fix bug' }],
    });
  });

  it('parses OR grouping with parentheses', () => {
    const result = parseTQL('(status:done OR status:in_review)');
    expect(result.operator).toBe('OR');
    // OR merges two AND-wrapped conditions into sub-groups
    expect(result.groups).toHaveLength(2);
    expect(result.groups![0]).toEqual({
      operator: 'AND',
      conditions: [{ field: 'status', op: 'eq', value: 'done' }],
    });
    expect(result.groups![1]).toEqual({
      operator: 'AND',
      conditions: [{ field: 'status', op: 'eq', value: 'in_review' }],
    });
  });

  it('parses complex grouping: (A OR B) AND C', () => {
    const result = parseTQL('(status:done OR status:in_review) AND priority:high');
    expect(result.operator).toBe('AND');
    // Should have priority in conditions or a sub-group
    const hasOrGroup = result.groups?.some((g: FilterGroupInput) => g.operator === 'OR');
    expect(hasOrGroup).toBe(true);
  });

  it('throws TQLParseError for invalid field', () => {
    expect(() => parseTQL('foo:bar')).toThrow(TQLParseError);
    expect(() => parseTQL('foo:bar')).toThrow(/Unknown field 'foo'/);
  });

  it('returns empty AND group for empty input', () => {
    const result = parseTQL('');
    expect(result).toEqual({ operator: 'AND' });
  });

  it('returns empty AND group for whitespace input', () => {
    const result = parseTQL('   ');
    expect(result).toEqual({ operator: 'AND' });
  });

  it('parses quoted values with spaces', () => {
    const result = parseTQL('assignee:"John Smith"');
    expect(result).toEqual({
      operator: 'AND',
      conditions: [{ field: 'assignee', op: 'eq', value: 'John Smith' }],
    });
  });

  it('handles mixed text search and field filters', () => {
    const result = parseTQL('fix bug status:todo');
    expect(result.operator).toBe('AND');
    const conditions = result.conditions ?? [];
    expect(conditions).toContainEqual({ field: 'search', op: 'contains', value: 'fix bug' });
    expect(conditions).toContainEqual({ field: 'status', op: 'eq', value: 'todo' });
  });

  it('handles negated comparison operators', () => {
    const result = parseTQL('-storyPoints>5');
    expect(result).toEqual({
      operator: 'AND',
      conditions: [{ field: 'storyPoints', op: 'lte', value: '5' }],
    });
  });

  it('throws on unterminated quoted string', () => {
    expect(() => parseTQL('assignee:"John')).toThrow(TQLParseError);
    expect(() => parseTQL('assignee:"John')).toThrow(/Unterminated quoted string/);
  });
});
