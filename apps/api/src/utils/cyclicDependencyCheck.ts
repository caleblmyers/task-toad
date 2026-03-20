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

/**
 * Validates a batch of proposed dependency edges against the existing graph
 * AND against each other, before any are committed to the database.
 *
 * Only blocking edges (blocks, is_blocked_by) are checked — informational
 * link types (informs, relates_to, duplicates) cannot create cycles.
 *
 * Returns an array of violations (empty = all valid).
 */
export async function batchDetectCycles(
  prisma: PrismaClient,
  proposedEdges: Array<{
    sourceTaskId: string;
    targetTaskId: string;
    linkType: string;
  }>
): Promise<Array<{ sourceTaskId: string; targetTaskId: string; error: string }>> {
  const BLOCKING_TYPES = new Set(['blocks', 'is_blocked_by']);
  const violations: Array<{
    sourceTaskId: string;
    targetTaskId: string;
    error: string;
  }> = [];

  // 1. Filter to only blocking edges
  const blockingEdges = proposedEdges.filter((e) =>
    BLOCKING_TYPES.has(e.linkType)
  );

  if (blockingEdges.length === 0) return violations;

  // 2. Normalize direction: convert is_blocked_by to blocks (swap source/target)
  const normalizedProposed = blockingEdges.map((e) => {
    if (e.linkType === 'is_blocked_by') {
      return {
        source: e.targetTaskId,
        target: e.sourceTaskId,
        originalSource: e.sourceTaskId,
        originalTarget: e.targetTaskId,
      };
    }
    return {
      source: e.sourceTaskId,
      target: e.targetTaskId,
      originalSource: e.sourceTaskId,
      originalTarget: e.targetTaskId,
    };
  });

  // 3. Check self-loops
  for (const edge of normalizedProposed) {
    if (edge.source === edge.target) {
      violations.push({
        sourceTaskId: edge.originalSource,
        targetTaskId: edge.originalTarget,
        error: `Self-loop: task "${edge.source}" cannot depend on itself`,
      });
    }
  }

  // 4. Fetch ALL existing blocking edges from the database
  const existingEdges = await prisma.taskDependency.findMany({
    where: { linkType: { in: ['blocks', 'is_blocked_by'] } },
    select: { sourceTaskId: true, targetTaskId: true, linkType: true },
  });

  // 5. Build adjacency list combining existing + proposed edges
  const adj = new Map<string, Set<string>>();
  const addEdge = (from: string, to: string) => {
    let neighbors = adj.get(from);
    if (!neighbors) {
      neighbors = new Set<string>();
      adj.set(from, neighbors);
    }
    neighbors.add(to);
  };

  // Add existing edges (normalized to blocks direction)
  for (const e of existingEdges) {
    if (e.linkType === 'blocks') {
      addEdge(e.sourceTaskId, e.targetTaskId);
    } else {
      // is_blocked_by: swap direction
      addEdge(e.targetTaskId, e.sourceTaskId);
    }
  }

  // Add all proposed edges
  for (const e of normalizedProposed) {
    if (e.source !== e.target) {
      addEdge(e.source, e.target);
    }
  }

  // 6. For each proposed edge, check if target can reach source (cycle detection via BFS)
  for (const edge of normalizedProposed) {
    if (edge.source === edge.target) continue; // Already reported as self-loop

    const visited = new Set<string>();
    const queue: string[] = [edge.target];
    let hasCycle = false;

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === edge.source) {
        hasCycle = true;
        break;
      }
      if (visited.has(current)) continue;
      visited.add(current);

      const neighbors = adj.get(current);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) queue.push(neighbor);
        }
      }
    }

    if (hasCycle) {
      violations.push({
        sourceTaskId: edge.originalSource,
        targetTaskId: edge.originalTarget,
        error: `Cycle detected: adding "${edge.originalSource}" → "${edge.originalTarget}" would create a circular dependency`,
      });
    }
  }

  return violations;
}
