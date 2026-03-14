/** Structured logging for the GitHub integration module. */

type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  module: string;
  action: string;
  [key: string]: unknown;
}

function log(level: LogLevel, entry: LogEntry): void {
  const timestamp = new Date().toISOString();
  const prefix = `[GitHub] [${level.toUpperCase()}]`;
  const msg = { ...entry, timestamp };
  if (level === 'error') {
    console.error(prefix, JSON.stringify(msg));
  } else if (level === 'warn') {
    console.warn(prefix, JSON.stringify(msg));
  } else {
    console.log(prefix, JSON.stringify(msg));
  }
}

export function logInstallation(action: string, installationId: string | number, account: string): void {
  log('info', { module: 'webhook', action, installationId: String(installationId), account });
}

export function logRepoCreation(owner: string, name: string, repositoryId: string): void {
  log('info', { module: 'repository', action: 'created', owner, name, repositoryId });
}

export function logBranchCreation(owner: string, repo: string, branch: string): void {
  log('info', { module: 'repository', action: 'branch_created', owner, repo, branch });
}

export function logCommit(owner: string, repo: string, branch: string, oid: string): void {
  log('info', { module: 'commit', action: 'committed', owner, repo, branch, oid });
}

export function logPullRequest(owner: string, repo: string, number: number, url: string): void {
  log('info', { module: 'pull_request', action: 'created', owner, repo, number, url });
}

export function logApiError(action: string, error: unknown, context?: Record<string, unknown>): void {
  const message = error instanceof Error ? error.message : String(error);
  log('error', { module: 'api', action, error: message, ...context });
}

export function logWebhookReceived(event: string, action: string, deliveryId?: string): void {
  log('info', { module: 'webhook', action: 'received', event, eventAction: action, deliveryId });
}

export function logTokenRefresh(installationId: string): void {
  log('info', { module: 'auth', action: 'token_refreshed', installationId });
}
