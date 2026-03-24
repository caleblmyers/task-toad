import type { Context } from '../context.js';
import { requireOrg } from './auth.js';
import { AuthorizationError, NotFoundError, ValidationError } from '../errors.js';
import { isValidWebhookEvent } from '../../utils/webhookDispatcher.js';
import { sendSlackWebhook, buildTestMessage } from '../../slack/slackClient.js';
import { StringArraySchema } from '../../utils/zodSchemas.js';
import { createChildLogger } from '../../utils/logger.js';
import { requireLicense, getOrgPlan } from '../../utils/license.js';
import { encryptApiKey, decryptIfEncrypted } from '../../utils/encryption.js';

const log = createChildLogger('slack');

function requireAdmin(context: Context) {
  const user = requireOrg(context);
  if (user.role !== 'org:admin') {
    throw new AuthorizationError('Only org admins can manage Slack integrations');
  }
  return user;
}

// ── Slack queries ──

export const slackQueries = {
  slackIntegrations: async (_parent: unknown, _args: unknown, context: Context) => {
    requireLicense('slack', getOrgPlan(context.org));
    const user = requireAdmin(context);
    const integrations = await context.prisma.slackIntegration.findMany({
      where: { orgId: user.orgId },
      orderBy: { createdAt: 'desc' },
    });
    return integrations.map((int) => ({
      ...int,
      // Mask the webhook URL — show only last 8 chars as a hint
      webhookUrl: 'https://hooks.slack.com/••••' + decryptIfEncrypted(int.webhookUrl).slice(-8),
    }));
  },

  slackUserMappings: async (_parent: unknown, args: { integrationId: string }, context: Context) => {
    requireLicense('slack', getOrgPlan(context.org));
    const user = requireAdmin(context);
    // Verify integration belongs to this org
    const integration = await context.prisma.slackIntegration.findUnique({
      where: { id: args.integrationId },
    });
    if (!integration || integration.orgId !== user.orgId) {
      throw new NotFoundError('Slack integration not found');
    }
    return context.prisma.slackUserMapping.findMany({
      where: { orgId: user.orgId, slackTeamId: integration.teamId },
      include: { user: true },
      orderBy: { createdAt: 'desc' },
    });
  },
};

// ── Slack mutations ──

export const slackMutations = {
  connectSlack: async (
    _parent: unknown,
    args: {
      webhookUrl: string;
      teamId: string;
      teamName: string;
      channelId: string;
      channelName: string;
      events: string[];
    },
    context: Context
  ) => {
    requireLicense('slack', getOrgPlan(context.org));
    const user = requireAdmin(context);

    // Validate webhook URL
    try {
      const url = new URL(args.webhookUrl);
      if (!url.hostname.endsWith('slack.com') && !url.hostname.endsWith('hooks.slack.com')) {
        throw new Error('not slack');
      }
    } catch {
      throw new ValidationError('Invalid Slack webhook URL. Must be a hooks.slack.com URL.');
    }

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

    if (!args.teamId.trim() || !args.teamName.trim() || !args.channelId.trim() || !args.channelName.trim()) {
      throw new ValidationError('Team ID, team name, channel ID, and channel name are required');
    }

    const encryptedUrl = encryptApiKey(args.webhookUrl.trim());

    const integration = await context.prisma.slackIntegration.create({
      data: {
        orgId: user.orgId,
        teamId: args.teamId.trim(),
        teamName: args.teamName.trim(),
        webhookUrl: encryptedUrl,
        channelId: args.channelId.trim(),
        channelName: args.channelName.trim(),
        events: JSON.stringify(args.events),
      },
    });

    return {
      ...integration,
      // Mask the URL in the response
      webhookUrl: 'https://hooks.slack.com/••••' + args.webhookUrl.trim().slice(-8),
    };
  },

  updateSlackIntegration: async (
    _parent: unknown,
    args: { id: string; events?: string[] | null; enabled?: boolean | null },
    context: Context
  ) => {
    requireLicense('slack', getOrgPlan(context.org));
    const user = requireAdmin(context);
    const integration = await context.prisma.slackIntegration.findUnique({
      where: { id: args.id },
    });
    if (!integration || integration.orgId !== user.orgId) {
      throw new NotFoundError('Slack integration not found');
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

    return context.prisma.slackIntegration.update({
      where: { id: args.id },
      data: {
        ...(args.events !== undefined && args.events !== null ? { events: JSON.stringify(args.events) } : {}),
        ...(args.enabled !== undefined && args.enabled !== null ? { enabled: args.enabled } : {}),
      },
    });
  },

  disconnectSlack: async (_parent: unknown, args: { id: string }, context: Context) => {
    requireLicense('slack', getOrgPlan(context.org));
    const user = requireAdmin(context);
    const integration = await context.prisma.slackIntegration.findUnique({
      where: { id: args.id },
    });
    if (!integration || integration.orgId !== user.orgId) {
      throw new NotFoundError('Slack integration not found');
    }
    await context.prisma.slackIntegration.delete({ where: { id: args.id } });
    return true;
  },

  testSlackIntegration: async (_parent: unknown, args: { id: string }, context: Context) => {
    requireLicense('slack', getOrgPlan(context.org));
    const user = requireAdmin(context);
    const integration = await context.prisma.slackIntegration.findUnique({
      where: { id: args.id },
    });
    if (!integration || integration.orgId !== user.orgId) {
      throw new NotFoundError('Slack integration not found');
    }

    const message = buildTestMessage();
    const url = decryptIfEncrypted(integration.webhookUrl);
    return sendSlackWebhook(url, message);
  },

  mapSlackUser: async (
    _parent: unknown,
    args: { slackUserId: string; slackTeamId: string; userId: string },
    context: Context
  ) => {
    requireLicense('slack', getOrgPlan(context.org));
    const user = requireAdmin(context);

    // Verify the target user belongs to the same org
    const targetUser = await context.prisma.user.findUnique({ where: { userId: args.userId } });
    if (!targetUser || targetUser.orgId !== user.orgId) {
      throw new NotFoundError('User not found in your organization');
    }

    return context.prisma.slackUserMapping.upsert({
      where: {
        slackTeamId_slackUserId: {
          slackTeamId: args.slackTeamId,
          slackUserId: args.slackUserId,
        },
      },
      update: { userId: args.userId },
      create: {
        slackUserId: args.slackUserId,
        slackTeamId: args.slackTeamId,
        userId: args.userId,
        orgId: user.orgId,
      },
      include: { user: true },
    });
  },

  unmapSlackUser: async (_parent: unknown, args: { mappingId: string }, context: Context) => {
    requireLicense('slack', getOrgPlan(context.org));
    const user = requireAdmin(context);
    const mapping = await context.prisma.slackUserMapping.findUnique({
      where: { id: args.mappingId },
    });
    if (!mapping || mapping.orgId !== user.orgId) {
      throw new NotFoundError('Slack user mapping not found');
    }
    await context.prisma.slackUserMapping.delete({ where: { id: args.mappingId } });
    return true;
  },
};

// ── Slack field resolvers ──

export const slackFieldResolvers = {
  SlackIntegration: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    events: (parent: { events: string }) => {
      const result = StringArraySchema.safeParse(JSON.parse(parent.events));
      if (!result.success) {
        log.warn({ error: result.error.message }, 'Invalid slack integration events JSON');
        return [];
      }
      return result.data;
    },
  },
  SlackUserMapping: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
};
