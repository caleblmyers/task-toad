import { GraphQLError } from 'graphql';
import type { z } from 'zod';

// ---------------------------------------------------------------------------
// Response parsing and validation
// ---------------------------------------------------------------------------

/** Strip ```json ... ``` fences that models sometimes wrap responses in. */
export function stripFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
}

/** Parse a raw AI response string as JSON and validate against a Zod schema. */
export function parseJSON<T>(raw: string, schema: z.ZodType<T>): T {
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    console.error('[AI] Failed to parse response:', raw.slice(0, 200));
    throw new GraphQLError('Failed to parse AI response');
  }
  const result = schema.safeParse(parsed);
  if (!result.success) {
    console.error('[AI] Response validation failed:', result.error.issues.slice(0, 3));
    throw new GraphQLError('AI response did not match expected format');
  }
  return result.data;
}
