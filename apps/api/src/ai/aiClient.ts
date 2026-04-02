import Anthropic from '@anthropic-ai/sdk';
import { GraphQLError } from 'graphql';
import { z } from 'zod';
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
    client = new Anthropic({ apiKey, maxRetries: 0, timeout: 10 * 60 * 1000 });
    clientCache.set(apiKey, client);
  }
  return client;
}

// ---------------------------------------------------------------------------
// Error classification & mapping — Anthropic SDK errors → GraphQLError
// ---------------------------------------------------------------------------

/** Errors with these codes can be retried with backoff. */
const RETRYABLE_CODES = new Set(['RATE_LIMITED', 'AI_SERVER_ERROR', 'AI_UNAVAILABLE']);

export function isRetryableAIError(err: unknown): boolean {
  if (err instanceof GraphQLError) {
    return RETRYABLE_CODES.has(err.extensions?.code as string);
  }
  return false;
}

/** Detect quota/billing exhaustion vs transient rate limit from a 429 response. */
function isQuotaExhausted(err: InstanceType<typeof Anthropic.RateLimitError>): boolean {
  const msg = (err.message ?? '').toLowerCase();
  return msg.includes('credit') || msg.includes('billing') || msg.includes('quota') || msg.includes('insufficient');
}

function mapAnthropicError(err: unknown): never {
  if (err instanceof GraphQLError) throw err;

  if (err instanceof Anthropic.AuthenticationError) {
    throw new GraphQLError('Invalid Anthropic API key. Update it in Org Settings.', {
      extensions: { code: 'API_KEY_INVALID' },
    });
  }
  if (err instanceof Anthropic.RateLimitError) {
    if (isQuotaExhausted(err)) {
      throw new GraphQLError('Your Anthropic API key has run out of credits. Add credits at console.anthropic.com or update your API key in Org Settings.', {
        extensions: { code: 'AI_QUOTA_EXHAUSTED' },
      });
    }
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
// Retry helper for transient AI errors
// ---------------------------------------------------------------------------

const MAX_RETRIES = 2;
const BASE_DELAY_MS = 1000;

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Core API call with caching, size check, logging
// ---------------------------------------------------------------------------

export interface PromptLogContext {
  prisma: Pick<import('@prisma/client').PrismaClient, 'aIPromptLog'>;
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
  /** Override the default AI model for this call. */
  model?: string;
}

export interface CallAIResult {
  raw: string;
  usage: AIUsage;
  cached: boolean;
}

export async function callAI(params: CallAIParams): Promise<CallAIResult> {
  const { apiKey, systemPrompt, userPrompt, maxTokens, feature, cacheTTLMs = 0, promptLogContext, prefill, model: modelOverride } = params;
  const model = modelOverride ?? AI_MODEL;

  // Check cache first
  if (cacheTTLMs > 0) {
    const cacheKey = hashPrompt(systemPrompt, userPrompt);
    const cached = aiCache.get(cacheKey);
    if (cached) {
      logAICall({
        feature,
        model,
        usage: { inputTokens: 0, outputTokens: 0, stopReason: 'cache_hit' },
        latencyMs: 0,
        cached: true,
      });
      return { raw: cached, usage: { inputTokens: 0, outputTokens: 0, stopReason: 'cache_hit' }, cached: true };
    }
  }

  // Validate prompt fits in context window
  checkPromptSize(systemPrompt, userPrompt, maxTokens);

  let lastError: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      log.info({ feature, attempt, delayMs: delay }, 'Retrying AI call after transient error');
      await sleep(delay);
    }

    const start = Date.now();
    try {
      const response = await getClient(apiKey).messages.create({
        model,
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

      logAICall({ feature, model, usage, latencyMs, cached: false });
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
            model,
            cached: false,
            expiresAt,
          },
        }).catch((err: unknown) => log.warn({ err }, 'Failed to persist AI prompt log'));
      }

      return { raw, usage, cached: false };
    } catch (err) {
      aiCallTotal.inc({ feature, status: 'error' });
      try {
        mapAnthropicError(err);
      } catch (mapped) {
        // Only retry transient errors, not auth/quota/terminal failures
        if (attempt < MAX_RETRIES && isRetryableAIError(mapped)) {
          lastError = mapped;
          continue;
        }
        throw mapped;
      }
    }
  }
  // Should not reach here, but just in case
  throw lastError;
}

