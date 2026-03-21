import crypto from 'crypto';
import type { Context } from '../context.js';
import { requireOrg } from './auth.js';
import { ValidationError, NotFoundError, AuthorizationError } from '../errors.js';
import { isValidWebhookEvent, replayDelivery } from '../../utils/webhookDispatcher.js';
import { validateWebhookUrl } from '../../utils/urlValidator.js';

function requireAdmin(context: Context) {
  const user = requireOrg(context);
  if (user.role !== 'org:admin') {
    throw new AuthorizationError('Only org admins can manage webhooks');
  }
  return user;
}

export const webhookQueries = {
  webhookEndpoints: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireAdmin(context);
    const endpoints = await context.prisma.webhookEndpoint.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    return endpoints.map((ep) => ({
      ...ep,
      createdAt: ep.createdAt.toISOString(),
      lastFiredAt: ep.lastFiredAt?.toISOString() ?? null,
    }));
  },

  webhookDeliveries: async (
    _parent: unknown,
    args: { endpointId: string; limit?: number | null },
    context: Context
  ) => {
    const user = requireAdmin(context);
    const endpoint = await context.prisma.webhookEndpoint.findUnique({
      where: { id: args.endpointId },
    });
    if (!endpoint || endpoint.orgId !== user.orgId) {
      throw new NotFoundError('Webhook endpoint not found');
    }

    const limit = Math.min(args.limit ?? 50, 100);
    const deliveries = await context.prisma.webhookDelivery.findMany({
      where: { endpointId: args.endpointId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    return deliveries.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      completedAt: d.completedAt?.toISOString() ?? null,
      nextRetryAt: d.nextRetryAt?.toISOString() ?? null,
      deadLetterAt: d.deadLetterAt?.toISOString() ?? null,
    }));
  },

  deadLetterDeliveries: async (
    _parent: unknown,
    args: { endpointId: string },
    context: Context
  ) => {
    const user = requireAdmin(context);
    const endpoint = await context.prisma.webhookEndpoint.findUnique({
      where: { id: args.endpointId },
    });
    if (!endpoint || endpoint.orgId !== user.orgId) {
      throw new NotFoundError('Webhook endpoint not found');
    }

    const deliveries = await context.prisma.webhookDelivery.findMany({
      where: {
        endpointId: args.endpointId,
        status: 'failed',
        deadLetterAt: { not: null },
      },
      orderBy: { deadLetterAt: 'desc' },
      take: 50,
    });

    return deliveries.map((d) => ({
      ...d,
      createdAt: d.createdAt.toISOString(),
      completedAt: d.completedAt?.toISOString() ?? null,
      nextRetryAt: d.nextRetryAt?.toISOString() ?? null,
      deadLetterAt: d.deadLetterAt?.toISOString() ?? null,
    }));
  },
};

