import { GraphQLError } from 'graphql';
import { CONTEXT_WINDOW } from './aiConfig.js';

// ---------------------------------------------------------------------------
// Token estimation (chars / 4 heuristic — no external tokenizer needed)
// ---------------------------------------------------------------------------

/** Rough token count estimate. ~4 chars per token for English text. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Check whether a prompt fits within the context window.
 * Throws GraphQLError if the prompt is too large.
 */
export function checkPromptSize(
  systemPrompt: string,
  userPrompt: string,
  maxOutputTokens: number
): number {
  const inputEstimate = estimateTokens(systemPrompt) + estimateTokens(userPrompt);
  const totalEstimate = inputEstimate + maxOutputTokens;

  if (totalEstimate > CONTEXT_WINDOW) {
    throw new GraphQLError(
      `Prompt is too large (~${inputEstimate} input tokens + ${maxOutputTokens} output tokens). Reduce the input size.`,
      { extensions: { code: 'PROMPT_TOO_LARGE' } }
    );
  }

  if (totalEstimate > CONTEXT_WINDOW * 0.8) {
    console.warn(`[AI] Prompt is near context limit: ~${totalEstimate} / ${CONTEXT_WINDOW} tokens`);
  }

  return inputEstimate;
}
