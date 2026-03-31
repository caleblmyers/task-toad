import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { callAIStructured } from '../../ai/aiClient.js';
import { SYSTEM_JSON } from '../../ai/aiConfig.js';
import { userInput } from '../../ai/promptBuilder.js';
import { commitFiles } from '../../github/githubCommitService.js';

const WriteDocsConfigSchema = z.object({
  docType: z.enum(['readme', 'api-docs', 'changelog']),
}).passthrough();

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
    const config = WriteDocsConfigSchema.parse(JSON.parse(ctx.action.config || '{}'));

    const docType = config.docType || 'readme';

    // Check for cancellation before calling AI
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Build full context from upstream tasks, previous steps, and failure history
    let fullContext = ctx.knowledgeContext ?? ctx.project.knowledgeBase ?? '';
    if (ctx.upstreamTaskContext) {
      fullContext = `## Upstream Task Context\n${ctx.upstreamTaskContext}\n\n${fullContext}`;
    }
    if (ctx.previousStepContext) {
      fullContext = `## Previous Steps in This Plan\n${ctx.previousStepContext}\n\n${fullContext}`;
    }
    if (ctx.failureContext) {
      fullContext = `## Previous Attempt Failed\n${ctx.failureContext}\n\n${fullContext}`;
    }

    let contextSection = '';
    if (fullContext.trim()) {
      contextSection = `\nContext:\n${fullContext}\n`;
    }

    const result = await callAIStructured({
      apiKey,
      systemPrompt: SYSTEM_JSON,
      userPrompt: `Generate a concise ${docType} doc for this task (under 100 lines).

Task: ${userInput('title', task.title)}
Description: ${userInput('description', task.description ?? '')}
Project: ${userInput('project', project.name)}
${project.description ? `Project description: ${userInput('projectDescription', project.description)}` : ''}
${contextSection}
Generate ONE documentation file. Keep it brief — project overview, setup steps, and basic usage.`,
      maxTokens: 4096,
      feature: 'generateCode',
    }, DocsResultSchema);

    const parsed = result.parsed;

    // Check for cancellation before committing
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Commit docs to feature branch if repo is connected
    let headOid: string | undefined;
    if (ctx.repo && ctx.plan.branchName && ctx.plan.headOid) {
      try {
        const commitResult = await commitFiles(
          ctx.repo,
          {
            branch: ctx.plan.branchName,
            message: `docs: ${parsed.summary || ctx.task.title}`,
            additions: parsed.files.map(f => ({ path: f.path, content: f.content })),
          },
          ctx.plan.headOid,
        );
        headOid = commitResult.oid;
      } catch (commitErr) {
        const msg = commitErr instanceof Error ? commitErr.message : 'Unknown commit error';
        return { success: false, data: { error: `Failed to commit docs to branch: ${msg}`, files: parsed.files, summary: parsed.summary } };
      }
    }

    return {
      success: true,
      data: { files: parsed.files, summary: parsed.summary, headOid },
    };
  },
};
