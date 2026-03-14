/** Structured logging for the GitHub integration module. */

import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('github');

export function logInstallation(action: string, installationId: string | number, account: string): void {
  log.info({ submodule: 'webhook', action, installationId: String(installationId), account }, 'GitHub installation event');
}

export function logRepoCreation(owner: string, name: string, repositoryId: string): void {
  log.info({ submodule: 'repository', action: 'created', owner, name, repositoryId }, 'GitHub repo created');
}

export function logBranchCreation(owner: string, repo: string, branch: string): void {
  log.info({ submodule: 'repository', action: 'branch_created', owner, repo, branch }, 'GitHub branch created');
}

export function logCommit(owner: string, repo: string, branch: string, oid: string): void {
  log.info({ submodule: 'commit', action: 'committed', owner, repo, branch, oid }, 'GitHub commit created');
}

export function logPullRequest(owner: string, repo: string, number: number, url: string): void {
  log.info({ submodule: 'pull_request', action: 'created', owner, repo, number, url }, 'GitHub PR created');
}

export function logApiError(action: string, error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  log.error({ submodule: 'api', action, error: message, ...context }, 'GitHub API error');
}

export function logWebhookReceived(event: string, action: string, deliveryId?: string): void {
  log.info({ submodule: 'webhook', action: 'received', event, eventAction: action, deliveryId }, 'GitHub webhook received');
}

export function logTokenRefresh(installationId: string): void {
  log.info({ submodule: 'auth', action: 'token_refreshed', installationId }, 'GitHub token refreshed');
}
