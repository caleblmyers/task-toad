import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('slack');

export interface SlackBlock {
  type: string;
  text?: { type: string; text: string; emoji?: boolean };
  elements?: Array<{ type: string; text: string; emoji?: boolean }>;
  fields?: Array<{ type: string; text: string }>;
}

export interface SlackMessage {
  text: string;
  blocks?: SlackBlock[];
}

/**
 * Send a message to a Slack incoming webhook URL.
 * Returns true if successful, false otherwise.
 */
export async function sendSlackWebhook(webhookUrl: string, message: SlackMessage): Promise<boolean> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      log.warn({ status: res.status, body }, 'Slack webhook returned non-OK');
      return false;
    }
    return true;
  } catch (err) {
    const message_ = err instanceof Error ? err.message : 'Unknown error';
    log.warn({ error: message_ }, 'Slack webhook request failed');
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

const EVENT_LABELS: Record<string, string> = {
  'task.created': 'Task Created',
  'task.updated': 'Task Updated',
  'task.deleted': 'Task Deleted',
  'sprint.created': 'Sprint Created',
  'sprint.closed': 'Sprint Closed',
  'comment.created': 'New Comment',
};

const EVENT_COLORS: Record<string, string> = {
  'task.created': '#22c55e',    // green
  'task.updated': '#3b82f6',    // blue
  'task.deleted': '#ef4444',    // red
  'sprint.created': '#8b5cf6',  // purple
  'sprint.closed': '#f59e0b',   // amber
  'comment.created': '#06b6d4', // cyan
};

/**
 * Format a task/sprint/comment event into a Slack Block Kit message.
 */
export function formatTaskEvent(event: string, data: Record<string, unknown>): SlackMessage {
  const label = EVENT_LABELS[event] ?? event;
  const color = EVENT_COLORS[event] ?? '#64748b';

  const fields: Array<{ type: string; text: string }> = [];

  if (event.startsWith('task.')) {
    const task = data.task as Record<string, unknown> | undefined;
    if (task) {
      fields.push({ type: 'mrkdwn', text: `*Task:* ${task.title ?? 'Untitled'}` });
      if (task.status) {
        fields.push({ type: 'mrkdwn', text: `*Status:* ${task.status}` });
      }
      if (task.priority) {
        fields.push({ type: 'mrkdwn', text: `*Priority:* ${task.priority}` });
      }
    }

    if (event === 'task.updated' && data.changes) {
      const changes = data.changes as Record<string, unknown>;
      const changeKeys = Object.keys(changes);
      if (changeKeys.length > 0) {
        fields.push({ type: 'mrkdwn', text: `*Changed:* ${changeKeys.join(', ')}` });
      }
    }
  }

  if (event.startsWith('sprint.')) {
    const sprint = data.sprint as Record<string, unknown> | undefined;
    if (sprint) {
      fields.push({ type: 'mrkdwn', text: `*Sprint:* ${sprint.name ?? 'Untitled'}` });
    }
  }

  if (event === 'comment.created') {
    const comment = data.comment as Record<string, unknown> | undefined;
    if (comment) {
      const body = String(comment.body ?? '');
      const truncated = body.length > 200 ? body.substring(0, 200) + '...' : body;
      fields.push({ type: 'mrkdwn', text: `*Comment:* ${truncated}` });
    }
  }

  const blocks: SlackBlock[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: `${label}`, emoji: true },
    },
  ];

  if (fields.length > 0) {
    blocks.push({
      type: 'section',
      fields,
    });
  }

  blocks.push({
    type: 'context',
    elements: [
      {
        type: 'mrkdwn',
        text: `_${color === '#22c55e' ? ':large_green_circle:' : color === '#ef4444' ? ':red_circle:' : ':blue_book:'} TaskToad notification_`,
        emoji: true,
      },
    ],
  });

  return {
    text: label,
    blocks,
  };
}

/**
 * Build a test message for verifying Slack integration.
 */
export function buildTestMessage(): SlackMessage {
  return {
    text: 'TaskToad test notification',
    blocks: [
      {
        type: 'header',
        text: { type: 'plain_text', text: 'TaskToad Connected!', emoji: true },
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: 'This is a test notification from TaskToad. Your Slack integration is working correctly.',
        },
      },
      {
        type: 'context',
        elements: [
          { type: 'mrkdwn', text: '_Sent from TaskToad_', emoji: true },
        ],
      },
    ],
  };
}
