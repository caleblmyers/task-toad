import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import {
  mergePullRequest,
  getPullRequestState,
  updatePullRequestBranch,
} from '../../github/githubPullRequestService.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('merge-pr-executor');

const MergePRConfigSchema = z.object({
  sourcePRActionId: z.string(),
  mergeMethod: z.enum(['SQUASH', 'MERGE', 'REBASE']).optional(),
}).passthrough();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const mergePRExecutor: ActionExecutor = {
  type: 'merge_pr',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, prisma, signal } = ctx;
    const config = MergePRConfigSchema.parse(JSON.parse(ctx.action.config || '{}'));

    // Get PR details from a previous create_pr action result
    const prResult = ctx.previousResults.get(config.sourcePRActionId) as
      | { number?: number; pullRequestId?: string }
      | undefined;

    if (!prResult?.pullRequestId) {
      return { success: false, data: { error: 'No PR ID from source create_pr action' } };
    }

    const project = await prisma.project.findUnique({
      where: { projectId: task.projectId },
      select: {
        githubInstallationId: true,
        githubRepositoryOwner: true,
        githubRepositoryName: true,
      },
    });

    if (!project?.githubInstallationId) {
      return { success: false, data: { error: 'No GitHub repository connected to project' } };
    }

    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Check PR state before attempting merge
    try {
      const prState = await getPullRequestState(
        project.githubInstallationId,
        prResult.pullRequestId,
      );

      if (prState.state === 'MERGED') {
        log.info({ prNumber: prState.number, url: prState.url }, 'PR already merged');
        return {
          success: true,
          data: {
            merged: true,
            prNumber: prState.number,
            url: prState.url,
            mergeMethod: config.mergeMethod ?? 'SQUASH',
            alreadyMerged: true,
          },
        };
      }

      if (prState.state === 'CLOSED') {
        return {
          success: false,
          data: { error: 'PR is closed and cannot be merged' },
        };
      }
    } catch (err) {
      log.warn({ err }, 'Failed to check PR state — proceeding with merge attempt');
    }

    // Attempt merge
    const owner = project.githubRepositoryOwner!;
    const repo = project.githubRepositoryName!;
    const mergeMethod = config.mergeMethod ?? 'SQUASH';

    const result = await mergePullRequest(
      project.githubInstallationId,
      prResult.pullRequestId,
      mergeMethod,
    );

    if (result.merged) {
      log.info({ prNumber: result.number, url: result.url }, 'PR merged successfully');
      return {
        success: true,
        data: {
          merged: true,
          prNumber: result.number,
          url: result.url,
          mergeMethod,
        },
      };
    }

    // Handle structured error reasons
    if (result.errorReason === 'already_merged') {
      log.info('PR was already merged');
      return {
        success: true,
        data: {
          merged: true,
          prNumber: prResult.number ?? result.number,
          url: result.url,
          mergeMethod,
          alreadyMerged: true,
        },
      };
    }

    if (result.errorReason === 'conflict') {
      return {
        success: false,
        data: {
          error: 'PR has merge conflicts that require manual resolution',
          errorReason: 'conflict',
        },
      };
    }

    if (result.errorReason === 'out_of_date' && prResult.number) {
      // Auto-update branch and retry once
      log.info({ prNumber: prResult.number }, 'PR out of date — updating branch and retrying');
      const updateResult = await updatePullRequestBranch(
        project.githubInstallationId,
        owner,
        repo,
        prResult.number,
      );

      if (updateResult.updated) {
        // Wait for GitHub to process the branch update
        await sleep(5000);

        if (signal?.aborted) {
          throw new DOMException('Action cancelled', 'AbortError');
        }

        const retryResult = await mergePullRequest(
          project.githubInstallationId,
          prResult.pullRequestId,
          mergeMethod,
        );

        if (retryResult.merged) {
          log.info({ prNumber: retryResult.number, url: retryResult.url }, 'PR merged after branch update');
          return {
            success: true,
            data: {
              merged: true,
              prNumber: retryResult.number,
              url: retryResult.url,
              mergeMethod,
              retriedAfterUpdate: true,
            },
          };
        }

        // Retry failed — return specific error
        if (retryResult.errorReason === 'conflict') {
          return {
            success: false,
            data: {
              error: 'PR has merge conflicts that require manual resolution',
              errorReason: 'conflict',
            },
          };
        }

        return {
          success: false,
          retryable: true,
          data: {
            error: 'Failed to merge PR after updating branch — check branch protection rules',
            errorReason: retryResult.errorReason,
          },
        };
      }

      return {
        success: false,
        retryable: true,
        data: {
          error: 'PR is out of date and branch update failed — retrying',
          errorReason: 'out_of_date',
        },
      };
    }

    return {
      success: false,
      retryable: true,
      data: {
        error: 'GitHub refused to merge — check for merge conflicts or branch protection rules',
        errorReason: result.errorReason,
      },
    };
  },
};
