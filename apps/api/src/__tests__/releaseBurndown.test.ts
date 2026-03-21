import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──

vi.mock('../utils/resolverHelpers.js', () => ({
  requireProject: vi.fn(),
}));

vi.mock('../ai/index.js', () => ({
  generateReleaseNotes: vi.fn(),
}));

vi.mock('../graphql/resolvers/ai/helpers.js', () => ({
  buildPromptLogContext: vi.fn(),
  enforceBudget: vi.fn(),
}));

// Import after mocks
import { releaseQueries } from '../graphql/resolvers/release.js';

// ── Helpers ──

function makeContext(overrides?: { orgId?: string }) {
  const orgId = overrides?.orgId ?? 'org-1';
  return {
    user: { userId: 'user-1', orgId, email: 'test@test.com' },
    prisma: {
      release: {
        findUnique: vi.fn(),
      },
      releaseTask: {
        findMany: vi.fn(),
      },
      activity: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
      },
    },
  } as unknown as Parameters<typeof releaseQueries.releaseBurndown>[2];
}

type BurndownPoint = { date: string; totalTasks: number; completedTasks: number; remainingTasks: number };

describe('releaseBurndown', () => {
  let ctx: ReturnType<typeof makeContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = makeContext();
  });

  it('throws NotFoundError when release does not exist', async () => {
    (ctx.prisma.release.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(
      releaseQueries.releaseBurndown({}, { releaseId: 'rel-1' }, ctx),
    ).rejects.toThrow('Release not found');
  });

  it('throws NotFoundError when release belongs to different org', async () => {
    (ctx.prisma.release.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      releaseId: 'rel-1',
      orgId: 'org-other',
    });

    await expect(
      releaseQueries.releaseBurndown({}, { releaseId: 'rel-1' }, ctx),
    ).rejects.toThrow('Release not found');
  });

  it('returns empty array when release has no tasks', async () => {
    (ctx.prisma.release.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      releaseId: 'rel-1',
      orgId: 'org-1',
      createdAt: new Date('2025-01-01'),
      status: 'draft',
    });
    (ctx.prisma.releaseTask.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const result = await releaseQueries.releaseBurndown({}, { releaseId: 'rel-1' }, ctx);
    expect(result).toEqual([]);
  });

  it('returns burndown with all tasks done reaching 0 remaining', async () => {
    const createdAt = new Date('2025-01-01T00:00:00Z');
    (ctx.prisma.release.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      releaseId: 'rel-1',
      orgId: 'org-1',
      createdAt,
      status: 'released',
      releaseDate: '2025-01-03',
    });

    (ctx.prisma.releaseTask.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { taskId: 't1', task: { taskId: 't1', status: 'done' } },
      { taskId: 't2', task: { taskId: 't2', status: 'done' } },
    ]);

    (ctx.prisma.activity.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { taskId: 't1', createdAt: new Date('2025-01-01T12:00:00Z') },
      { taskId: 't2', createdAt: new Date('2025-01-02T12:00:00Z') },
    ]);

    const result = await releaseQueries.releaseBurndown({}, { releaseId: 'rel-1' }, ctx) as BurndownPoint[];

    // Should have at least Jan 1, 2, 3
    expect(result.length).toBeGreaterThanOrEqual(3);
    // First point starts at Jan 1 with 1 task done (t1 completed on Jan 1)
    const jan1 = result.find((p) => p.date === '2025-01-01')!;
    expect(jan1).toBeDefined();
    expect(jan1.totalTasks).toBe(2);
    expect(jan1.completedTasks).toBe(1);
    expect(jan1.remainingTasks).toBe(1);

    // By Jan 3 all tasks are done
    const jan3 = result.find((p) => p.date === '2025-01-03')!;
    expect(jan3).toBeDefined();
    expect(jan3.completedTasks).toBe(2);
    expect(jan3.remainingTasks).toBe(0);
  });

  it('uses fallback timestamps when no activity records exist for done tasks', async () => {
    const createdAt = new Date('2025-01-05T00:00:00Z');
    (ctx.prisma.release.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      releaseId: 'rel-1',
      orgId: 'org-1',
      createdAt,
      status: 'released',
      releaseDate: '2025-01-06',
    });

    (ctx.prisma.releaseTask.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { taskId: 't1', addedAt: new Date('2025-01-05T00:00:00Z'), task: { taskId: 't1', status: 'done' } },
    ]);

    // No completion activities for t1
    (ctx.prisma.activity.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    // Fallback: most recent activity
    (ctx.prisma.activity.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue({
      createdAt: new Date('2025-01-05T18:00:00Z'),
    });

    const result = await releaseQueries.releaseBurndown({}, { releaseId: 'rel-1' }, ctx) as BurndownPoint[];

    expect(result.length).toBeGreaterThanOrEqual(2);
    // Task was completed on Jan 5 (fallback date)
    const jan5 = result.find((p) => p.date === '2025-01-05')!;
    expect(jan5).toBeDefined();
    expect(jan5.completedTasks).toBe(1);
    expect(jan5.remainingTasks).toBe(0);
  });

  it('returns correct daily counts for mixed done/undone tasks', async () => {
    const createdAt = new Date('2025-02-01T00:00:00Z');
    (ctx.prisma.release.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      releaseId: 'rel-1',
      orgId: 'org-1',
      createdAt,
      status: 'released',
      releaseDate: '2025-02-03',
    });

    (ctx.prisma.releaseTask.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { taskId: 't1', task: { taskId: 't1', status: 'done' } },
      { taskId: 't2', task: { taskId: 't2', status: 'in_progress' } },
      { taskId: 't3', task: { taskId: 't3', status: 'todo' } },
    ]);

    // Only t1 was completed
    (ctx.prisma.activity.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { taskId: 't1', createdAt: new Date('2025-02-02T10:00:00Z') },
    ]);

    const result = await releaseQueries.releaseBurndown({}, { releaseId: 'rel-1' }, ctx) as BurndownPoint[];

    expect(result.length).toBeGreaterThanOrEqual(3);
    // Day 1: 0 completed
    const feb1 = result.find((p) => p.date === '2025-02-01')!;
    expect(feb1.remainingTasks).toBe(3);
    // Day 2: 1 completed (t1)
    const feb2 = result.find((p) => p.date === '2025-02-02')!;
    expect(feb2.completedTasks).toBe(1);
    expect(feb2.remainingTasks).toBe(2);
    // Day 3: still 1 completed
    const feb3 = result.find((p) => p.date === '2025-02-03')!;
    expect(feb3.completedTasks).toBe(1);
    expect(feb3.remainingTasks).toBe(2);
  });

  it('stops burndown at releaseDate for released releases instead of now', async () => {
    const createdAt = new Date('2025-03-01T00:00:00Z');
    (ctx.prisma.release.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      releaseId: 'rel-1',
      orgId: 'org-1',
      createdAt,
      status: 'released',
      releaseDate: '2025-03-03',
    });

    (ctx.prisma.releaseTask.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { taskId: 't1', task: { taskId: 't1', status: 'done' } },
    ]);

    (ctx.prisma.activity.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { taskId: 't1', createdAt: new Date('2025-03-02T12:00:00Z') },
    ]);

    const result = await releaseQueries.releaseBurndown({}, { releaseId: 'rel-1' }, ctx) as BurndownPoint[];

    // Should not extend to today (2026) since release is already released
    // The last date should be near the releaseDate (2025-03-03), not months away
    const lastPoint = result[result.length - 1];
    expect(lastPoint.date <= '2025-03-04').toBe(true);
    // First point should be March 1
    expect(result[0].date).toBe('2025-03-01');
    // March 3 should exist and have task completed
    const mar3 = result.find((p) => p.date === '2025-03-03')!;
    expect(mar3).toBeDefined();
    expect(mar3.completedTasks).toBe(1);
  });

  it('uses addedAt as fallback when no activity at all exists', async () => {
    const createdAt = new Date('2025-04-01T00:00:00Z');
    (ctx.prisma.release.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      releaseId: 'rel-1',
      orgId: 'org-1',
      createdAt,
      status: 'released',
      releaseDate: '2025-04-01',
    });

    (ctx.prisma.releaseTask.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      { taskId: 't1', addedAt: new Date('2025-04-01T06:00:00Z'), task: { taskId: 't1', status: 'done' } },
    ]);

    // No activities at all
    (ctx.prisma.activity.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
    (ctx.prisma.activity.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await releaseQueries.releaseBurndown({}, { releaseId: 'rel-1' }, ctx) as BurndownPoint[];

    expect(result.length).toBeGreaterThanOrEqual(1);
    // Uses addedAt fallback → April 1
    const apr1 = result.find((p) => p.date === '2025-04-01')!;
    expect(apr1).toBeDefined();
    expect(apr1.completedTasks).toBe(1);
    expect(apr1.remainingTasks).toBe(0);
  });
});
