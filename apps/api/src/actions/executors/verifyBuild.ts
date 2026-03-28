import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { getInstallationToken } from '../../github/githubAppAuth.js';
import { getJobQueue } from '../../infrastructure/jobqueue/index.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('verify-build');

/** Delay between poll attempts (30 seconds). */
const POLL_DELAY_MS = 30_000;
/** Max polling attempts — 20 × 30s = ~10 minutes. */
const MAX_POLL_ATTEMPTS = 20;

interface CheckRun {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  html_url: string;
}

interface CheckRunsResponse {
  total_count: number;
  check_runs: CheckRun[];
}

export const verifyBuildExecutor: ActionExecutor = {
  type: 'verify_build',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, prisma, signal } = ctx;
    const project = await prisma.project.findUnique({
      where: { projectId: task.projectId },
      select: {
        githubInstallationId: true,
        githubRepositoryOwner: true,
        githubRepositoryName: true,
        githubDefaultBranch: true,
      },
    });

    if (!project?.githubInstallationId || !project.githubRepositoryOwner || !project.githubRepositoryName) {
      return { success: true, data: { skipped: true, reason: 'No GitHub repository connected' } };
    }

    const owner = encodeURIComponent(project.githubRepositoryOwner);
    const repo = encodeURIComponent(project.githubRepositoryName);
    const defaultBranch = project.githubDefaultBranch ?? 'main';

    const token = await getInstallationToken(project.githubInstallationId);

    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Fetch check runs on the default branch head
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(defaultBranch)}/check-runs`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal,
      },
    );

    if (!response.ok) {
      return { success: false, data: { error: `Failed to fetch check runs: ${response.status}` } };
    }

    const checks = (await response.json()) as CheckRunsResponse;

    // No CI configured — skip gracefully
    if (checks.total_count === 0) {
      log.info({ projectId: task.projectId }, 'No CI checks configured, skipping build verification');
      return { success: true, data: { skipped: true, reason: 'No CI configured' } };
    }

    // Check if any are still running
    const pending = checks.check_runs.filter((c) => c.status !== 'completed');
    if (pending.length > 0) {
      // Read current poll attempt from action result field
      const currentAction = await prisma.taskAction.findUnique({
        where: { id: ctx.action.id },
        select: { result: true },
      });
      const prevResult = currentAction?.result
        ? (JSON.parse(currentAction.result) as { pollAttempt?: number })
        : {};
      const attempt = prevResult.pollAttempt ?? 1;

      if (attempt >= MAX_POLL_ATTEMPTS) {
        log.warn(
          { attempt, pending: pending.length },
          'Build verification polling timed out — checks still running',
        );
        return {
          success: true,
          data: { verified: false, reason: 'timed out', pendingChecks: pending.map((c) => c.name) },
        };
      }

      log.info(
        { pending: pending.length, total: checks.total_count, attempt },
        'Some checks still running on default branch, scheduling follow-up poll',
      );

      // Store attempt count in action result and reset to pending for re-execution
      await prisma.taskAction.update({
        where: { id: ctx.action.id },
        data: {
          status: 'pending',
          result: JSON.stringify({ pollAttempt: attempt + 1, pendingChecks: pending.map((c) => c.name) }),
        },
      });

      // Schedule follow-up poll via the standard action-execute job
      const queue = getJobQueue();
      queue.enqueueDelayed('action-execute', {
        planId: ctx.planId,
        actionId: ctx.action.id,
        orgId: ctx.orgId,
        userId: ctx.userId,
      }, POLL_DELAY_MS);

      return {
        success: true,
        data: { status: 'polling', message: 'CI checks in progress, follow-up poll scheduled' },
      };
    }

    // Evaluate completed checks
    const failed = checks.check_runs.filter(
      (c) => c.conclusion !== 'success' && c.conclusion !== 'skipped',
    );

    if (failed.length > 0) {
      log.warn(
        { failedCount: failed.length, checks: failed.map((c) => c.name) },
        'Build verification failed — CI checks failing on default branch',
      );
      return {
        success: false,
        data: {
          error: 'CI checks failing on default branch after merge',
          failedChecks: failed.map((c) => ({
            id: c.id,
            name: c.name,
            conclusion: c.conclusion,
            url: c.html_url,
          })),
        },
      };
    }

    log.info(
      { checksPassed: checks.check_runs.length },
      'Build verification passed — all CI checks green on default branch',
    );

    return {
      success: true,
      data: {
        verified: true,
        checksPassed: checks.check_runs.length,
        defaultBranch,
      },
    };
  },
};
