import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { getInstallationToken } from '../../github/githubAppAuth.js';
import { createChildLogger } from '../../utils/logger.js';
import { getJobQueue } from '../../infrastructure/jobqueue/index.js';

const log = createChildLogger('monitor-ci');

const MonitorCIConfigSchema = z.object({
  sourcePRActionId: z.string(),
}).passthrough();


/** Delay between poll attempts. */
const POLL_DELAY_MS = 30_000;

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

/**
 * Fetch check runs for a given commit SHA.
 */
async function fetchCheckRuns(
  token: string,
  owner: string,
  repo: string,
  sha: string,
  signal?: AbortSignal,
): Promise<CheckRunsResponse> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs`,
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
    throw new Error(`Failed to fetch check runs: ${response.status}`);
  }

  return (await response.json()) as CheckRunsResponse;
}

/**
 * Evaluate check run results. Returns an ActionResult if checks are done, or null if still in progress.
 */
export function evaluateCheckRuns(checks: CheckRunsResponse): ActionResult | null {
  if (checks.total_count === 0) {
    return { success: true, data: { status: 'passed', checksPassed: 0, message: 'No CI checks configured' } };
  }

  const allCompleted = checks.check_runs.every((c) => c.status === 'completed');

  if (!allCompleted) {
    return null; // still in progress
  }

  const failed = checks.check_runs.filter(
    (c) => c.conclusion !== 'success' && c.conclusion !== 'skipped',
  );

  if (failed.length === 0) {
    return {
      success: true,
      data: { status: 'passed', checksPassed: checks.check_runs.length },
    };
  }

  return {
    success: false,
    data: {
      status: 'failed',
      failedChecks: failed.map((c) => ({
        id: c.id,
        name: c.name,
        conclusion: c.conclusion,
        url: c.html_url,
      })),
    },
  };
}

/**
 * The monitorCI executor kicks off the initial check and — if CI is still running —
 * schedules follow-up polls via the job queue instead of sleeping in-process.
 * This makes it resilient to server restarts.
 */
export const monitorCIExecutor: ActionExecutor = {
  type: 'monitor_ci',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, prisma, previousResults, signal } = ctx;
    const config = MonitorCIConfigSchema.parse(JSON.parse(ctx.action.config || '{}'));

    // Get PR info from a previous create_pr action result
    const prResult = previousResults.get(config.sourcePRActionId) as
      | { number?: number; branch?: string }
      | undefined;

    if (!prResult?.number) {
      return { success: false, data: { error: 'No PR number from source create_pr action' } };
    }

    // Load GitHub repo connection
    const project = await prisma.project.findUnique({
      where: { projectId: task.projectId },
      select: {
        githubInstallationId: true,
        githubRepositoryOwner: true,
        githubRepositoryName: true,
      },
    });

    if (!project?.githubInstallationId || !project.githubRepositoryOwner || !project.githubRepositoryName) {
      return { success: false, data: { error: 'No GitHub repository connected to project' } };
    }

    const owner = encodeURIComponent(project.githubRepositoryOwner);
    const repo = encodeURIComponent(project.githubRepositoryName);

    // Get the PR's head SHA
    const token = await getInstallationToken(project.githubInstallationId);
    const prResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/pulls/${prResult.number}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal,
      },
    );

    if (!prResponse.ok) {
      return { success: false, data: { error: `Failed to fetch PR: ${prResponse.status}` } };
    }

    const prData = (await prResponse.json()) as { head: { sha: string } };
    const headSha = prData.head.sha;

    // Do the first check
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    const checks = await fetchCheckRuns(token, owner, repo, headSha, signal);
    const result = evaluateCheckRuns(checks);

    if (result) {
      return result;
    }

    // CI still running — schedule follow-up poll via job queue instead of sleeping
    log.info(
      { actionId: ctx.action.id, totalChecks: checks.total_count },
      'CI checks still running, scheduling follow-up poll via job queue',
    );

    const queue = getJobQueue();
    queue.enqueueDelayed('monitor-ci-poll', {
      planId: ctx.planId,
      actionId: ctx.action.id,
      orgId: ctx.orgId,
      userId: ctx.userId,
      owner: project.githubRepositoryOwner!,
      repo: project.githubRepositoryName!,
      headSha,
      installationId: project.githubInstallationId!,
      attempt: 2, // first poll was attempt 1 above
    }, POLL_DELAY_MS);

    // Return a special "polling" result — the action stays in "executing" status.
    // The poll job will complete it.
    return {
      success: true,
      data: { status: 'polling', message: 'CI checks in progress, follow-up poll scheduled' },
    };
  },
};
