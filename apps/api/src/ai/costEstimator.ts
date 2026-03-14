import { COST_PER_INPUT_TOKEN, COST_PER_OUTPUT_TOKEN } from './aiConfig.js';

export interface CostEstimate {
  inputTokens: number;
  outputTokens: number;
  totalCostUSD: number;
  formatted: string;
}

export function formatCost(inputTokens: number, outputTokens: number): CostEstimate {
  const totalCostUSD = (inputTokens * COST_PER_INPUT_TOKEN) + (outputTokens * COST_PER_OUTPUT_TOKEN);
  return {
    inputTokens,
    outputTokens,
    totalCostUSD,
    formatted: `${inputTokens + outputTokens} tokens ($${totalCostUSD.toFixed(4)})`,
  };
}
