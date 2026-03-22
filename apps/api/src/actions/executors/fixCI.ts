import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { getInstallationToken } from '../../github/githubAppAuth.js';
import { getProjectRepo } from '../../github/index.js';
import { commitFiles } from '../../github/githubCommitService.js';
import { generateCode } from '../../ai/aiService.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('fix-ci');

interface FixCIConfig {
  sourceMonitorActionId: string;
  sourcePRActionId: string;
}

interface FailedCheck {
  id: number;
  name: string;
  conclusion: string | null;
  url: string;
}

interface CheckAnnotation {
  path: string;
  start_line: number;
  end_line: number;
  annotation_level: string;
  message: string;
  title?: string;
}

/**
 * Fetch annotations (error details) from a check run.
 */
async function fetchCheckAnnotations(
  token: string,
  owner: string,
  repo: string,
  checkRunId: number,
  signal?: AbortSignal,
): Promise<CheckAnnotation[]> {
  const response = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/check-runs/${checkRunId}/annotations`,
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
    log.warn({ checkRunId, status: response.status }, 'Failed to fetch check annotations');
    return [];
  }

  return (await response.json()) as CheckAnnotation[];
}

export const fixCIExecutor: ActionExecutor = {
  type: 'fix_ci',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, project, apiKey, previousResults, signal } = ctx;
    const config: FixCIConfig = JSON.parse(ctx.action.config || '{}');

    // Get failed check info from monitor_ci result
    const monitorResult = previousResults.get(config.sourceMonitorActionId) as
      | { status?: string; failedChecks?: FailedCheck[] }
      | undefined;

    if (!monitorResult?.failedChecks?.length) {
      // No failures to fix — CI passed or monitor didn't report failures
      return { success: true, data: { fixCommitted: false, reason: 'No CI failures to fix' } };
    }

    // Get PR branch from create_pr result
    const prResult = previousResults.get(config.sourcePRActionId) as
      | { number?: number; branch?: string }
      | undefined;

    if (!prResult?.branch) {
      return { success: false, data: { error: 'No branch info from source create_pr action' } };
    }

    // Get GitHub repo connection
    const repo = await getProjectRepo(task.projectId);
    if (!repo) {
      return { success: false, data: { error: 'No GitHub repository connected to project' } };
    }

    const token = await getInstallationToken(repo.installationId);
    const owner = encodeURIComponent(repo.repositoryOwner);
    const repoName = encodeURIComponent(repo.repositoryName);

    // Fetch error annotations from all failed checks
    const allAnnotations: CheckAnnotation[] = [];
    for (const check of monitorResult.failedChecks) {
      const annotations = await fetchCheckAnnotations(token, owner, repoName, check.id, signal);
      allAnnotations.push(...annotations);
    }

    // Build error context for AI
    const failedCheckNames = monitorResult.failedChecks.map((c) => c.name).join(', ');
    const errorLines = allAnnotations.length > 0
      ? allAnnotations
          .slice(0, 30) // Cap annotations to avoid prompt bloat
          .map((a) => `${a.path}:${a.start_line} [${a.annotation_level}] ${a.message}`)
          .join('\n')
      : `CI checks failed: ${failedCheckNames}. No detailed annotations available.`;

    const ciErrorContext = `\n\nCI FAILURE — FIX REQUIRED:\nFailed checks: ${failedCheckNames}\nErrors:\n${errorLines}\n\nAnalyze the errors above and generate corrected code files that fix the CI failures.`;

    // Check for cancellation before calling AI
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Generate fix via AI
    const fixInstructions = (task.instructions || task.description || '') + ciErrorContext;

    const codeResult = await generateCode(
      apiKey,
      `Fix CI failures for: ${task.title}`,
      task.description || '',
      fixInstructions,
      project.name,
      project.description || '',
    );

    if (!codeResult.files || codeResult.files.length === 0) {
      return { success: false, data: { error: 'AI did not generate any fix files' } };
    }

    // Check for cancellation after AI call
    if (signal?.aborted) {
      throw new DOMException('Action cancelled', 'AbortError');
    }

    // Get the current head OID for the branch
    const branchRefResponse = await fetch(
      `https://api.github.com/repos/${owner}/${repoName}/git/refs/heads/${encodeURIComponent(prResult.branch)}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        signal,
      },
    );

    if (!branchRefResponse.ok) {
      return { success: false, data: { error: `Failed to get branch ref: ${branchRefResponse.status}` } };
    }

    const refData = (await branchRefResponse.json()) as { object: { sha: string } };

    // Commit the fix to the PR branch
    const commitResult = await commitFiles(
      repo,
      {
        branch: prResult.branch,
        message: `fix: resolve CI failures\n\nFailed checks: ${failedCheckNames}`,
        additions: codeResult.files.map((f) => ({ path: f.path, content: f.content })),
      },
      refData.object.sha,
    );

    log.info(
      { actionId: ctx.action.id, commitOid: commitResult.oid, filesChanged: codeResult.files.length },
      'CI fix committed',
    );

    return {
      success: true,
      data: {
        fixCommitted: true,
        commitOid: commitResult.oid,
        commitUrl: commitResult.url,
        filesChanged: codeResult.files.map((f) => f.path),
      },
    };
  },
};
