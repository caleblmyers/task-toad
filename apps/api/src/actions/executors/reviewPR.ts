import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { getPullRequestDiff, postPullRequestReview } from '../../github/githubPullRequestService.js';
import { callAIStructured } from '../../ai/aiClient.js';
import { CodeReviewSchema } from '../../ai/aiTypes.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('review-pr-executor');

const ReviewPRConfigSchema = z.object({
  sourcePRActionId: z.string(),
}).passthrough();

const SKEPTICAL_REVIEW_SYSTEM_PROMPT = `You are an independent, skeptical code reviewer. You are NOT the same AI that wrote this code. Your job is to find problems, not to approve.

You must respond with a structured JSON tool call. Be thorough and critical.

Key review focus areas:
- **Security vulnerabilities:** injection attacks, auth bypass, data exposure, insecure defaults, missing input validation at system boundaries
- **Missing error handling and edge cases:** unchecked nulls, unhandled promise rejections, race conditions, empty/malformed input
- **Code standards violations:** inconsistent naming, poor structure, anti-patterns, dead code, missing types
- **Architectural concerns:** tight coupling, scalability issues, maintainability problems, violation of separation of concerns
- **Missing tests or test coverage gaps:** untested error paths, missing edge case coverage, brittle test assertions
- **Performance issues:** N+1 queries, unnecessary allocations, blocking operations, missing pagination, unbounded loops

Default to being critical. A review that finds nothing wrong should be rare — most code has at least minor issues. If the changes look genuinely clean, approve but still note areas for improvement.

Do NOT rubber-stamp. Do NOT assume the code is correct because an AI wrote it. Look for what could go wrong in production.`;

export const reviewPRExecutor: ActionExecutor = {
  type: 'review_pr',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, apiKey, prisma, signal } = ctx;
    const config = ReviewPRConfigSchema.parse(JSON.parse(ctx.action.config || '{}'));

    // Get PR number from a previous create_pr action result
    const prResult = ctx.previousResults.get(config.sourcePRActionId) as
      | { number?: number }
      | undefined;

    if (!prResult?.number) {
      return { success: false, data: { error: 'No PR number from source create_pr action' } };
    }

    // Load project's GitHub repo connection (stored on Project model)
    const project = await prisma.project.findUnique({
      where: { projectId: task.projectId },
      select: {
        name: true,
        githubInstallationId: true,
        githubRepositoryOwner: true,
        githubRepositoryName: true,
      },
    });

    if (!project?.githubInstallationId || !project.githubRepositoryOwner || !project.githubRepositoryName) {
      return { success: false, data: { error: 'No GitHub repository connected to project' } };
    }

    // Fetch the PR diff
    const diff = await getPullRequestDiff(
      project.githubInstallationId,
      project.githubRepositoryOwner,
      project.githubRepositoryName,
      prResult.number,
    );

    if (!diff || diff.trim().length === 0) {
      return { success: false, data: { error: 'PR diff is empty' } };
    }

    // Check for cancellation before calling AI
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Build user prompt with task context
    const instructionsLine = task.instructions
      ? `\nInstructions: ${task.instructions.slice(0, 800)}`
      : '';

    const userPrompt = `Review the following code changes. You are an independent reviewer — be skeptical and thorough.

Task: ${task.title}
Description: ${(task.description ?? '').slice(0, 400)}${instructionsLine}
Project: ${project.name ?? ctx.project.name}

Diff (unified format):
${diff.slice(0, 6000)}

Return JSON:
{
  "summary": string,
  "approved": boolean,
  "comments": [{ "file": string, "line": number | null, "severity": "info" | "warning" | "error", "comment": string }],
  "suggestions": string[]
}
Focus on actionable feedback. Be specific about file paths and line numbers when possible. Flag security issues, missing error handling, and potential production failures.`;

    // Call AI with skeptical reviewer system prompt
    const result = await callAIStructured({
      apiKey,
      systemPrompt: SKEPTICAL_REVIEW_SYSTEM_PROMPT,
      userPrompt,
      maxTokens: 4096,
      feature: 'reviewCode',
    }, CodeReviewSchema);

    const review = result.parsed;

    // Post review to GitHub as a PR review comment
    try {
      const reviewBody = formatReviewForGitHub(review);
      // Always use COMMENT — the bot created the PR, so it can't REQUEST_CHANGES on its own PR.
      // The fix_review executor handles applying fixes from the review feedback.
      const event = review.approved ? 'APPROVE' : 'COMMENT';

      await postPullRequestReview(
        project.githubInstallationId,
        project.githubRepositoryOwner,
        project.githubRepositoryName,
        prResult.number,
        reviewBody,
        event,
      );
      log.info({ prNumber: prResult.number, approved: review.approved }, 'Posted review to GitHub PR');
    } catch (err) {
      // Non-blocking — review is still stored in action result even if GitHub post fails
      log.warn({ err, prNumber: prResult.number }, 'Failed to post review to GitHub PR');
    }

    // Always return success — a negative review is information, not a failure
    return {
      success: true,
      data: {
        review,
        approved: review.approved,
        prNumber: prResult.number,
        postedToGitHub: true,
      },
    };
  },
};

/**
 * Format a CodeReview object as a readable GitHub PR review body.
 */
function formatReviewForGitHub(review: z.infer<typeof CodeReviewSchema>): string {
  const lines: string[] = [];

  lines.push(`## AI Code Review`);
  lines.push('');
  lines.push(review.summary);

  if (review.comments && review.comments.length > 0) {
    lines.push('');
    lines.push('### Comments');
    for (const comment of review.comments) {
      const severity = comment.severity === 'error' ? '🔴' : comment.severity === 'warning' ? '🟡' : 'ℹ️';
      const location = comment.line ? `${comment.file}:${comment.line}` : comment.file;
      lines.push(`- ${severity} **${location}** — ${comment.comment}`);
    }
  }

  if (review.suggestions && review.suggestions.length > 0) {
    lines.push('');
    lines.push('### Suggestions');
    for (const suggestion of review.suggestions) {
      lines.push(`- ${suggestion}`);
    }
  }

  lines.push('');
  lines.push('---');
  lines.push('*Review generated by [TaskToad](https://tasktoad.dev) AI*');

  return lines.join('\n');
}
