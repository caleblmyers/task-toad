import type { PrismaClient } from '@prisma/client';

/**
 * Detects if adding a blocking dependency edge (sourceTaskId → targetTaskId) would create a cycle.
 * Only walks 'blocks' and 'is_blocked_by' edges (informational links are skipped).
 *
 * Blocking graph direction:
 * - "A blocks B" (source=A, target=B, linkType=blocks) → edge A→B
 * - "A is_blocked_by B" (source=A, target=B, linkType=is_blocked_by) → edge B→A
 *
 * A cycle exists if there's already a path from targetTaskId to sourceTaskId
 * in the blocking graph (since we're about to add sourceTaskId→targetTaskId).
 */
export async function detectCycle(
  prisma: PrismaClient,
  sourceTaskId: string,
  targetTaskId: string
): Promise<boolean> {
  if (sourceTaskId === targetTaskId) return true;

  // BFS from targetTaskId following forward blocking edges to see if we reach sourceTaskId
  const visited = new Set<string>();
  const queue: string[] = [targetTaskId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current === sourceTaskId) return true;
    if (visited.has(current)) continue;
    visited.add(current);

    // Forward blocking edges from current node:
    // 1. `blocks` where current is source → current blocks target → follow to target
    const blocksOutgoing = await prisma.taskDependency.findMany({
      where: { sourceTaskId: current, linkType: 'blocks' },
      select: { targetTaskId: true },
    });
    for (const edge of blocksOutgoing) {
      if (!visited.has(edge.targetTaskId)) queue.push(edge.targetTaskId);
    }

    // 2. `is_blocked_by` where current is target → source is_blocked_by current → current blocks source → follow to source
    const isBlockedByIncoming = await prisma.taskDependency.findMany({
      where: { targetTaskId: current, linkType: 'is_blocked_by' },
      select: { sourceTaskId: true },
    });
    for (const edge of isBlockedByIncoming) {
      if (!visited.has(edge.sourceTaskId)) queue.push(edge.sourceTaskId);
    }
  }

  return false;
}
