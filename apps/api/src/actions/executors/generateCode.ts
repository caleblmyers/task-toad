import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { generateCode as aiGenerateCode } from '../../ai/aiService.js';
import { fetchProjectFileTree } from '../../github/githubFileService.js';
import { commitFiles } from '../../github/githubCommitService.js';

const GenerateCodeConfigSchema = z.object({
  styleGuide: z.string().optional(),
}).passthrough();

export const generateCodeExecutor: ActionExecutor = {
  type: 'generate_code',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, project, apiKey, signal } = ctx;

    if (!task.instructions) {
      return { success: false, data: { error: 'Task has no instructions' } };
    }

    // Check for cancellation before starting
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Fetch project file tree for context (use feature branch if available)
    let projectFiles: Array<{ path: string; language: string; size: number }> | undefined;
    if (ctx.repo) {
      projectFiles = await fetchProjectFileTree(ctx.repo, ctx.plan.branchName ?? undefined).catch(() => undefined);
    }

    const config = GenerateCodeConfigSchema.parse(JSON.parse(ctx.action.config || '{}'));

    // Check for cancellation before calling AI
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    const result = await aiGenerateCode(
      apiKey,
      task.title,
      task.description ?? '',
      task.instructions,
      project.name,
      project.description ?? '',
      projectFiles,
      config.styleGuide ?? null,
      ctx.knowledgeContext ?? project.knowledgeBase,
    );

    // Check for cancellation after AI response
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Commit generated files to feature branch if repo is connected
    let headOid: string | undefined;
    if (ctx.repo && ctx.plan.branchName && ctx.plan.headOid) {
      const commitResult = await commitFiles(
        ctx.repo,
        {
          branch: ctx.plan.branchName,
          message: `feat: ${ctx.task.title}`,
          additions: result.files.map((f: { path: string; content: string }) => ({ path: f.path, content: f.content })),
        },
        ctx.plan.headOid,
      );
      headOid = commitResult.oid;
    }

    return {
      success: true,
      data: {
        files: result.files,
        summary: result.summary,
        estimatedTokensUsed: result.estimatedTokensUsed,
        headOid,
      },
    };
  },
};
