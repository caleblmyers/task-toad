import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { getPullRequestDiff } from '../../github/githubPullRequestService.js';
import { reviewCode } from '../../ai/aiService.js';

interface ReviewPRConfig {
  sourcePRActionId: string; // ID of the create_pr action whose result contains PR number
}

export const reviewPRExecutor: ActionExecutor = {
  type: 'review_pr',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, apiKey, prisma, signal } = ctx;
    const config: ReviewPRConfig = JSON.parse(ctx.action.config || '{}');

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

    // Run AI code review
    const review = await reviewCode(apiKey, {
      taskTitle: task.title,
      taskDescription: task.description ?? '',
      taskInstructions: task.instructions ?? undefined,
      diff,
      projectName: project.name ?? ctx.project.name,
    });

    // Always return success — a negative review is information, not a failure
    return {
      success: true,
      data: {
        review,
        approved: review.approved,
        prNumber: prResult.number,
      },
    };
  },
};
