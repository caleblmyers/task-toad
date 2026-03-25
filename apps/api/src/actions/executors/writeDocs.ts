import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { callAIStructured } from '../../ai/aiClient.js';
import { SYSTEM_JSON } from '../../ai/aiConfig.js';
import { userInput } from '../../ai/promptBuilder.js';

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
    const { task, project, apiKey, signal } = ctx;
    const config: WriteDocsConfig = JSON.parse(ctx.action.config || '{}');

    const docType = config.docType || 'readme';

    // Check for cancellation before calling AI
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    const result = await callAIStructured({
      apiKey,
      systemPrompt: SYSTEM_JSON,
      userPrompt: `Generate a concise ${docType} doc for this task (under 100 lines).

Task: ${userInput('title', task.title)}
Description: ${userInput('description', task.description ?? '')}
Project: ${userInput('project', project.name)}
${project.description ? `Project description: ${userInput('projectDescription', project.description)}` : ''}

Generate ONE documentation file. Keep it brief — project overview, setup steps, and basic usage.`,
      maxTokens: 4096,
      feature: 'generateCode',
    }, DocsResultSchema);

    return {
      success: true,
      data: { files: result.parsed.files, summary: result.parsed.summary },
    };
  },
};
