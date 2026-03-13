import type { AIFeature, AIUsage } from './aiTypes.js';
import { COST_PER_INPUT_TOKEN, COST_PER_OUTPUT_TOKEN } from './aiConfig.js';

// ---------------------------------------------------------------------------
// Structured AI usage logging
// ---------------------------------------------------------------------------

export function logAICall(params: {
  feature: AIFeature;
  model: string;
  usage: AIUsage;
  latencyMs: number;
  cached: boolean;
}): void {
  const cost =
    params.usage.inputTokens * COST_PER_INPUT_TOKEN +
    params.usage.outputTokens * COST_PER_OUTPUT_TOKEN;

  console.log(
    `[AI] ${JSON.stringify({
      feature: params.feature,
      model: params.model,
      in: params.usage.inputTokens,
      out: params.usage.outputTokens,
      cost: `$${cost.toFixed(4)}`,
      latencyMs: params.latencyMs,
      cached: params.cached,
      stop: params.usage.stopReason,
    })}`
  );
}
