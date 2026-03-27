import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { commitFiles } from '../../github/githubCommitService.js';
import { callAIStructured } from '../../ai/aiClient.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('fix-review');

const FixReviewConfigSchema = z.object({
  sourceReviewActionId: z.string(),
}).passthrough();

const FixReviewResponseSchema = z.object({
  fixes: z.array(z.object({
    path: z.string(),
    content: z.string(),
    description: z.string(),
  })),
  commitMessage: z.string(),
  deferredIssues: z.array(z.object({
    title: z.string(),
    description: z.string(),
    severity: z.enum(['warning', 'error']),
  })),
  summary: z.string(),
});

export const fixReviewExecutor: ActionExecutor = {
  type: 'fix_review',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, project, apiKey, previousResults, signal } = ctx;
    const config = FixReviewConfigSchema.parse(JSON.parse(ctx.action.config || '{}'));

    // Get review result from previous review_pr action
    const reviewResult = previousResults.get(config.sourceReviewActionId) as
      | { approved?: boolean; summary?: string; comments?: Array<{ file: string; line?: number; severity: string; comment: string }>; suggestions?: string[] }
      | undefined;

    if (!reviewResult) {
      return { success: false, data: { error: 'No review result found from source review_pr action' } };
    }

    // If review was approved, nothing to fix
    if (reviewResult.approved === true) {
      return { success: true, data: { skipped: true, reason: 'Review approved, no fixes needed' } };
    }

    // Build review feedback context for AI
    const commentLines = reviewResult.comments?.length
      ? reviewResult.comments
          .slice(0, 30)
          .map((c) => `${c.file}${c.line ? `:${c.line}` : ''} [${c.severity}] ${c.comment}`)
          .join('\n')
      : '(no specific comments)';

    const suggestionLines = reviewResult.suggestions?.length
      ? reviewResult.suggestions.join('\n- ')
      : '';

    // Check for cancellation before AI call
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    const systemPrompt = `You are a code fix agent. You receive code review feedback and generate fixes.
Only fix small, clear issues: typos, missing error handling, simple bugs, naming issues, missing null checks.
For larger issues (architectural changes, new features, redesigns, missing test suites), output them as \`deferredIssues\` — do NOT attempt to fix them.
Return valid JSON matching the required schema.`;

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

    const userPrompt = `Fix the issues found in this code review.

Task: ${task.title}
${task.instructions ? `Instructions: ${task.instructions}` : ''}

Review Summary: ${reviewResult.summary || '(no summary)'}

Review Comments:
${commentLines}
${suggestionLines ? `\nGeneral Suggestions:\n- ${suggestionLines}` : ''}

Project: ${project.name}
${project.description ? `Project Description: ${project.description}` : ''}
${contextSection}
Generate fixes for small issues and defer larger ones. Each fix should contain the complete file content for the file being fixed.`;

    const aiResult = await callAIStructured(
      {
        apiKey,
        systemPrompt,
        userPrompt,
        maxTokens: 8000,
        feature: 'generateReviewFix',
      },
      FixReviewResponseSchema,
    );

    if (!aiResult.parsed) {
      return { success: false, data: { error: 'AI did not return valid fix response' } };
    }

    const parsed = aiResult.parsed;

    // Check for cancellation after AI call
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Commit fixes to the branch if we have any
    let headOid: string | undefined;
    if (parsed.fixes.length > 0 && ctx.repo && ctx.plan.branchName && ctx.plan.headOid) {
      try {
        const commitResult = await commitFiles(
          ctx.repo,
          {
            branch: ctx.plan.branchName,
            message: parsed.commitMessage,
            additions: parsed.fixes.map((f) => ({ path: f.path, content: f.content })),
          },
          ctx.plan.headOid,
          ctx.userGitHubToken,
        );
        headOid = commitResult.oid;

        log.info(
          { actionId: ctx.action.id, commitOid: headOid, filesChanged: parsed.fixes.length },
          'Review fix committed',
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        return { success: false, data: { error: `Failed to commit review fixes: ${msg}` } };
      }
    }

    // Create backlog tasks for deferred issues
    let tasksCreated = 0;
    for (const issue of parsed.deferredIssues) {
      const existing = await ctx.prisma.task.findFirst({
        where: {
          projectId: task.projectId,
          title: { contains: issue.title.slice(0, 30), mode: 'insensitive' },
          archived: false,
        },
      });
      if (!existing) {
        await ctx.prisma.task.create({
          data: {
            title: issue.title,
            description: `From AI code review of "${task.title}":\n\n${issue.description}`,
            status: 'todo',
            projectId: task.projectId,
            orgId: ctx.orgId,
            taskType: 'task',
            priority: issue.severity === 'error' ? 'high' : 'medium',
          },
        });
        tasksCreated++;
      }
    }

    return {
      success: true,
      data: {
        fixCount: parsed.fixes.length,
        deferredCount: parsed.deferredIssues.length,
        tasksCreated,
        headOid,
        summary: parsed.summary,
      },
    };
  },
};
