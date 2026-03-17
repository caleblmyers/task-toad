import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { InProcessJobQueue } from '../inProcessAdapter.js';

// Mock advisory lock — always acquires
vi.mock('../../../utils/advisoryLock.js', () => ({
  tryAdvisoryLock: vi.fn().mockResolvedValue(true),
  releaseAdvisoryLock: vi.fn().mockResolvedValue(undefined),
}));

// Suppress logger output
vi.mock('../../../utils/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('InProcessJobQueue', () => {
  let queue: InProcessJobQueue;
  const mockPrisma = {} as ConstructorParameters<typeof InProcessJobQueue>[0];

  beforeEach(() => {
    queue = new InProcessJobQueue(mockPrisma as never);
  });

  afterEach(async () => {
    await queue.shutdown();
  });

  it('executes enqueued jobs via registered handlers', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    queue.registerHandler('prisma-metrics', handler);

    queue.enqueue('prisma-metrics', {} as Record<string, never>);

    // Wait for setImmediate to fire
    await new Promise((r) => setTimeout(r, 50));

    expect(handler).toHaveBeenCalledOnce();
  });

  it('runs scheduled jobs at intervals after start()', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    queue.registerHandler('prisma-metrics', handler);
    queue.schedule('test-schedule', 100, 'prisma-metrics');

    queue.start();

    // Wait for at least one interval
    await new Promise((r) => setTimeout(r, 250));

    expect(handler.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  it('stops running scheduled jobs after shutdown()', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    queue.registerHandler('prisma-metrics', handler);
    queue.schedule('test-schedule', 50, 'prisma-metrics');

    queue.start();
    await new Promise((r) => setTimeout(r, 120));

    await queue.shutdown();
    const countAfterShutdown = handler.mock.calls.length;

    await new Promise((r) => setTimeout(r, 120));
    expect(handler.mock.calls.length).toBe(countAfterShutdown);
  });

  it('skips enqueue during shutdown', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    queue.registerHandler('prisma-metrics', handler);

    await queue.shutdown();
    queue.enqueue('prisma-metrics', {} as Record<string, never>);

    await new Promise((r) => setTimeout(r, 50));
    expect(handler).not.toHaveBeenCalled();
  });

  it('warns for unregistered job names', async () => {
    queue.enqueue('prisma-metrics', {} as Record<string, never>);

    // No handler registered — should not throw
    await new Promise((r) => setTimeout(r, 50));
  });

  it('uses advisory locks when configured', async () => {
    const { tryAdvisoryLock, releaseAdvisoryLock } = await import('../../../utils/advisoryLock.js');
    const handler = vi.fn().mockResolvedValue(undefined);
    queue.registerHandler('due-date-reminders', handler, {
      advisoryLockId: 100001,
    });

    queue.enqueue('due-date-reminders', {} as Record<string, never>);
    await new Promise((r) => setTimeout(r, 50));

    expect(tryAdvisoryLock).toHaveBeenCalledWith(mockPrisma, 100001);
    expect(releaseAdvisoryLock).toHaveBeenCalledWith(mockPrisma, 100001);
    expect(handler).toHaveBeenCalledOnce();
  });
});
