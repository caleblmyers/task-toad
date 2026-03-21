import type { PrismaClient, SlackIntegration } from '@prisma/client';
import { sendSlackWebhook, formatTaskEvent } from '../slack/slackClient.js';
import { createChildLogger } from './logger.js';
import { StringArraySchema } from './zodSchemas.js';
import { decryptIfEncrypted } from './encryption.js';

const log = createChildLogger('slack-dispatch');

/**
 * Dispatch Slack notifications for a given event to all matching integrations.
 * Fire-and-forget — does not block the caller.
 */
export function dispatchSlackNotifications(
  prisma: PrismaClient,
  orgId: string,
  event: string,
  data: Record<string, unknown>
): void {
  void doDispatch(prisma, orgId, event, data).catch((err: unknown) => {
    log.error({ err, event, orgId }, 'Failed to dispatch Slack notifications');
  });
}

async function doDispatch(
  prisma: PrismaClient,
  orgId: string,
  event: string,
  data: Record<string, unknown>
): Promise<void> {
  const integrations = await prisma.slackIntegration.findMany({
    where: { orgId, enabled: true },
  });

  if (integrations.length === 0) return;

  const matching = integrations.filter((int: SlackIntegration) => {
    const result = StringArraySchema.safeParse(JSON.parse(int.events));
    if (!result.success) {
      log.warn({ integrationId: int.id, error: result.error.message }, 'Invalid slack events JSON');
      return false;
    }
    return result.data.includes(event);
  });

  if (matching.length === 0) return;

  const message = formatTaskEvent(event, data);

  await Promise.allSettled(
    matching.map(async (integration: SlackIntegration) => {
      try {
        await sendSlackWebhook(decryptIfEncrypted(integration.webhookUrl), message);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown error';
        log.warn({ integrationId: integration.id, event, error: msg }, 'Slack dispatch failed');
      }
    })
  );
}
