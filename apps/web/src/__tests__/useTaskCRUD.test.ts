// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskCRUD } from '../hooks/useTaskCRUD';
import type { Task, TaskConnection } from '../types';

// Mock gql
vi.mock('../api/client', () => ({
  gql: vi.fn(),
}));

import { gql } from '../api/client';
const mockGql = vi.mocked(gql);

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: 'task-1',
    title: 'Test Task',
    description: null,
    status: 'todo',
    priority: 'medium',
    taskType: 'feature',
    projectId: 'proj-1',
    createdAt: '2026-01-01T00:00:00Z',
    assigneeId: null,
    archived: false,
    labels: [],
    ...overrides,
  };
}

const defaultOptions = {
  projectId: 'proj-1',
  userId: 'user-1',
  sprints: [],
};

describe('useTaskCRUD', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── loadTasks ──

  it('loadTasks fetches and sets tasks', async () => {
    const tasks = [makeTask({ taskId: 't1', title: 'Task 1' }), makeTask({ taskId: 't2', title: 'Task 2' })];
    mockGql.mockResolvedValueOnce({ tasks: { tasks, hasMore: false } as TaskConnection });

    const { result } = renderHook(() => useTaskCRUD(defaultOptions));
    expect(result.current.loading).toBe(true);

    await act(async () => {
      await result.current.loadTasks();
    });

    expect(result.current.tasks).toHaveLength(2);
    expect(result.current.tasks[0].title).toBe('Task 1');
    expect(result.current.loading).toBe(false);
  });

  it('loadTasks returns empty array when projectId is undefined', async () => {
    const { result } = renderHook(() => useTaskCRUD({ ...defaultOptions, projectId: undefined }));

    let returned: Task[] = [];
    await act(async () => {
      returned = await result.current.loadTasks();
    });

    expect(returned).toEqual([]);
    expect(mockGql).not.toHaveBeenCalled();
  });

  // ── handleStatusChange ──

  it('handleStatusChange updates task status optimistically', async () => {
    const tasks = [makeTask({ taskId: 't1', status: 'todo' })];
    mockGql.mockResolvedValueOnce({ tasks: { tasks, hasMore: false } as TaskConnection });

    const { result } = renderHook(() => useTaskCRUD(defaultOptions));
    await act(async () => { await result.current.loadTasks(); });

    mockGql.mockResolvedValueOnce({ updateTask: { taskId: 't1' } });
    await act(async () => {
      await result.current.handleStatusChange('t1', 'in_progress');
    });

    expect(result.current.tasks[0].status).toBe('in_progress');
  });

  // ── handleArchiveTask ──

  it('handleArchiveTask marks task as archived', async () => {
    const tasks = [makeTask({ taskId: 't1', archived: false })];
    mockGql.mockResolvedValueOnce({ tasks: { tasks, hasMore: false } as TaskConnection });

    const { result } = renderHook(() => useTaskCRUD(defaultOptions));
    await act(async () => { await result.current.loadTasks(); });

    mockGql.mockResolvedValueOnce({ updateTask: { taskId: 't1' } });
    await act(async () => {
      await result.current.handleArchiveTask('t1', true);
    });

    expect(result.current.tasks[0].archived).toBe(true);
  });

  // ── selectTask loads comments ──

  it('selectTask loads comments and activities for the selected task', async () => {
    const tasks = [makeTask({ taskId: 't1', title: 'Task 1' })];
    // loadTasks
    mockGql.mockResolvedValueOnce({ tasks: { tasks, hasMore: false } as TaskConnection });

    const { result } = renderHook(() => useTaskCRUD(defaultOptions));
    await act(async () => { await result.current.loadTasks(); });

    const comments = [{ commentId: 'c1', taskId: 't1', content: 'Hello', userId: 'u1', userEmail: 'a@b.com', createdAt: '2026-01-01T00:00:00Z' }];
    // selectTask calls loadSubtasks, loadComments, loadTaskActivities
    mockGql.mockResolvedValueOnce({ tasks: { tasks: [], hasMore: false } }); // subtasks
    mockGql.mockResolvedValueOnce({ comments }); // comments
    mockGql.mockResolvedValueOnce({ activities: [] }); // activities

    await act(async () => {
      result.current.selectTask(tasks[0]);
    });

    expect(result.current.selectedTask?.taskId).toBe('t1');
    expect(result.current.comments['t1']).toHaveLength(1);
    expect(result.current.comments['t1'][0].content).toBe('Hello');
  });

  // ── handleUpdateTask ──

  it('handleUpdateTask updates description optimistically', async () => {
    const task = makeTask({ taskId: 't1', description: 'old' });

    const { result } = renderHook(() => useTaskCRUD(defaultOptions));
    // Set tasks directly to avoid extra mock consumption
    await act(async () => { result.current.setTasks([task]); });

    mockGql.mockResolvedValueOnce({ updateTask: { taskId: 't1' } });
    await act(async () => {
      await result.current.handleUpdateTask('t1', { description: 'new desc' });
    });

    expect(result.current.tasks[0].description).toBe('new desc');
  });

  // ── Error handling ──

  it('loadTasks handles API errors gracefully', async () => {
    mockGql.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useTaskCRUD(defaultOptions));
    let returned: Task[] = [];
    await act(async () => {
      returned = await result.current.loadTasks();
    });

    expect(returned).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  // ── rootTasks memo ──

  it('rootTasks filters out subtasks', async () => {
    const tasks = [
      makeTask({ taskId: 't1', title: 'Parent' }),
      makeTask({ taskId: 't2', title: 'Child', parentTaskId: 't1' }),
    ];

    const { result } = renderHook(() => useTaskCRUD(defaultOptions));
    await act(async () => { result.current.setTasks(tasks); });

    expect(result.current.rootTasks).toHaveLength(1);
    expect(result.current.rootTasks[0].taskId).toBe('t1');
  });
});