export const webhookMutations = {
  createWebhookEndpoint: async (
    _parent: unknown,
    args: { url: string; events: string[]; description?: string | null },
    context: Context
  ) => {
    const user = requireAdmin(context);

    // Validate URL (SSRF protection)
    await validateWebhookUrl(args.url);

    // Validate events
    for (const event of args.events) {
      if (!isValidWebhookEvent(event)) {
        throw new ValidationError(
          `Invalid event "${event}". Supported: task.created, task.updated, task.deleted, sprint.created, sprint.closed, comment.created`
        );
      }
    }
    if (args.events.length === 0) {
      throw new ValidationError('At least one event is required');
    }

    const secret = crypto.randomBytes(32).toString('hex');

    const endpoint = await context.prisma.webhookEndpoint.create({
      data: {
        orgId: user.orgId,
        url: args.url,
        secret,
        events: JSON.stringify(args.events),
        description: args.description ?? null,
      },
    });

    return {
      ...endpoint,
      // Include secret only on creation so the client can show it once
      secret,
      createdAt: endpoint.createdAt.toISOString(),
      lastFiredAt: null,
    };
  },

  updateWebhookEndpoint: async (
    _parent: unknown,
    args: { id: string; url?: string | null; events?: string[] | null; enabled?: boolean | null; description?: string | null },
    context: Context
  ) => {
    const user = requireAdmin(context);
    const endpoint = await context.prisma.webhookEndpoint.findUnique({ where: { id: args.id } });
    if (!endpoint || endpoint.orgId !== user.orgId) {
      throw new NotFoundError('Webhook endpoint not found');
    }

    if (args.url !== undefined && args.url !== null) {
      await validateWebhookUrl(args.url);
    }

    if (args.events !== undefined && args.events !== null) {
      for (const event of args.events) {
        if (!isValidWebhookEvent(event)) {
          throw new ValidationError(`Invalid event "${event}"`);
        }
      }
      if (args.events.length === 0) {
        throw new ValidationError('At least one event is required');
      }
    }

    const updated = await context.prisma.webhookEndpoint.update({
      where: { id: args.id },
      data: {
        ...(args.url !== undefined && args.url !== null ? { url: args.url } : {}),
        ...(args.events !== undefined && args.events !== null ? { events: JSON.stringify(args.events) } : {}),
        ...(args.enabled !== undefined && args.enabled !== null ? { enabled: args.enabled } : {}),
        ...(args.description !== undefined ? { description: args.description } : {}),
      },
    });

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      lastFiredAt: updated.lastFiredAt?.toISOString() ?? null,
    };
  },

  deleteWebhookEndpoint: async (
    _parent: unknown,
    args: { id: string },
    context: Context
  ) => {
    const user = requireAdmin(context);
    const endpoint = await context.prisma.webhookEndpoint.findUnique({ where: { id: args.id } });
    if (!endpoint || endpoint.orgId !== user.orgId) {
      throw new NotFoundError('Webhook endpoint not found');
    }
    await context.prisma.webhookEndpoint.delete({ where: { id: args.id } });
    return true;
  },

  testWebhookEndpoint: async (
    _parent: unknown,
    args: { id: string },
    context: Context
  ) => {
    const user = requireAdmin(context);
    const endpoint = await context.prisma.webhookEndpoint.findUnique({ where: { id: args.id } });
    if (!endpoint || endpoint.orgId !== user.orgId) {
      throw new NotFoundError('Webhook endpoint not found');
    }

    // Re-validate URL in case it was updated to a malicious target
    await validateWebhookUrl(endpoint.url);

    const payload = {
      event: 'test',
      timestamp: new Date().toISOString(),
      data: { message: 'Webhook test from TaskToad' },
    };
    const body = JSON.stringify(payload);
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
          'X-Webhook-Event': 'test',
        },
        body,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (res.ok) {
        await context.prisma.webhookEndpoint.update({
          where: { id: args.id },
          data: { lastFiredAt: new Date(), lastError: null },
        });
        return true;
      }

      await context.prisma.webhookEndpoint.update({
        where: { id: args.id },
        data: { lastError: `HTTP ${res.status}` },
      });
      return false;
    } catch (err) {
      clearTimeout(timeout);
      const message = err instanceof Error ? err.message : 'Unknown error';
      await context.prisma.webhookEndpoint.update({
        where: { id: args.id },
        data: { lastError: message },
      });
      return false;
    }
  },

  replayWebhookDelivery: async (
    _parent: unknown,
    args: { deliveryId: string },
    context: Context
  ) => {
    const user = requireAdmin(context);

    const delivery = await context.prisma.webhookDelivery.findUnique({
      where: { id: args.deliveryId },
      include: { endpoint: true },
    });
    if (!delivery || delivery.endpoint.orgId !== user.orgId) {
      throw new NotFoundError('Webhook delivery not found');
    }

    await replayDelivery(context.prisma, args.deliveryId);

    const updated = await context.prisma.webhookDelivery.findUnique({
      where: { id: args.deliveryId },
    });
    if (!updated) {
      throw new NotFoundError('Webhook delivery not found after replay');
    }

    return {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      completedAt: updated.completedAt?.toISOString() ?? null,
      nextRetryAt: updated.nextRetryAt?.toISOString() ?? null,
      deadLetterAt: updated.deadLetterAt?.toISOString() ?? null,
    };
  },
};
