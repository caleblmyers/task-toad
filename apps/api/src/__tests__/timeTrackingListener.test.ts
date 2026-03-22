import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──

vi.mock('../utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { register } from '../infrastructure/listeners/timeTrackingListener.js';
import type { EventBus } from '../infrastructure/eventbus/port.js';

// ── Helpers ──

function makeBus() {
  const handlers: Record<string, Array<(payload: unknown) => void | Promise<void>>> = {};
  const bus: EventBus = {
    emit: vi.fn(),
    on: vi.fn((event: string, handler: (payload: unknown) => void | Promise<void>) => {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(handler);
    }),
    onAny: vi.fn(),
    removeAllListeners: vi.fn(),
  };
  return {
    bus,
    trigger: async (event: string, payload: unknown) => {
      for (const h of handlers[event] ?? []) {
        await h(payload);
      }
    },
  };
}

function makePrisma() {
  return {
    activity: {
      findFirst: vi.fn(),
    },
    taskAssignee: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    timeEntry: {
      create: vi.fn().mockResolvedValue({}),
    },
  };
}

function makePayload(overrides: {
  oldStatus: string;
  newStatus: string;
  taskId?: string;
  assigneeId?: string | null;
}) {
  return {
    orgId: 'org-1',
    userId: 'user-changer',
    projectId: 'proj-1',
    timestamp: new Date().toISOString(),
    task: {
      taskId: overrides.taskId ?? 'task-1',
      title: 'Test Task',
      status: overrides.newStatus,
      projectId: 'proj-1',
      orgId: 'org-1',
      taskType: 'task',
      assigneeId: overrides.assigneeId ?? 'user-assignee',
    },
    changes: {
      status: { old: overrides.oldStatus, new: overrides.newStatus },
    },
  };
}

describe('timeTrackingListener', () => {
  let prisma: ReturnType<typeof makePrisma>;
  let busUtil: ReturnType<typeof makeBus>;

  beforeEach(() => {
    vi.clearAllMocks();
    prisma = makePrisma();
    busUtil = makeBus();
    register(busUtil.bus, prisma as unknown as Parameters<typeof register>[1]);
  });

  it('creates TimeEntry when transitioning from in_progress to done', async () => {
    const startTime = new Date(Date.now() - 30 * 60000); // 30 min ago
    prisma.activity.findFirst.mockResolvedValue({ createdAt: startTime });
    prisma.taskAssignee.findMany.mockResolvedValue([]);

    await busUtil.trigger('task.updated', makePayload({
      oldStatus: 'in_progress',
      newStatus: 'done',
    }));

    expect(prisma.timeEntry.create).toHaveBeenCalledTimes(1);
    const call = prisma.timeEntry.create.mock.calls[0][0];
    expect(call.data.taskId).toBe('task-1');
    expect(call.data.autoTracked).toBe(true);
    expect(call.data.durationMinutes).toBeGreaterThanOrEqual(29);
    expect(call.data.durationMinutes).toBeLessThanOrEqual(31);
    expect(call.data.description).toContain('while in progress');
  });

  it('does NOT create TimeEntry when transitioning from todo to in_progress', async () => {
    await busUtil.trigger('task.updated', makePayload({
      oldStatus: 'todo',
      newStatus: 'in_progress',
    }));

    expect(prisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it('creates TimeEntry when reverting from in_progress to todo', async () => {
    const startTime = new Date(Date.now() - 10 * 60000); // 10 min ago
    prisma.activity.findFirst.mockResolvedValue({ createdAt: startTime });
    prisma.taskAssignee.findMany.mockResolvedValue([]);

    await busUtil.trigger('task.updated', makePayload({
      oldStatus: 'in_progress',
      newStatus: 'todo',
    }));

    expect(prisma.timeEntry.create).toHaveBeenCalledTimes(1);
    const call = prisma.timeEntry.create.mock.calls[0][0];
    expect(call.data.durationMinutes).toBeGreaterThanOrEqual(9);
    expect(call.data.description).toContain('while in progress');
  });

  it('creates split entries for multi-assignee tasks', async () => {
    const startTime = new Date(Date.now() - 60 * 60000); // 60 min ago
    prisma.activity.findFirst.mockResolvedValue({ createdAt: startTime });
    prisma.taskAssignee.findMany.mockResolvedValue([
      { userId: 'user-a' },
      { userId: 'user-b' },
      { userId: 'user-c' },
    ]);

    await busUtil.trigger('task.updated', makePayload({
      oldStatus: 'in_progress',
      newStatus: 'done',
    }));

    expect(prisma.timeEntry.create).toHaveBeenCalledTimes(3);

    const userIds = prisma.timeEntry.create.mock.calls.map(
      (c: Array<{ data: { userId: string } }>) => c[0].data.userId,
    );
    expect(userIds).toContain('user-a');
    expect(userIds).toContain('user-b');
    expect(userIds).toContain('user-c');

    // Each should get ~20 min (60/3 = 20, ceil = 20)
    for (const call of prisma.timeEntry.create.mock.calls) {
      const data = (call as Array<{ data: { durationMinutes: number } }>)[0].data;
      expect(data.durationMinutes).toBeGreaterThanOrEqual(19);
      expect(data.durationMinutes).toBeLessThanOrEqual(21);
    }
  });

  it('does not create TimeEntry when no in_progress activity is found', async () => {
    prisma.activity.findFirst.mockResolvedValue(null);

    await busUtil.trigger('task.updated', makePayload({
      oldStatus: 'in_progress',
      newStatus: 'done',
    }));

    expect(prisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it('ignores non-status changes', async () => {
    await busUtil.trigger('task.updated', {
      orgId: 'org-1',
      userId: 'user-1',
      projectId: 'proj-1',
      timestamp: new Date().toISOString(),
      task: {
        taskId: 'task-1',
        title: 'Test',
        status: 'todo',
        projectId: 'proj-1',
        orgId: 'org-1',
        taskType: 'task',
      },
      changes: {
        title: { old: 'Old Title', new: 'New Title' },
      },
    });

    expect(prisma.activity.findFirst).not.toHaveBeenCalled();
    expect(prisma.timeEntry.create).not.toHaveBeenCalled();
  });

  it('uses single assignee from TaskAssignee when only one exists', async () => {
    const startTime = new Date(Date.now() - 15 * 60000);
    prisma.activity.findFirst.mockResolvedValue({ createdAt: startTime });
    prisma.taskAssignee.findMany.mockResolvedValue([{ userId: 'user-single' }]);

    await busUtil.trigger('task.updated', makePayload({
      oldStatus: 'in_progress',
      newStatus: 'done',
      assigneeId: 'user-assignee-legacy',
    }));

    expect(prisma.timeEntry.create).toHaveBeenCalledTimes(1);
    const call = prisma.timeEntry.create.mock.calls[0][0];
    expect(call.data.userId).toBe('user-single');
  });
});
