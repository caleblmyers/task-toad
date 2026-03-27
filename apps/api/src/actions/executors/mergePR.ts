import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { mergePullRequest } from '../../github/githubPullRequestService.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('merge-pr-executor');

const MergePRConfigSchema = z.object({
  sourcePRActionId: z.string(),
  mergeMethod: z.enum(['SQUASH', 'MERGE', 'REBASE']).optional(),
}).passthrough();

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

    try {
      const result = await mergePullRequest(
        project.githubInstallationId,
        prResult.pullRequestId,
        config.mergeMethod ?? 'SQUASH',
      );

      if (!result.merged) {
        return { success: false, data: { error: 'GitHub refused to merge — check for merge conflicts or branch protection rules' } };
      }

      log.info({ prNumber: result.number, url: result.url }, 'PR merged successfully');

      return {
        success: true,
        data: {
          merged: true,
          prNumber: result.number,
          url: result.url,
          mergeMethod: config.mergeMethod ?? 'SQUASH',
        },
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, data: { error: `Failed to merge PR: ${msg}` } };
    }
  },
};
