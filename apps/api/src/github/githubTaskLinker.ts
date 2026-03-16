/**
 * Extracts task IDs from branch names and commit messages,
 * then links commits to tasks in the database.
 */

import { prisma } from '../graphql/context.js';

/**
 * Extract task IDs from a branch name and/or commit message.
 * Task IDs are UUIDs (8-4-4-4-12 hex) since the schema uses @default(uuid()).
 */
export function extractTaskIds(branchName: string, commitMessage: string): string[] {
  const ids = new Set<string>();
  const uuidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

  // Branch: task/<uuid>/description
  const branchTaskMatch = branchName.match(/task\/([0-9a-f-]{36})/i);
  if (branchTaskMatch) ids.add(branchTaskMatch[1].toLowerCase());

  // Branch: starts with UUID
  const branchUuidMatch = branchName.match(/(?:^|\/?)([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
  if (branchUuidMatch) ids.add(branchUuidMatch[1].toLowerCase());

  // Message: [<uuid>]
  for (const m of commitMessage.matchAll(/\[([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\]/gi)) {
    ids.add(m[1].toLowerCase());
  }

  // Message: #<uuid>
  for (const m of commitMessage.matchAll(/#([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi)) {
    ids.add(m[1].toLowerCase());
  }

  // Fallback: any UUID in the message
  for (const m of commitMessage.matchAll(uuidPattern)) {
    ids.add(m[0].toLowerCase());
  }

  return Array.from(ids);
}

interface CommitData {
  sha: string;
  message: string;
  author: string;
  url: string;
}

/**
 * Link commits to tasks by extracting task IDs from branch name and commit messages.
 * Uses upsert to avoid duplicate records.
 */
export async function linkCommitsToTasks(
  projectId: string,
  commits: CommitData[],
  branchName: string
): Promise<number> {
  let linkedCount = 0;

  for (const commit of commits) {
    const taskIds = extractTaskIds(branchName, commit.message);
    if (taskIds.length === 0) continue;

    const validTasks = await prisma.task.findMany({
      where: { taskId: { in: taskIds }, projectId },
      select: { taskId: true },
    });

    for (const task of validTasks) {
      await prisma.gitHubCommitLink.upsert({
        where: { sha_taskId: { sha: commit.sha, taskId: task.taskId } },
        create: {
          taskId: task.taskId,
          sha: commit.sha,
          message: commit.message.slice(0, 500),
          author: commit.author,
          url: commit.url,
        },
        update: {},
      });
      linkedCount++;
    }
  }

  return linkedCount;
}
