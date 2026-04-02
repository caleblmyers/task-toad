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
  // Fetch project-specific KB entries
  const projectEntries = await prisma.knowledgeEntry.findMany({
    where: { projectId },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch org-level KB entries (applies to all projects in the org)
  const project = await prisma.project.findUnique({
    where: { projectId },
    select: { orgId: true },
  });
  const orgEntries = project
    ? await prisma.knowledgeEntry.findMany({
        where: { orgId: project.orgId, projectId: null },
        orderBy: { createdAt: 'desc' },
      })
    : [];

  // Combine: project entries first (higher priority), then org entries
  const entries = [...projectEntries, ...orgEntries];

  if (entries.length === 0) return '';

  // Track which entries are org-level for labeling
  const orgEntryIds = new Set(orgEntries.map(e => e.knowledgeEntryId));
  const formatEntry = (e: typeof entries[number]) => {
    const prefix = orgEntryIds.has(e.knowledgeEntryId) ? '[Org] ' : '';
    return `## ${prefix}${e.title} [${e.category}]\n${e.content}`;
  };

  // If few entries, return all directly
  if (entries.length <= 10) {
    return entries.map(formatEntry).join('\n\n');
  }

  // Use AI to select the most relevant entries
  const titles = entries.map(e => ({
    id: e.knowledgeEntryId,
    title: `${orgEntryIds.has(e.knowledgeEntryId) ? '[Org] ' : ''}${e.title}`,
    category: e.category,
  }));
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
      return entries.slice(0, 3).map(formatEntry).join('\n\n');
    }

    return selected.map(formatEntry).join('\n\n');
  } catch (err) {
    log.warn({ err, projectId }, 'KB retrieval AI call failed, returning top 3 entries');
    return entries.slice(0, 3).map(formatEntry).join('\n\n');
  }
}
