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

// Retry delays: 5s, 30s, 2min, 10min, 1hr
const RETRY_DELAYS_MS = [5_000, 30_000, 120_000, 600_000, 3_600_000];
const MAX_ATTEMPTS = 5;

export function isValidWebhookEvent(event: string): event is WebhookEvent {
  return (SUPPORTED_EVENTS as readonly string[]).includes(event);
}

async function attemptDelivery(
  prisma: PrismaClient,
  deliveryId: string,
  endpointUrl: string,
  endpointSecret: string,
  body: string,
  event: string,
  endpointId: string
): Promise<void> {
  const signature = crypto
    .createHmac('sha256', endpointSecret)
    .update(body)
    .digest('hex');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': `sha256=${signature}`,
        'X-Webhook-Event': event,
      },
      body,
      signal: controller.signal,
    });

    const responseBody = await res.text().catch(() => '');
    const truncatedResponse = responseBody.slice(0, 500);

    if (res.ok) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'success',
          statusCode: res.status,
          responseBody: truncatedResponse,
          completedAt: new Date(),
        },
      });
      await prisma.webhookEndpoint.update({
        where: { id: endpointId },
        data: { lastFiredAt: new Date(), lastError: null },
      });
    } else {
      throw new Error(`HTTP ${res.status}: ${truncatedResponse}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    log.warn({ endpointId, event, deliveryId, error: message }, 'Webhook delivery failed');

    const delivery = await prisma.webhookDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery) return;

    const newAttemptCount = delivery.attemptCount + 1;

    if (newAttemptCount >= MAX_ATTEMPTS) {
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'failed',
          attemptCount: newAttemptCount,
          responseBody: message.slice(0, 500),
          completedAt: new Date(),
        },
      });
    } else {
      const delayMs = RETRY_DELAYS_MS[newAttemptCount - 1] ?? RETRY_DELAYS_MS[RETRY_DELAYS_MS.length - 1];
      await prisma.webhookDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'retrying',
          attemptCount: newAttemptCount,
          responseBody: message.slice(0, 500),
          nextRetryAt: new Date(Date.now() + delayMs),
        },
      });
    }

    await prisma.webhookEndpoint.update({
      where: { id: endpointId },
      data: { lastError: message.slice(0, 500) },
    });
  } finally {
    clearTimeout(timeout);
  }
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

  // Fire-and-forget: create delivery records and attempt each
  void Promise.allSettled(
    matching.map(async (endpoint) => {
      const delivery = await prisma.webhookDelivery.create({
        data: {
          endpointId: endpoint.id,
          event,
          payload: body,
          status: 'pending',
          attemptCount: 0,
        },
      });

      await attemptDelivery(
        prisma,
        delivery.id,
        endpoint.url,
        endpoint.secret,
        body,
        event,
        endpoint.id
      );
    })
  );
}

export async function processRetryQueue(prisma: PrismaClient): Promise<void> {
  const retryable = await prisma.webhookDelivery.findMany({
    where: {
      status: 'retrying',
      nextRetryAt: { lte: new Date() },
    },
    include: { endpoint: true },
    take: 50,
  });

  if (retryable.length === 0) return;

  log.info({ count: retryable.length }, 'Processing webhook retry queue');

  await Promise.allSettled(
    retryable.map(async (delivery) => {
      await attemptDelivery(
        prisma,
        delivery.id,
        delivery.endpoint.url,
        delivery.endpoint.secret,
        delivery.payload,
        delivery.event,
        delivery.endpointId
      );
    })
  );
}

export async function replayDelivery(
  prisma: PrismaClient,
  deliveryId: string
): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { endpoint: true },
  });

  if (!delivery) {
    throw new Error('Delivery not found');
  }

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      status: 'pending',
      attemptCount: 0,
      nextRetryAt: null,
      completedAt: null,
      responseBody: null,
      statusCode: null,
    },
  });

  await attemptDelivery(
    prisma,
    delivery.id,
    delivery.endpoint.url,
    delivery.endpoint.secret,
    delivery.payload,
    delivery.event,
    delivery.endpointId
  );
}

let retryInterval: ReturnType<typeof setInterval> | null = null;

export function startRetryProcessor(prisma: PrismaClient): void {
  if (retryInterval) return;
  retryInterval = setInterval(() => {
    processRetryQueue(prisma).catch((err) =>
      log.error({ err }, 'Webhook retry queue processing failed')
    );
  }, 30_000);
  log.info('Webhook retry processor started (30s interval)');
}

export function stopRetryProcessor(): void {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
    log.info('Webhook retry processor stopped');
  }
}