// ---------------------------------------------------------------------------
// Pre-validation normalization for AI responses
// ---------------------------------------------------------------------------

/**
 * Normalize common AI response quirks before Zod validation.
 * Handles: trimming whitespace, parsing stringified arrays/objects,
 * defaulting common optional array fields to empty arrays.
 */
function normalizeAIResponse(input: unknown): unknown {
  if (input == null || typeof input !== 'object') return input;

  if (Array.isArray(input)) {
    return input.map(normalizeAIResponse);
  }

  const obj = { ...(input as Record<string, unknown>) };
  for (const [key, val] of Object.entries(obj)) {
    if (typeof val === 'string') {
      const trimmed = val.trim();
      // Try to parse stringified arrays or objects
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        try {
          obj[key] = JSON.parse(trimmed);
          continue;
        } catch { /* leave as trimmed string */ }
      }
      obj[key] = trimmed;
    } else if (Array.isArray(val)) {
      obj[key] = val.map(normalizeAIResponse);
    } else if (val && typeof val === 'object') {
      obj[key] = normalizeAIResponse(val);
    }
  }

  return obj;
}

// ---------------------------------------------------------------------------
// Structured output — grammar-constrained JSON via Anthropic SDK
// ---------------------------------------------------------------------------

export interface CallAIStructuredParams {
  apiKey: string;
  systemPrompt: string;
  userPrompt: string;
  maxTokens: number;
  feature: AIFeature;
  model?: string;
  promptLogContext?: PromptLogContext;
}

export interface CallAIStructuredResult<T> {
  parsed: T;
  usage: AIUsage;
}

/**
 * Call Claude with structured output via tool_use.
 *
 * Defines a fake tool whose input_schema matches the Zod schema,
 * then forces the model to call it. The tool input is always valid
 * parsed JSON — no stripFences/repairJSON needed. Works on all Claude models.
 */
