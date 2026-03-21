import { describe, it, expect, vi } from 'vitest';
import { batchDetectCycles } from '../utils/cyclicDependencyCheck.js';

// Minimal mock of PrismaClient with taskDependency.findMany
function createMockPrisma(existingEdges: Array<{ sourceTaskId: string; targetTaskId: string; linkType: string }> = []) {
  return {
    taskDependency: {
      findMany: vi.fn().mockResolvedValue(existingEdges),
    },
  } as never; // cast to PrismaClient
}

describe('batchDetectCycles', () => {
  it('returns empty array when no cycles exist', async () => {
    const prisma = createMockPrisma();
    const result = await batchDetectCycles(prisma, [
      { sourceTaskId: 'A', targetTaskId: 'B', linkType: 'blocks' },
    ]);
    expect(result).toEqual([]);
  });

  it('detects self-loop', async () => {
    const prisma = createMockPrisma();
    const result = await batchDetectCycles(prisma, [
      { sourceTaskId: 'A', targetTaskId: 'A', linkType: 'blocks' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].error).toContain('Self-loop');
  });

  it('detects direct cycle with existing edge', async () => {
    const prisma = createMockPrisma([
      { sourceTaskId: 'A', targetTaskId: 'B', linkType: 'blocks' },
    ]);
    const result = await batchDetectCycles(prisma, [
      { sourceTaskId: 'B', targetTaskId: 'A', linkType: 'blocks' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].error).toContain('Cycle detected');
  });

  it('detects indirect cycle (A→B→C exists, propose C→A)', async () => {
    const prisma = createMockPrisma([
      { sourceTaskId: 'A', targetTaskId: 'B', linkType: 'blocks' },
      { sourceTaskId: 'B', targetTaskId: 'C', linkType: 'blocks' },
    ]);
    const result = await batchDetectCycles(prisma, [
      { sourceTaskId: 'C', targetTaskId: 'A', linkType: 'blocks' },
    ]);
    expect(result).toHaveLength(1);
    expect(result[0].error).toContain('Cycle detected');
  });

  it('ignores non-blocking link types (relates_to, informs)', async () => {
    const prisma = createMockPrisma([
      { sourceTaskId: 'A', targetTaskId: 'B', linkType: 'blocks' },
    ]);
    const result = await batchDetectCycles(prisma, [
      { sourceTaskId: 'B', targetTaskId: 'A', linkType: 'relates_to' },
      { sourceTaskId: 'B', targetTaskId: 'A', linkType: 'informs' },
    ]);
    expect(result).toEqual([]);
  });

  it('normalizes is_blocked_by edges (swaps direction)', async () => {
    // A blocks B exists. Propose: A is_blocked_by B → normalized to B blocks A → cycle!
    const prisma = createMockPrisma([
      { sourceTaskId: 'A', targetTaskId: 'B', linkType: 'blocks' },
    ]);
    const result = await batchDetectCycles(prisma, [
      { sourceTaskId: 'A', targetTaskId: 'B', linkType: 'is_blocked_by' },
    ]);
    // is_blocked_by: source=A, target=B → normalized to B→A
    // existing: A→B. Combined graph: A→B, B→A → cycle from B→A (target=A can reach source=B)
    expect(result).toHaveLength(1);
    expect(result[0].error).toContain('Cycle detected');
  });

  it('detects cycle among proposed edges themselves', async () => {
    const prisma = createMockPrisma();
    const result = await batchDetectCycles(prisma, [
      { sourceTaskId: 'A', targetTaskId: 'B', linkType: 'blocks' },
      { sourceTaskId: 'B', targetTaskId: 'A', linkType: 'blocks' },
    ]);
    // Both edges form a cycle; at least one should be flagged
    expect(result.length).toBeGreaterThanOrEqual(1);
    expect(result.some((v) => v.error.includes('Cycle detected'))).toBe(true);
  });

  it('returns empty array for empty input', async () => {
    const prisma = createMockPrisma();
    const result = await batchDetectCycles(prisma, []);
    expect(result).toEqual([]);
  });

  it('allows non-cyclic multi-edge graph', async () => {
    const prisma = createMockPrisma([
      { sourceTaskId: 'A', targetTaskId: 'B', linkType: 'blocks' },
    ]);
    const result = await batchDetectCycles(prisma, [
      { sourceTaskId: 'B', targetTaskId: 'C', linkType: 'blocks' },
      { sourceTaskId: 'C', targetTaskId: 'D', linkType: 'blocks' },
    ]);
    expect(result).toEqual([]);
  });
});
