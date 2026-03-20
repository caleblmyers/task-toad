import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { FEATURE_CONFIG } from '../../ai/aiConfig.js';
import { callAI } from '../../ai/aiClient.js';
import { parseJSON } from '../../ai/responseParser.js';
import { SYSTEM_JSON } from '../../ai/aiConfig.js';
import { userInput } from '../../ai/promptBuilder.js';
import { truncate, MAX_KB_CHARS } from '../../ai/promptBuilders/utils.js';

interface WriteDocsConfig {
  docType: 'readme' | 'api-docs' | 'changelog';
}

const DocsResultSchema = z.object({
  files: z.array(z.object({
    path: z.string(),
    content: z.string(),
    description: z.string().optional().default(''),
  })),
  summary: z.string(),
});

export const writeDocsExecutor: ActionExecutor = {
  type: 'write_docs',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, project, apiKey } = ctx;
    const config: WriteDocsConfig = JSON.parse(ctx.action.config || '{}');

    const docType = config.docType || 'readme';

    const prompt = {
      systemPrompt: SYSTEM_JSON,
      userPrompt: `Generate ${docType} documentation for this task.

Task: ${userInput('title', task.title)}
Description: ${userInput('description', task.description ?? '')}
Instructions: ${userInput('instructions', task.instructions ?? '')}
Project: ${userInput('project', project.name)}
${project.description ? `Project description: ${userInput('projectDescription', project.description)}` : ''}
${ctx.knowledgeContext ? `\nKnowledge Base:\n${userInput('knowledge_base', truncate(ctx.knowledgeContext, MAX_KB_CHARS))}` : ''}

Return JSON:
{
  "files": [{ "path": string, "content": string, "description": string }],
  "summary": string
}
Generate appropriate markdown documentation. Use sensible file paths relative to the project root.`,
    };

    // Reuse generateCode config as the closest match for doc generation
    const featureConfig = FEATURE_CONFIG.generateCode;
    const result = await callAI({
      apiKey,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      maxTokens: featureConfig.maxTokens,
      feature: 'generateCode',
      cacheTTLMs: 0,
      prefill: '{',
    });

    const parsed = parseJSON(result.raw, DocsResultSchema);
    return {
      success: true,
      data: { files: parsed.files, summary: parsed.summary },
    };
  },
};
