import crypto from 'crypto';
import type { Request, Response } from 'express';
import { createChildLogger } from '../utils/logger.js';
import { formatTaskList, formatProjectStatus } from './slackClient.js';
import { prisma } from '../graphql/context.js';

const log = createChildLogger('slack-commands');

/**
 * Verify that a request came from Slack by checking the HMAC signature.
 */
function verifySlackSignature(signingSecret: string, timestamp: string, body: string, signature: string): boolean {
  const baseString = `v0:${timestamp}:${body}`;
  const hmac = crypto.createHmac('sha256', signingSecret).update(baseString).digest('hex');
  const expected = `v0=${hmac}`;
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

/**
 * Handle incoming Slack slash commands (POST /api/slack/commands).
 * Expects URL-encoded form data from Slack.
 */
export async function handleSlackCommand(req: Request, res: Response): Promise<void> {
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  if (!signingSecret) {
    log.warn('SLACK_SIGNING_SECRET not configured');
    res.status(500).json({ response_type: 'ephemeral', text: 'Slack integration not configured on the server.' });
    return;
  }

  // Verify signature
  const timestamp = req.headers['x-slack-request-timestamp'] as string | undefined;
  const slackSignature = req.headers['x-slack-signature'] as string | undefined;

  if (!timestamp || !slackSignature) {
    res.status(401).json({ response_type: 'ephemeral', text: 'Missing Slack signature headers.' });
    return;
  }

  // Reject requests older than 5 minutes to prevent replay attacks
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > 300) {
    res.status(401).json({ response_type: 'ephemeral', text: 'Request too old.' });
    return;
  }

  const rawBody = typeof req.body === 'string' ? req.body : new URLSearchParams(req.body as Record<string, string>).toString();

  try {
    if (!verifySlackSignature(signingSecret, timestamp, rawBody, slackSignature)) {
      res.status(401).json({ response_type: 'ephemeral', text: 'Invalid signature.' });
      return;
    }
  } catch {
    res.status(401).json({ response_type: 'ephemeral', text: 'Signature verification failed.' });
    return;
  }

  const { command, text, team_id, user_id: slackUserId } = req.body as Record<string, string>;

  if (command !== '/tasktoad') {
    res.json({ response_type: 'ephemeral', text: `Unknown command: ${command}` });
    return;
  }

  const trimmed = (text ?? '').trim();
  const parts = trimmed.split(/\s+/);
  const action = parts[0]?.toLowerCase();
  const title = parts.slice(1).join(' ').trim();

  if (action === 'create' && title) {
    try {
      // Find the org linked to this Slack team
      const integration = await prisma.slackIntegration.findFirst({
        where: { teamId: team_id, enabled: true },
      });

      if (!integration) {
        res.json({ response_type: 'ephemeral', text: 'No TaskToad organization is linked to this Slack workspace. Connect Slack in your TaskToad org settings.' });
        return;
      }

      // Find the first project in the org
      const project = await prisma.project.findFirst({
        where: { orgId: integration.orgId, archived: false },
        orderBy: { createdAt: 'asc' },
      });

      if (!project) {
        res.json({ response_type: 'ephemeral', text: 'No active projects found in the linked organization.' });
        return;
      }

      // Look up mapped user for auto-assignment
      const mapping = slackUserId
        ? await prisma.slackUserMapping.findUnique({
            where: { slackTeamId_slackUserId: { slackTeamId: team_id, slackUserId } },
          })
        : null;

      const task = await prisma.task.create({
        data: {
          title,
          status: 'todo',
          projectId: project.projectId,
          orgId: integration.orgId,
          ...(mapping ? { assigneeId: mapping.userId } : {}),
        },
      });

      const assignedText = mapping ? `\nAssigned to: you` : '';
      res.json({
        response_type: 'in_channel',
        text: `Task created: *${task.title}*\nProject: ${project.name}\nStatus: todo${assignedText}`,
      });
    } catch (err) {
      log.error({ err }, 'Failed to create task from Slack command');
      res.json({ response_type: 'ephemeral', text: 'Failed to create task. Please try again.' });
    }
  } else if (action === 'list') {
    try {
      const integration = await prisma.slackIntegration.findFirst({
        where: { teamId: team_id, enabled: true },
      });

      if (!integration) {
        res.json({ response_type: 'ephemeral', text: 'No TaskToad organization is linked to this Slack workspace.' });
        return;
      }

      const project = await prisma.project.findFirst({
        where: { orgId: integration.orgId, archived: false },
        orderBy: { createdAt: 'asc' },
      });

      if (!project) {
        res.json({ response_type: 'ephemeral', text: 'No active projects found.' });
        return;
      }

      // Look up mapped user to show personalized task list
      const listMapping = slackUserId
        ? await prisma.slackUserMapping.findUnique({
            where: { slackTeamId_slackUserId: { slackTeamId: team_id, slackUserId } },
          })
        : null;

      const tasks = await prisma.task.findMany({
        where: {
          projectId: project.projectId,
          parentTaskId: null,
          archived: false,
          ...(listMapping ? { assigneeId: listMapping.userId } : {}),
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        take: 10,
      });

      const result = formatTaskList(tasks, project.name);
      if (listMapping) {
        result.text = result.text
          ? `*Your tasks:*\n${result.text}`
          : '*Your tasks:*\nNo tasks assigned to you.';
      } else if (!listMapping && slackUserId) {
        const hint = '\n_Tip: Link your Slack account in TaskToad settings for personalized results._';
        result.text = result.text ? `${result.text}${hint}` : hint;
      }
      res.json(result);
    } catch (err) {
      log.error({ err }, 'Failed to list tasks from Slack command');
      res.json({ response_type: 'ephemeral', text: 'Failed to fetch tasks. Please try again.' });
    }
  } else if (action === 'status') {
    try {
      const integration = await prisma.slackIntegration.findFirst({
        where: { teamId: team_id, enabled: true },
      });

      if (!integration) {
        res.json({ response_type: 'ephemeral', text: 'No TaskToad organization is linked to this Slack workspace.' });
        return;
      }

      const project = await prisma.project.findFirst({
        where: { orgId: integration.orgId, archived: false },
        orderBy: { createdAt: 'asc' },
      });

      if (!project) {
        res.json({ response_type: 'ephemeral', text: 'No active projects found.' });
        return;
      }

      const tasks = await prisma.task.findMany({
        where: { projectId: project.projectId, parentTaskId: null, archived: false },
      });

      const activeSprint = await prisma.sprint.findFirst({
        where: { projectId: project.projectId, isActive: true },
      });

      res.json(formatProjectStatus(tasks, project.name, activeSprint?.name ?? null));
    } catch (err) {
      log.error({ err }, 'Failed to get project status from Slack command');
      res.json({ response_type: 'ephemeral', text: 'Failed to fetch project status. Please try again.' });
    }
  } else if (action === 'link' && title) {
    try {
      const integration = await prisma.slackIntegration.findFirst({
        where: { teamId: team_id, enabled: true },
      });

      if (!integration) {
        res.json({ response_type: 'ephemeral', text: 'No TaskToad organization is linked to this Slack workspace. Connect Slack in your TaskToad org settings.' });
        return;
      }

      const email = title.toLowerCase();
      const user = await prisma.user.findFirst({
        where: { email, orgId: integration.orgId },
      });

      if (!user) {
        res.json({ response_type: 'ephemeral', text: `No TaskToad user found with email \`${email}\` in this organization. Make sure you use the email address associated with your TaskToad account.` });
        return;
      }

      await prisma.slackUserMapping.upsert({
        where: { slackTeamId_slackUserId: { slackTeamId: team_id, slackUserId } },
        update: { userId: user.userId },
        create: {
          slackTeamId: team_id,
          slackUserId,
          userId: user.userId,
          orgId: integration.orgId,
        },
      });

      res.json({ response_type: 'ephemeral', text: `Your Slack account has been linked to TaskToad user \`${email}\`. Task commands will now be personalized for you.` });
    } catch (err) {
      log.error({ err }, 'Failed to link Slack user');
      res.json({ response_type: 'ephemeral', text: 'Failed to link your account. Please try again.' });
    }
  } else if (action === 'link' && !title) {
    res.json({ response_type: 'ephemeral', text: 'Usage: `/tasktoad link your@email.com`' });
  } else if (action === 'unlink') {
    try {
      const deleted = await prisma.slackUserMapping.deleteMany({
        where: { slackTeamId: team_id, slackUserId },
      });

      if (deleted.count > 0) {
        res.json({ response_type: 'ephemeral', text: 'Your Slack account has been unlinked from TaskToad.' });
      } else {
        res.json({ response_type: 'ephemeral', text: 'Your Slack account is not currently linked to a TaskToad user.' });
      }
    } catch (err) {
      log.error({ err }, 'Failed to unlink Slack user');
      res.json({ response_type: 'ephemeral', text: 'Failed to unlink your account. Please try again.' });
    }
  } else if (action === 'help' || !action) {
    res.json({
      response_type: 'ephemeral',
      text: '*TaskToad Slash Commands*\n' +
        '`/tasktoad create <title>` — Create a new task\n' +
        '`/tasktoad list` — Show your recent tasks\n' +
        '`/tasktoad status` — Show project summary\n' +
        '`/tasktoad link <email>` — Link your Slack account to TaskToad\n' +
        '`/tasktoad unlink` — Unlink your Slack account from TaskToad\n' +
        '`/tasktoad help` — Show this help message',
    });
  } else {
    res.json({
      response_type: 'ephemeral',
      text: `Unknown action: \`${action}\`. Use \`/tasktoad help\` for available commands.`,
    });
  }
}
