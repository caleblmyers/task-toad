import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InProcessEventBus } from '../inProcessAdapter.js';
import type { DomainEvent } from '../types.js';

// Suppress logger output in tests
vi.mock('../../../utils/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('InProcessEventBus', () => {
  let bus: InProcessEventBus;

  beforeEach(() => {
    bus = new InProcessEventBus();
  });

  it('delivers events to registered handlers', () => {
    const handler = vi.fn();
    bus.on('task.created', handler);

    const payload: DomainEvent<'task.created'> = {
      orgId: 'org1',
      userId: 'user1',
      projectId: 'proj1',
      timestamp: new Date().toISOString(),
      task: { taskId: 't1', title: 'Test', status: 'todo', projectId: 'proj1', orgId: 'org1', taskType: 'task' },
    };
    bus.emit('task.created', payload);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it('does not deliver events to handlers for other event types', () => {
    const handler = vi.fn();
    bus.on('sprint.created', handler);

    bus.emit('task.created', {
      orgId: 'org1', userId: 'user1', projectId: 'proj1',
      timestamp: new Date().toISOString(),
      task: { taskId: 't1', title: 'Test', status: 'todo', projectId: 'proj1', orgId: 'org1', taskType: 'task' },
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it('supports multiple handlers for the same event', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    bus.on('task.created', handler1);
    bus.on('task.created', handler2);

    bus.emit('task.created', {
      orgId: 'org1', userId: 'user1', projectId: 'proj1',
      timestamp: new Date().toISOString(),
      task: { taskId: 't1', title: 'Test', status: 'todo', projectId: 'proj1', orgId: 'org1', taskType: 'task' },
    });

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('calls onAny handlers for every event', () => {
    const anyHandler = vi.fn();
    bus.onAny(anyHandler);

    bus.emit('task.created', {
      orgId: 'org1', userId: 'user1', projectId: 'proj1',
      timestamp: new Date().toISOString(),
      task: { taskId: 't1', title: 'Test', status: 'todo', projectId: 'proj1', orgId: 'org1', taskType: 'task' },
    });

    bus.emit('sprint.created', {
      orgId: 'org1', userId: 'user1', projectId: 'proj1',
      timestamp: new Date().toISOString(),
      sprint: { sprintId: 's1', name: 'Sprint 1', projectId: 'proj1', orgId: 'org1' },
    });

    expect(anyHandler).toHaveBeenCalledTimes(2);
    expect(anyHandler.mock.calls[0][0]).toBe('task.created');
    expect(anyHandler.mock.calls[1][0]).toBe('sprint.created');
  });

  it('catches sync handler errors without throwing to caller', () => {
    bus.on('task.created', () => {
      throw new Error('Handler exploded');
    });

    // Should not throw
    expect(() => {
      bus.emit('task.created', {
        orgId: 'org1', userId: 'user1', projectId: 'proj1',
        timestamp: new Date().toISOString(),
        task: { taskId: 't1', title: 'Test', status: 'todo', projectId: 'proj1', orgId: 'org1', taskType: 'task' },
      });
    }).not.toThrow();
  });

  it('catches async handler errors without throwing to caller', () => {
    bus.on('task.created', async () => {
      throw new Error('Async handler exploded');
    });

    expect(() => {
      bus.emit('task.created', {
        orgId: 'org1', userId: 'user1', projectId: 'proj1',
        timestamp: new Date().toISOString(),
        task: { taskId: 't1', title: 'Test', status: 'todo', projectId: 'proj1', orgId: 'org1', taskType: 'task' },
      });
    }).not.toThrow();
  });

  it('removeAllListeners clears all handlers', () => {
    const handler = vi.fn();
    const anyHandler = vi.fn();
    bus.on('task.created', handler);
    bus.onAny(anyHandler);

    bus.removeAllListeners();

    bus.emit('task.created', {
      orgId: 'org1', userId: 'user1', projectId: 'proj1',
      timestamp: new Date().toISOString(),
      task: { taskId: 't1', title: 'Test', status: 'todo', projectId: 'proj1', orgId: 'org1', taskType: 'task' },
    });

    expect(handler).not.toHaveBeenCalled();
    expect(anyHandler).not.toHaveBeenCalled();
  });
});
