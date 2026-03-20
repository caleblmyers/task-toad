import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { getInstallationToken } from '../../github/githubAppAuth.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('monitor-ci');

interface MonitorCIConfig {
  sourcePRActionId: string;
}

/** Max polling attempts — 60 × 30s = 30 minutes. */
const MAX_ATTEMPTS = 60;
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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch check runs for a given commit SHA.
 */
async function fetchCheckRuns(
  token: string,
  owner: string,
  repo: string,
  sha: string,
): Promise<CheckRunsResponse> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/commits/${sha}/check-runs`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch check runs: ${response.status}`);
  }

  return (await response.json()) as CheckRunsResponse;
}

export const monitorCIExecutor: ActionExecutor = {
  type: 'monitor_ci',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, prisma, previousResults } = ctx;
    const config: MonitorCIConfig = JSON.parse(ctx.action.config || '{}');

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
      },
    );

    if (!prResponse.ok) {
      return { success: false, data: { error: `Failed to fetch PR: ${prResponse.status}` } };
    }

    const prData = (await prResponse.json()) as { head: { sha: string } };
    const headSha = prData.head.sha;

    // Poll check runs until they complete or we hit the timeout
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // Refresh the installation token on each poll in case it expires
      const pollToken = await getInstallationToken(project.githubInstallationId);
      const checks = await fetchCheckRuns(pollToken, owner, repo, headSha);

      if (checks.total_count === 0) {
        return { success: true, data: { status: 'passed', checksPassed: 0, message: 'No CI checks configured' } };
      }

      const allCompleted = checks.check_runs.every((c) => c.status === 'completed');

      if (allCompleted) {
        const failed = checks.check_runs.filter(
          (c) => c.conclusion !== 'success' && c.conclusion !== 'skipped',
        );

        if (failed.length === 0) {
          return {
            success: true,
            data: { status: 'passed', checksPassed: checks.check_runs.length },
          };
        }

        // Checks completed but some failed
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

      log.info(
        { actionId: ctx.action.id, attempt, totalChecks: checks.total_count },
        'CI checks still running, waiting 30s before next poll',
      );

      await sleep(POLL_DELAY_MS);
    }

    return {
      success: false,
      data: { status: 'timeout', error: `CI checks did not complete after ${MAX_ATTEMPTS} attempts (30 min)` },
    };
  },
};
