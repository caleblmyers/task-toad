import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { generateCode as aiGenerateCode } from '../../ai/aiService.js';
import { fetchProjectFileTree } from '../../github/githubFileService.js';
import { commitFiles } from '../../github/githubCommitService.js';
import { resolveCodeGenContext } from '../../github/repoContextService.js';

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
    let repoContext: Array<{ path: string; language: string; content: string; relevanceReason: string }> | undefined;
    if (ctx.repo) {
      projectFiles = await fetchProjectFileTree(ctx.repo, ctx.plan.branchName ?? undefined).catch(() => undefined);

      // Resolve relevant file contents from the repo for richer AI context
      repoContext = await resolveCodeGenContext(
        ctx.repo,
        { title: task.title, description: task.description, instructions: task.instructions },
        16000,
      ).then((r) => r.relevantFiles).catch(() => undefined);
    }

    const config = GenerateCodeConfigSchema.parse(JSON.parse(ctx.action.config || '{}'));

    // Check for cancellation before calling AI
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    let fullContext = ctx.knowledgeContext ?? project.knowledgeBase ?? '';
    if (ctx.failureContext) {
      fullContext = `## Previous Attempt Failed\n${ctx.failureContext}\n\n${fullContext}`;
    }
    if (ctx.previousStepContext) {
      fullContext = `## Previous Steps in This Plan\n${ctx.previousStepContext}\n\n${fullContext}`;
    }
    if (ctx.upstreamTaskContext) {
      fullContext = `## Upstream Task Context\n${ctx.upstreamTaskContext}\n\n${fullContext}`;
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
      fullContext || null,
      undefined, // promptLogContext
      repoContext,
    );

    // Check for cancellation after AI response
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Commit generated files to feature branch if repo is connected
    let headOid: string | undefined;
    if (ctx.repo && ctx.plan.branchName && ctx.plan.headOid) {
      try {
        const commitResult = await commitFiles(
          ctx.repo,
          {
            branch: ctx.plan.branchName,
            message: `feat: ${ctx.task.title}`,
            additions: result.files.map((f: { path: string; content: string }) => ({ path: f.path, content: f.content })),
          },
          ctx.plan.headOid,
          ctx.userGitHubToken,
        );
        headOid = commitResult.oid;
      } catch (commitErr) {
        const msg = commitErr instanceof Error ? commitErr.message : 'Unknown commit error';
        return { success: false, data: { error: `Failed to commit generated code to branch: ${msg}`, files: result.files, summary: result.summary } };
      }
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
