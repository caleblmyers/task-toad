import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { commitFiles } from '../../github/githubCommitService.js';
import { getPullRequestFiles } from '../../github/githubPullRequestService.js';
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
    // The review_pr executor stores results as { review: { approved, comments, suggestions, summary }, approved, prNumber }
    const rawReviewResult = previousResults.get(config.sourceReviewActionId) as
      | { review?: { approved?: boolean; summary?: string; comments?: Array<{ file: string; line?: number; severity: string; comment: string }>; suggestions?: string[] }; approved?: boolean; prNumber?: number }
      | undefined;

    if (!rawReviewResult) {
      return { success: false, data: { error: 'No review result found from source review_pr action' } };
    }

    // Unwrap nested review object — the actual review data lives under .review
    type ReviewData = { approved?: boolean; summary?: string; comments?: Array<{ file: string; line?: number; severity: string; comment: string }>; suggestions?: string[] };
    const review: ReviewData = rawReviewResult.review ?? rawReviewResult as unknown as ReviewData;
    const approved = rawReviewResult.approved ?? review.approved;

    // If review was approved, nothing to fix
    if (approved === true) {
      return { success: true, data: { skipped: true, reason: 'Review approved, no fixes needed' } };
    }

    // Build review feedback context for AI
    const comments = review.comments ?? [];
    const commentLines = comments.length > 0
      ? comments
          .slice(0, 30)
          .map((c) => `${c.file}${c.line ? `:${c.line}` : ''} [${c.severity}] ${c.comment}`)
          .join('\n')
      : '(no specific comments)';

    const suggestionLines = review.suggestions?.length
      ? review.suggestions.join('\n- ')
      : '';

    // Fetch the actual source code from the PR so the AI can generate accurate fixes
    let sourceCodeContext = '';
    const prNumber = rawReviewResult.prNumber;
    if (prNumber && ctx.repo) {
      try {
        const project = await ctx.prisma.project.findUnique({
          where: { projectId: task.projectId },
          select: { githubInstallationId: true, githubRepositoryOwner: true, githubRepositoryName: true },
        });
        if (project?.githubInstallationId && project.githubRepositoryOwner && project.githubRepositoryName) {
          // Only fetch files that were mentioned in review comments
          const mentionedFiles = new Set(comments.map((c: { file: string }) => c.file));
          const allFiles = await getPullRequestFiles(
            project.githubInstallationId,
            project.githubRepositoryOwner,
            project.githubRepositoryName,
            prNumber,
          );
          const relevantFiles = allFiles.filter((f) => mentionedFiles.has(f.path));
          if (relevantFiles.length > 0) {
            sourceCodeContext = relevantFiles
              .map((f) => `### ${f.path}\n\`\`\`\n${f.content.slice(0, 4000)}\n\`\`\``)
              .join('\n\n');
          }
        }
      } catch (err) {
        log.warn({ err, prNumber }, 'Failed to fetch PR files for fix context (non-blocking)');
      }
    }

    // Check for cancellation before AI call
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    const systemPrompt = `You are a code fix agent. You receive code review feedback along with the current source code and produce corrected files and well-scoped follow-up tasks.

Your goal is cohesive, production-quality code — not just patching individual lines. Consider how review comments relate to each other and address them holistically. A single well-thought-out refactor that resolves five related comments is better than five isolated patches.

**Fixing:** Apply every improvement you can deliver correctly in one commit. This includes security hardening, input validation, error handling, naming, structure, and any other concrete code change. Use the full source code provided to ensure your fixes are accurate and complete. Each fix must contain the COMPLETE file content.

**Deferring:** Create focused, actionable tasks for work that genuinely can't be done well in this commit — things that need new infrastructure (rate limiting middleware, test suites), cross-cutting changes across files you don't have, or design decisions that need human input. Each deferred task should have a clear title and enough description that someone can pick it up independently.

Use your judgment. The bar is: will this fix make the code better without introducing new problems? If yes, fix it.
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

Review Summary: ${review.summary || '(no summary)'}

Review Comments:
${commentLines}
${suggestionLines ? `\nGeneral Suggestions:\n- ${suggestionLines}` : ''}
${sourceCodeContext ? `\n## Current Source Code (files mentioned in review)\n${sourceCodeContext}` : ''}

Project: ${project.name}
${project.description ? `Project Description: ${project.description}` : ''}
${contextSection}
Address the review holistically. Fix everything you can do well in one commit. Defer what genuinely needs separate work, with clear actionable descriptions.`;

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
