/**
 * GitHub webhook handler: receives and processes GitHub App events.
 *
 * Validates webhook signatures, then dispatches to event-specific handlers.
 * Stores installation metadata in the database.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { GitHubWebhookEvent } from './githubTypes.js';
import { clearInstallationToken } from './githubAppAuth.js';
import { logInstallation, logWebhookReceived, logApiError } from './githubLogger.js';
import { linkCommitsToTasks } from './githubTaskLinker.js';
import { invalidateCache } from './githubCache.js';
import { prisma } from '../graphql/context.js';
import { getEventBus } from '../infrastructure/eventbus/index.js';

function getWebhookSecret(): string {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) throw new Error('GITHUB_WEBHOOK_SECRET environment variable is required');
  return secret;
}

/**
 * Verify the webhook signature (HMAC SHA-256) to ensure the payload
 * came from GitHub and was not tampered with.
 */
function verifySignature(payload: string, signature: string | undefined): boolean {
  if (!signature) return false;

  const secret = getWebhookSecret();
  const expected = 'sha256=' + createHmac('sha256', secret).update(payload).digest('hex');

  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Express handler for POST /api/github/webhooks.
 * Expects raw body for signature verification.
 */
export async function handleGitHubWebhook(req: Request, res: Response): Promise<void> {
  const event = req.headers['x-github-event'] as string | undefined;
  const deliveryId = req.headers['x-github-delivery'] as string | undefined;
  const signature = req.headers['x-hub-signature-256'] as string | undefined;

  if (!event) {
    res.status(400).json({ error: 'Missing x-github-event header' });
    return;
  }

  // Verify HMAC signature against raw body (Buffer from express.raw())
  const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (!verifySignature(rawBody, signature)) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const payload: GitHubWebhookEvent = JSON.parse(rawBody);
  logWebhookReceived(event, payload.action, deliveryId);

  try {
    switch (event) {
      case 'installation':
        await handleInstallationEvent(payload);
        break;
      case 'installation_repositories':
        await handleInstallationRepositoriesEvent(payload);
        break;
      case 'issues':
        await handleIssuesEvent(payload);
        break;
      case 'pull_request':
        await handlePullRequestEvent(payload);
        break;
      case 'pull_request_review':
        await handlePullRequestReviewEvent(payload);
        break;
      case 'check_suite':
        await handleCheckSuiteEvent(payload);
        break;
      case 'push':
        await handlePushEvent(payload);
        break;
      default:
        // Acknowledge unknown events without error
        break;
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    logApiError('webhook_handler', error, { event, action: payload.action });
    res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handleInstallationEvent(payload: GitHubWebhookEvent): Promise<void> {
  const installation = payload.installation;
  if (!installation) return;

  const installationId = String(installation.id);
  const accountLogin = installation.account.login;
  const accountType = installation.account.type;

  switch (payload.action) {
    case 'created': {
      await prisma.gitHubInstallation.upsert({
        where: { installationId },
        create: { installationId, accountLogin, accountType },
        update: { accountLogin, accountType },
      });
      invalidateCache(`repos:${installationId}`);
      logInstallation('installed', installationId, accountLogin);
      break;
    }
    case 'deleted': {
      await prisma.gitHubInstallation.delete({
        where: { installationId },
      }).catch(() => {
        // Already deleted — no-op
      });
      invalidateCache(`repos:${installationId}`);
      clearInstallationToken(installationId);
      logInstallation('uninstalled', installationId, accountLogin);
      break;
    }
    case 'suspend': {
      logInstallation('suspended', installationId, accountLogin);
      break;
    }
    case 'unsuspend': {
      logInstallation('unsuspended', installationId, accountLogin);
      break;
    }
    default:
      break;
  }
}

async function handleInstallationRepositoriesEvent(payload: GitHubWebhookEvent): Promise<void> {
  const installation = payload.installation;
  if (!installation) return;

  const installationId = String(installation.id);
  const accountLogin = installation.account.login;

  if (payload.action === 'added' && payload.repositories_added) {
    const repos = payload.repositories_added.map((r) => r.full_name).join(', ');
    logInstallation('repos_added', installationId, `${accountLogin}: ${repos}`);
  }

  if (payload.action === 'removed' && payload.repositories_removed) {
    const repos = payload.repositories_removed.map((r) => r.full_name).join(', ');
    logInstallation('repos_removed', installationId, `${accountLogin}: ${repos}`);
  }
}

async function resolveOrgAdminUserId(orgId: string): Promise<string> {
  const admin = await prisma.user.findFirst({
    where: { orgId, role: 'org:admin' },
    select: { userId: true },
  });
  return admin?.userId ?? orgId;
}

async function emitTaskUpdatedEvent(
  task: { taskId: string; title: string; status: string; projectId: string; orgId: string; taskType: string },
  previousStatus: string,
  newStatus: string,
): Promise<void> {
  const userId = await resolveOrgAdminUserId(task.orgId);
  const bus = getEventBus();
  bus.emit('task.updated', {
    orgId: task.orgId,
    userId,
    projectId: task.projectId,
    timestamp: new Date().toISOString(),
    task: { taskId: task.taskId, title: task.title, status: newStatus, projectId: task.projectId, orgId: task.orgId, taskType: task.taskType },
    changes: { status: { old: previousStatus, new: newStatus } },
  });
}

async function handleIssuesEvent(payload: GitHubWebhookEvent): Promise<void> {
  if (!payload.issue) return;
  const issueNodeId = payload.issue.node_id;
  if (!issueNodeId) return;

  const task = await prisma.task.findFirst({
    where: { githubIssueNodeId: issueNodeId },
  });
  if (!task) return;

  switch (payload.action) {
    case 'closed': {
      const previousStatus = task.status;
      await prisma.task.update({ where: { taskId: task.taskId }, data: { status: 'done' } });
      await emitTaskUpdatedEvent(task, previousStatus, 'done');
      break;
    }
    case 'reopened': {
      const previousStatus = task.status;
      await prisma.task.update({ where: { taskId: task.taskId }, data: { status: 'todo' } });
      await emitTaskUpdatedEvent(task, previousStatus, 'todo');
      break;
    }
    default:
      break;
  }
}

async function handlePullRequestEvent(payload: GitHubWebhookEvent): Promise<void> {
  if (!payload.pull_request) return;
  const prNodeId = payload.pull_request.node_id;
  if (!prNodeId) return;

  const link = await prisma.gitHubPullRequestLink.findFirst({ where: { prNodeId } });
  if (!link) return;

  switch (payload.action) {
    case 'closed': {
      const newState = payload.pull_request.merged ? 'MERGED' : 'CLOSED';
      await prisma.gitHubPullRequestLink.update({ where: { id: link.id }, data: { state: newState } });
      if (payload.pull_request.merged) {
        const task = await prisma.task.findUnique({ where: { taskId: link.taskId } });
        if (task) {
          const previousStatus = task.status;
          await prisma.task.update({ where: { taskId: task.taskId }, data: { status: 'done' } });
          await emitTaskUpdatedEvent(task, previousStatus, 'done');

          const userId = await resolveOrgAdminUserId(task.orgId);
          getEventBus().emit('task.pr_merged', {
            orgId: task.orgId,
            userId,
            projectId: task.projectId,
            timestamp: new Date().toISOString(),
            taskId: task.taskId,
            prNumber: payload.pull_request.number,
            prNodeId: link.prNodeId,
          });
        }
      }
      break;
    }
    case 'reopened':
      await prisma.gitHubPullRequestLink.update({ where: { id: link.id }, data: { state: 'OPEN' } });
      break;
    default:
      break;
  }
}

async function handlePullRequestReviewEvent(payload: GitHubWebhookEvent): Promise<void> {
  if (payload.action !== 'submitted' || !payload.review || !payload.pull_request) return;
  if (payload.review.state !== 'approved') return;

  const prNodeId = payload.pull_request.node_id;
  const link = await prisma.gitHubPullRequestLink.findFirst({ where: { prNodeId } });
  if (!link) return;

  const task = await prisma.task.findUnique({ where: { taskId: link.taskId } });
  if (!task) return;

  const previousStatus = task.status;
  await prisma.task.update({
    where: { taskId: task.taskId },
    data: { status: 'done', sprintColumn: 'Done' },
  });
  await emitTaskUpdatedEvent(task, previousStatus, 'done');
}

interface CheckSuitePayload {
  check_suite?: {
    conclusion: string | null;
    head_sha: string;
    pull_requests?: Array<{ number: number }>;
  };
}

async function handleCheckSuiteEvent(payload: GitHubWebhookEvent): Promise<void> {
  const suite = (payload as unknown as CheckSuitePayload).check_suite;
  if (!suite || suite.conclusion === null) return; // still running

  const pullRequests = suite.pull_requests ?? [];
  if (pullRequests.length === 0) return;

  const owner = payload.repository?.owner?.login ?? payload.repository?.owner?.name;
  const repoName = payload.repository?.name;
  if (!owner || !repoName) return;

  // Find the project linked to this repository
  const project = await prisma.project.findFirst({
    where: { githubRepositoryOwner: owner, githubRepositoryName: repoName },
    select: { projectId: true, orgId: true },
  });
  if (!project) return;

  for (const pr of pullRequests) {
    // Find the task linked to this PR
    const prLink = await prisma.gitHubPullRequestLink.findFirst({
      where: {
        prNumber: pr.number,
        task: { projectId: project.projectId },
      },
      include: { task: { select: { taskId: true, projectId: true, orgId: true } } },
    });
    if (!prLink) continue;

    const userId = await resolveOrgAdminUserId(prLink.task.orgId);
    const eventType = suite.conclusion === 'success' ? 'task.ci_passed' : 'task.ci_failed';
    getEventBus().emit(eventType, {
      orgId: prLink.task.orgId,
      userId,
      projectId: prLink.task.projectId,
      timestamp: new Date().toISOString(),
      taskId: prLink.task.taskId,
      conclusion: suite.conclusion,
      prNumber: pr.number,
      headSha: suite.head_sha,
    });
  }
}

async function handlePushEvent(payload: GitHubWebhookEvent): Promise<void> {
  if (!payload.repository || !payload.commits || payload.commits.length === 0) return;

  const owner = payload.repository.owner?.login ?? payload.repository.owner?.name;
  const repoName = payload.repository.name;
  if (!owner || !repoName) return;

  invalidateCache(`filetree:${owner}:${repoName}`);

  const project = await prisma.project.findFirst({
    where: { githubRepositoryOwner: owner, githubRepositoryName: repoName },
    select: { projectId: true },
  });
  if (!project) return;

  const branchRef = payload.ref ?? '';
  const branchName = branchRef.replace('refs/heads/', '');

  const commits = payload.commits.map((c) => ({
    sha: c.id,
    message: c.message,
    author: c.author?.username ?? c.author?.name ?? 'unknown',
    url: c.url,
  }));

  const linked = await linkCommitsToTasks(project.projectId, commits, branchName);
  if (linked > 0) {
    logWebhookReceived('push', `linked ${linked} commits`, undefined);
  }
}
