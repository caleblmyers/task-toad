import { GraphQLError } from 'graphql';
import type { z } from 'zod';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('ai');

// ---------------------------------------------------------------------------
// Response parsing and validation
// ---------------------------------------------------------------------------

/** Extract JSON from AI responses — handles markdown fences, preamble text, and bare JSON. */
export function stripFences(raw: string): string {
  // Prefer bracket-matching (most reliable when content contains code fences)
  const start = raw.search(/[[{]/);
  const end = Math.max(raw.lastIndexOf(']'), raw.lastIndexOf('}'));
  if (start !== -1 && end > start) return raw.slice(start, end + 1);

  // Fallback: extract from markdown json fence (only match ```json specifically)
  const fenceMatch = raw.match(/```json\s*\n([\s\S]*?)```/i);
  if (fenceMatch) return fenceMatch[1].trim();

  return raw.trim();
}

/**
 * Attempt to repair malformed JSON — common with AI-generated content
 * that has literal newlines/tabs inside string values.
 */
function repairJSON(raw: string): string {
  // Fix literal newlines/tabs inside JSON string values.
  // Walk through the string tracking whether we're inside a JSON string.
  let result = '';
  let inString = false;
  let escaped = false;

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (escaped) {
      result += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\' && inString) {
      escaped = true;
      result += ch;
      continue;
    }

    if (ch === '"') {
      inString = !inString;
      result += ch;
      continue;
    }

    if (inString) {
      if (ch === '\n') { result += '\\n'; continue; }
      if (ch === '\r') { result += '\\r'; continue; }
      if (ch === '\t') { result += '\\t'; continue; }
    }

    result += ch;
  }

  return result;
}

/** Parse a raw AI response string as JSON and validate against a Zod schema. */
export function parseJSON<T>(raw: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  const stripped = stripFences(raw);
  try {
    parsed = JSON.parse(stripped);
  } catch (firstErr) {
    // Attempt repair for common AI JSON issues (literal newlines in strings)
    const repaired = repairJSON(stripped);
    try {
      parsed = JSON.parse(repaired);
      log.info('JSON repair succeeded');
    } catch {
      log.error({ preview: raw.slice(0, 500), length: raw.length, firstError: (firstErr as Error).message }, 'Failed to parse AI response');
      throw new GraphQLError('Failed to parse AI response');
    }
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    log.error({ issues: result.error.issues.slice(0, 3) }, 'AI response validation failed');
    throw new GraphQLError('AI response did not match expected format');
  }
  return result.data;
}
