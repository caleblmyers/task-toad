import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import { createChildLogger } from './logger.js';

const log = createChildLogger('webhooks');

const SUPPORTED_EVENTS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'sprint.created',
  'sprint.closed',
  'comment.created',
] as const;

export type WebhookEvent = (typeof SUPPORTED_EVENTS)[number];

interface WebhookPayload {
  event: string;
  timestamp: string;
  data: Record<string, unknown>;
}

export function isValidWebhookEvent(event: string): event is WebhookEvent {
  return (SUPPORTED_EVENTS as readonly string[]).includes(event);
}

export async function dispatchWebhooks(
  prisma: PrismaClient,
  orgId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { orgId, enabled: true },
  });

  const matching = endpoints.filter((ep) => {
    const events = JSON.parse(ep.events) as string[];
    return events.includes(event);
  });

  if (matching.length === 0) return;

  const payload: WebhookPayload = {
    event,
    timestamp: new Date().toISOString(),
    data,
  };
  const body = JSON.stringify(payload);

  // Fire-and-forget
  void Promise.allSettled(
    matching.map(async (endpoint) => {
      const signature = crypto
        .createHmac('sha256', endpoint.secret)
        .update(body)
        .digest('hex');

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);

      try {
        const res = await fetch(endpoint.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': `sha256=${signature}`,
            'X-Webhook-Event': event,
          },
          body,
          signal: controller.signal,
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        await prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: { lastFiredAt: new Date() },
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error';
        log.warn({ endpointId: endpoint.id, event, error: message }, 'Webhook dispatch failed');
        await prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: { lastError: message },
        });
      } finally {
        clearTimeout(timeout);
      }
    })
  );
}
