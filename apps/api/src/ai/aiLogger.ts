import type { AIFeature, AIUsage } from './aiTypes.js';
import { COST_PER_INPUT_TOKEN, COST_PER_OUTPUT_TOKEN } from './aiConfig.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('ai');

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

  log.info({
    feature: params.feature,
    model: params.model,
    inputTokens: params.usage.inputTokens,
    outputTokens: params.usage.outputTokens,
    cost: `$${cost.toFixed(4)}`,
    latencyMs: params.latencyMs,
    cached: params.cached,
    stopReason: params.usage.stopReason,
  }, 'AI call completed');
}
