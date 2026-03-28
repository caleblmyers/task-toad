import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../utils/logger.js';
import { callAI } from './aiClient.js';
import { parseJSON } from './responseParser.js';
import { KnowledgeRetrievalResponseSchema } from './aiTypes.js';
import { buildKnowledgeRetrievalPrompt } from './promptBuilders/knowledgeRetrieval.js';
import { FEATURE_CONFIG } from './aiConfig.js';

const log = createChildLogger('kb-retrieval');

/**
 * Retrieve relevant knowledge entries for a given task context.
 * If ≤3 entries exist, returns all. Otherwise uses AI to select the most relevant.
 */
export async function retrieveRelevantKnowledge(
  prisma: PrismaClient,
  projectId: string,
  taskContext: string,
  apiKey: string
): Promise<string> {
  const entries = await prisma.knowledgeEntry.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  if (entries.length === 0) return '';

  // If few entries, return all directly
  if (entries.length <= 10) {
    return entries
      .map(e => `## ${e.title} [${e.category}]\n${e.content}`)
      .join('\n\n');
  }

  // Use AI to select the most relevant entries
  const titles = entries.map(e => ({ id: e.knowledgeEntryId, title: e.title, category: e.category }));
  const prompt = buildKnowledgeRetrievalPrompt(taskContext, titles);
  const config = FEATURE_CONFIG.knowledgeRetrieval;

  try {
    const result = await callAI({
      apiKey,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      maxTokens: config.maxTokens,
      feature: 'knowledgeRetrieval',
      cacheTTLMs: config.cacheTTLMs,
      prefill: '{',
    });

    const parsed = parseJSON(result.raw, KnowledgeRetrievalResponseSchema);
    const selectedIds = new Set(parsed.selectedEntryIds);
    const selected = entries.filter(e => selectedIds.has(e.knowledgeEntryId));

    if (selected.length === 0) {
      log.warn({ projectId, taskContext: taskContext.slice(0, 100) }, 'AI selected no entries, returning top 3');
      return entries.slice(0, 3)
        .map(e => `## ${e.title} [${e.category}]\n${e.content}`)
        .join('\n\n');
    }

    return selected
      .map(e => `## ${e.title} [${e.category}]\n${e.content}`)
      .join('\n\n');
  } catch (err) {
    log.warn({ err, projectId }, 'KB retrieval AI call failed, returning top 3 entries');
    return entries.slice(0, 3)
      .map(e => `## ${e.title} [${e.category}]\n${e.content}`)
      .join('\n\n');
  }
}
