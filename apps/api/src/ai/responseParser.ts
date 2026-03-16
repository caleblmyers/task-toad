import { GraphQLError } from 'graphql';
import type { z } from 'zod';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('ai');

// ---------------------------------------------------------------------------
// Response parsing and validation
// ---------------------------------------------------------------------------

/** Extract JSON from AI responses — handles markdown fences, preamble text, and bare JSON. */
export function stripFences(raw: string): string {
  // Extract content from markdown fences (handles preamble text before fence)
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  // No fences — find first [ or { and last ] or } to extract bare JSON
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'));
  if (start !== -1 && end > start) return raw.slice(start, end + 1);

  return raw.trim();
}

/** Parse a raw AI response string as JSON and validate against a Zod schema. */
export function parseJSON<T>(raw: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    log.error({ preview: raw.slice(0, 500), length: raw.length }, 'Failed to parse AI response');
    throw new GraphQLError('Failed to parse AI response');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    log.error({ issues: result.error.issues.slice(0, 3) }, 'AI response validation failed');
    throw new GraphQLError('AI response did not match expected format');
  }
  return result.data;
}