export async function callAIStructured<T>(
  params: CallAIStructuredParams,
  schema: z.ZodType<T>
): Promise<CallAIStructuredResult<T>> {
  const { apiKey, systemPrompt, userPrompt, maxTokens, feature, model: modelOverride, promptLogContext } = params;
  const model = modelOverride ?? AI_MODEL;

  checkPromptSize(systemPrompt, userPrompt, maxTokens);

  // Convert Zod schema to JSON Schema for tool input.
  // Tool input_schema must be type: 'object', so wrap arrays in an object.
  const rawJsonSchema = z.toJSONSchema(schema, { reused: 'ref' }) as Record<string, unknown>;
  const isArrayAtTop = rawJsonSchema.type === 'array';
  const jsonSchema = isArrayAtTop
    ? { type: 'object', properties: { items: rawJsonSchema }, required: ['items'] }
    : rawJsonSchema;

  let lastError: unknown;
  let validationRetried = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt - 1);
      log.info({ feature, attempt, delayMs: delay }, 'Retrying structured AI call');
      await sleep(delay);
    }

    const start = Date.now();
    try {
      const response = await getClient(apiKey).messages.create({
        model,
        max_tokens: maxTokens,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        tools: [{
          name: 'structured_response',
          description: 'Return the structured response',
          input_schema: jsonSchema as Anthropic.Tool.InputSchema,
        }],
        tool_choice: { type: 'tool', name: 'structured_response' },
      });

      const latencyMs = Date.now() - start;
      const usage: AIUsage = {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason ?? 'unknown',
      };

      logAICall({ feature, model, usage, latencyMs, cached: false });
      aiCallTotal.inc({ feature, status: 'success' });
      aiCallDuration.observe({ feature }, latencyMs / 1000);

      // Extract the tool input — already parsed JSON
      const toolBlock = response.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
      if (!toolBlock) {
        throw new GraphQLError('AI did not return structured output');
      }

      // Unwrap if we wrapped an array in an object
      const rawInput = isArrayAtTop
        ? (toolBlock.input as Record<string, unknown>).items
        : toolBlock.input;

      // Coerce stringified fields — sometimes the model returns JSON strings instead of objects/arrays.
      let coercedInput = rawInput;
      if (coercedInput && typeof coercedInput === 'object') {
        const obj = coercedInput as Record<string, unknown>;
        for (const [key, val] of Object.entries(obj)) {
          if (typeof val === 'string' && (val.startsWith('[') || val.startsWith('{'))) {
            try {
              const parsed = JSON.parse(val);
              // If the parsed result is an object with multiple keys that match sibling fields,
              // the AI likely wrapped the entire response in one stringified field — unwrap it.
              if (typeof parsed === 'object' && !Array.isArray(parsed)) {
                const parsedKeys = Object.keys(parsed as Record<string, unknown>);
                const objKeys = Object.keys(obj);
                const isWrapped = objKeys.length <= 2 && parsedKeys.length > objKeys.length;
                if (isWrapped) {
                  coercedInput = parsed;
                  break;
                }
              }
              obj[key] = parsed;
            } catch { /* leave as-is */ }
          }
        }
      }

      // Normalize common AI response quirks before Zod validation
      const normalized = normalizeAIResponse(coercedInput);

      // Validate against Zod schema
      const result = schema.safeParse(normalized);
      if (!result.success) {
        // Retry once with validation error feedback appended to the prompt
        if (!validationRetried) {
          validationRetried = true;
          const errorSummary = result.error.issues
            .slice(0, 5)
            .map((i) => `${i.path.join('.')}: ${i.message}`)
            .join('; ');
          log.warn({ issues: result.error.issues.slice(0, 3) }, 'Structured output validation failed, retrying with error feedback');

          const retryStart = Date.now();
          try {
            const retryResponse = await getClient(apiKey).messages.create({
              model,
              max_tokens: maxTokens,
              system: systemPrompt,
              messages: [
                { role: 'user', content: userPrompt },
                { role: 'assistant', content: [{ type: 'tool_use', id: toolBlock.id, name: 'structured_response', input: toolBlock.input }] },
                { role: 'user', content: [{ type: 'tool_result', tool_use_id: toolBlock.id, content: `Your previous response failed validation: ${errorSummary}. Please return valid JSON matching the schema exactly.` }] },
              ],
              tools: [{
                name: 'structured_response',
                description: 'Return the structured response',
                input_schema: jsonSchema as Anthropic.Tool.InputSchema,
              }],
              tool_choice: { type: 'tool', name: 'structured_response' },
            });

            const retryLatencyMs = Date.now() - retryStart;
            const retryUsage: AIUsage = {
              inputTokens: retryResponse.usage.input_tokens,
              outputTokens: retryResponse.usage.output_tokens,
              stopReason: retryResponse.stop_reason ?? 'unknown',
            };
            logAICall({ feature, model, usage: retryUsage, latencyMs: retryLatencyMs, cached: false });

            const retryToolBlock = retryResponse.content.find((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
            if (retryToolBlock) {
              const retryRawInput = isArrayAtTop
                ? (retryToolBlock.input as Record<string, unknown>).items
                : retryToolBlock.input;
              const retryResult = schema.safeParse(retryRawInput);
              if (retryResult.success) {
                return { parsed: retryResult.data, usage: retryUsage };
              }
            }
          } catch (retryErr) {
            log.warn({ err: retryErr }, 'Validation retry AI call failed');
          }
        }

        log.error({ issues: result.error.issues.slice(0, 3) }, 'Structured output validation failed');
        throw new GraphQLError('AI response did not match expected format');
      }

      const parsed = result.data;

      // Persist prompt log (fire-and-forget)
      if (promptLogContext && promptLogContext.promptLoggingEnabled !== false) {
        const costUSD = usage.inputTokens * 0.000003 + usage.outputTokens * 0.000015;
        const expiresAt = new Date(Date.now() + PROMPT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const raw = JSON.stringify(parsed);
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
            model,
            cached: false,
            expiresAt,
          },
        }).catch((err: unknown) => log.warn({ err }, 'Failed to persist AI prompt log'));
      }

      return { parsed, usage };
    } catch (err) {
      aiCallTotal.inc({ feature, status: 'error' });
      try {
        mapAnthropicError(err);
      } catch (mapped) {
        if (attempt < MAX_RETRIES && isRetryableAIError(mapped)) {
          lastError = mapped;
          continue;
        }
        throw mapped;
      }
    }
  }
  throw lastError;
}
