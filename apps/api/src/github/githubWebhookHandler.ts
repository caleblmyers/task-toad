/**
 * GitHub webhook handler: receives and processes GitHub App events.
 *
 * Validates webhook signatures, then dispatches to event-specific handlers.
 * Stores installation metadata in the database.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import type { GitHubWebhookEvent } from './githubTypes.js';
import { clearInstallationToken } from './githubAppAuth.js';
import { logInstallation, logWebhookReceived, logApiError } from './githubLogger.js';

const prisma = new PrismaClient();

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

  // Verify HMAC signature
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  if (!verifySignature(rawBody, signature)) {
    res.status(401).json({ error: 'Invalid webhook signature' });
    return;
  }

  const payload: GitHubWebhookEvent = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  logWebhookReceived(event, payload.action, deliveryId);

  try {
    switch (event) {
      case 'installation':
        await handleInstallationEvent(payload);
        break;
      case 'installation_repositories':
        await handleInstallationRepositoriesEvent(payload);
        break;
      case 'pull_request':
        handlePullRequestEvent(payload);
        break;
      case 'push':
        handlePushEvent(payload);
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
      logInstallation('installed', installationId, accountLogin);
      break;
    }
    case 'deleted': {
      await prisma.gitHubInstallation.delete({
        where: { installationId },
      }).catch(() => {
        // Already deleted — no-op
      });
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

// Placeholder handlers for future features (PR status sync, push-triggered reviews)
function handlePullRequestEvent(_payload: GitHubWebhookEvent): void {
  // Future: sync PR status with task status
}

function handlePushEvent(_payload: GitHubWebhookEvent): void {
  // Future: trigger AI code reviews on push
}
