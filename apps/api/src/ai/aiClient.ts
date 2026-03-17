import Anthropic from '@anthropic-ai/sdk';
import { GraphQLError } from 'graphql';
import type { AIFeature, AIUsage } from './aiTypes.js';
import { AI_MODEL } from './aiConfig.js';
import { logAICall } from './aiLogger.js';
import { aiCache, hashPrompt } from './aiCache.js';
import { checkPromptSize } from './tokenEstimator.js';
import { createChildLogger } from '../utils/logger.js';
import { aiCallTotal, aiCallDuration } from '../utils/metrics.js';

const log = createChildLogger('ai');

// ---------------------------------------------------------------------------
// Client cache — reuse Anthropic instances per API key
// ---------------------------------------------------------------------------

const clientCache = new Map<string, Anthropic>();

function getClient(apiKey: string): Anthropic {
  let client = clientCache.get(apiKey);
  if (!client) {
    client = new Anthropic({ apiKey });
    clientCache.set(apiKey, client);
  }
  return client;
}

// ---------------------------------------------------------------------------
// Error mapping — Anthropic SDK errors → GraphQLError
// ---------------------------------------------------------------------------

function mapAnthropicError(err: unknown): never {
  if (err instanceof GraphQLError) throw err;

  if (err instanceof Anthropic.AuthenticationError) {
    throw new GraphQLError('Invalid Anthropic API key. Update it in Org Settings.', {
      extensions: { code: 'API_KEY_INVALID' },
    });
  }
  if (err instanceof Anthropic.RateLimitError) {
    throw new GraphQLError('Anthropic rate limit reached. Please wait a moment and try again.', {
      extensions: { code: 'RATE_LIMITED' },
    });
  }
  if (err instanceof Anthropic.APIConnectionError) {
    throw new GraphQLError('Could not reach the AI service. Check your network connection.', {
      extensions: { code: 'AI_UNAVAILABLE' },
    });
  }
  if (err instanceof Anthropic.InternalServerError) {
    throw new GraphQLError('AI service returned a server error. Try again shortly.', {
      extensions: { code: 'AI_SERVER_ERROR' },
    });
  }

  log.error({ err }, 'Unexpected AI error');
  throw new GraphQLError('AI service error');
}

// ---------------------------------------------------------------------------
// Prompt retention & redaction
// ---------------------------------------------------------------------------

/** Default retention period for AI prompt logs: 30 days */
const PROMPT_RETENTION_DAYS = 30;

/** Redact common sensitive patterns (emails, API keys, tokens) from prompt logs */
function redactSensitive(text: string): string {
  return text
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED_EMAIL]')
    .replace(/\b(sk-[a-zA-Z0-9]{20,})\b/g, '[REDACTED_API_KEY]')
    .replace(/\b(ghp_[a-zA-Z0-9]{36,})\b/g, '[REDACTED_TOKEN]')
    .replace(/\b(Bearer\s+[a-zA-Z0-9._-]{20,})\b/g, 'Bearer [REDACTED]');
}

// ---------------------------------------------------------------------------
// Core API call with caching, size check, logging
// ---------------------------------------------------------------------------

export interface PromptLogContext {
  prisma: { aIPromptLog: { create: (args: { data: Record<string, unknown> }) => Promise<unknown> } };
  orgId: string;
  userId: string;
  taskId?: string | null;
  projectId?: string | null;
  promptLoggingEnabled?: boolean;
}

export interface CallAIParams {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  feature: AIFeature;
  cacheTTLMs?: number;
  promptLogContext?: PromptLogContext;
  /** Prefill the assistant response to force structured output (e.g. '[' for arrays, '{' for objects). */
  prefill?: string;
}

export interface CallAIResult {
  raw: string;
  usage: AIUsage;
  cached: boolean;
}

export async function callAI(params: CallAIParams): Promise<CallAIResult> {
  const { apiKey, systemPrompt, userPrompt, maxTokens, feature, cacheTTLMs = 0, promptLogContext, prefill } = params;

  // Check cache first
  if (cacheTTLMs > 0) {
    const cacheKey = hashPrompt(systemPrompt, userPrompt);
    const cached = aiCache.get(cacheKey);
    if (cached) {
      logAICall({
        feature,
        model: AI_MODEL,
        usage: { inputTokens: 0, outputTokens: 0, stopReason: 'cache_hit' },
        latencyMs: 0,
        cached: true,
      });
      return { raw: cached, usage: { inputTokens: 0, outputTokens: 0, stopReason: 'cache_hit' }, cached: true };
    }
  }

  // Validate prompt fits in context window
  checkPromptSize(systemPrompt, userPrompt, maxTokens);

  const start = Date.now();
  try {
    const response = await getClient(apiKey).messages.create({
      model: AI_MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt },
        ...(prefill ? [{ role: 'assistant' as const, content: prefill }] : []),
      ],
    });

    const latencyMs = Date.now() - start;
    const usage: AIUsage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      stopReason: response.stop_reason ?? 'unknown',
    };

    logAICall({ feature, model: AI_MODEL, usage, latencyMs, cached: false });
    aiCallTotal.inc({ feature, status: 'success' });
    aiCallDuration.observe({ feature }, latencyMs / 1000);

    const block = response.content[0];
    if (block.type !== 'text') throw new Error('Unexpected response type');
    // Prepend the prefill so the full JSON is intact
    const raw = prefill ? prefill + block.text : block.text;

    // Store in cache if configured
    if (cacheTTLMs > 0) {
      const cacheKey = hashPrompt(systemPrompt, userPrompt);
      aiCache.set(cacheKey, raw, cacheTTLMs);
    }

    // Persist prompt log (fire-and-forget) with retention TTL and redaction
    if (promptLogContext && promptLogContext.promptLoggingEnabled !== false) {
      const costUSD = usage.inputTokens * 0.000001 + usage.outputTokens * 0.000005;
      const expiresAt = new Date(Date.now() + PROMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      promptLogContext.prisma.aIPromptLog.create({
        data: {
          orgId: promptLogContext.orgId,
          userId: promptLogContext.userId,
          feature,
          taskId: promptLogContext.taskId ?? null,
          projectId: promptLogContext.projectId ?? null,
          input: redactSensitive(userPrompt.slice(0, 10000)),
          output: redactSensitive(raw.slice(0, 10000)),
          inputTokens: usage.inputTokens,
          outputTokens: usage.outputTokens,
          costUSD,
          latencyMs,
          model: AI_MODEL,
          cached: false,
          expiresAt,
        },
      }).catch((err: unknown) => log.warn({ err }, 'Failed to persist AI prompt log'));
    }

    return { raw, usage, cached: false };
  } catch (err) {
    aiCallTotal.inc({ feature, status: 'error' });
    return mapAnthropicError(err);
  }
}
