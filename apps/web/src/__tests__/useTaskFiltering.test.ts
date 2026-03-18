// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTaskFiltering } from '../hooks/useTaskFiltering';
import type { Task } from '../types';

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    taskId: 'task-1',
    title: 'Default Task',
    description: null,
    status: 'TODO',
    priority: 'MEDIUM',
    taskType: 'FEATURE',
    projectId: 'proj-1',
    createdAt: '2026-01-01T00:00:00Z',
    assigneeId: null,
    archived: false,
    labels: [],
    ...overrides,
  };
}

const sampleTasks: Task[] = [
  makeTask({ taskId: '1', title: 'Setup database', description: 'Configure PostgreSQL', status: 'TODO', priority: 'HIGH', assigneeId: 'user-1', labels: [{ labelId: 'lbl-1', name: 'backend', color: '#000' }] }),
  makeTask({ taskId: '2', title: 'Build login page', description: 'React login form', status: 'IN_PROGRESS', priority: 'MEDIUM', assigneeId: 'user-2', labels: [{ labelId: 'lbl-2', name: 'frontend', color: '#fff' }] }),
  makeTask({ taskId: '3', title: 'Write API tests', description: null, status: 'DONE', priority: 'LOW', assigneeId: null, labels: [{ labelId: 'lbl-1', name: 'backend', color: '#000' }, { labelId: 'lbl-3', name: 'testing', color: '#0f0' }] }),
  makeTask({ taskId: '4', title: 'Deploy to production', status: 'TODO', priority: 'HIGH', archived: true }),
  makeTask({ taskId: '5', title: 'Fix login bug', description: 'Login fails on Safari', status: 'TODO', priority: 'CRITICAL', assigneeId: 'user-1' }),
];

describe('useTaskFiltering', () => {
  // ── Default behavior — server-side filtering means filteredTasks is a passthrough ──

  it('passes through all tasks as filteredTasks (server-side filtering)', () => {
    const { result } = renderHook(() => useTaskFiltering(sampleTasks));
    expect(result.current.filteredTasks).toBe(sampleTasks);
    expect(result.current.filteredTasks).toHaveLength(5);
  });

  it('hasActiveFilters is false initially', () => {
    const { result } = renderHook(() => useTaskFiltering(sampleTasks));
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it('filterInput is empty object by default', () => {
    const { result } = renderHook(() => useTaskFiltering(sampleTasks));
    expect(result.current.filterInput).toEqual({});
  });

  // ── filterInput shape ──

  describe('filterInput builds correct shape', () => {
    it('status filter produces status array', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setStatusFilter('TODO'));
      expect(result.current.filterInput.status).toEqual(['TODO']);
    });

    it('priority filter produces priority array', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setPriorityFilter('HIGH'));
      expect(result.current.filterInput.priority).toEqual(['HIGH']);
    });

    it('assignee filter produces assigneeId array', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setAssigneeFilter('user-1'));
      expect(result.current.filterInput.assigneeId).toEqual(['user-1']);
    });

    it('unassigned filter produces assigneeId with "unassigned"', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setAssigneeFilter('unassigned'));
      expect(result.current.filterInput.assigneeId).toEqual(['unassigned']);
    });

    it('label filter produces labelIds array', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setLabelFilter(['lbl-1', 'lbl-2']));
      expect(result.current.filterInput.labelIds).toEqual(['lbl-1', 'lbl-2']);
    });

    it('showArchived filter produces showArchived: true', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setShowArchived(true));
      expect(result.current.filterInput.showArchived).toBe(true);
    });

    it('search filter populates after debounce', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setSearchQuery('login'));
      // Before debounce, search not in filterInput
      expect(result.current.filterInput.search).toBeUndefined();
      // After 300ms debounce
      act(() => { vi.advanceTimersByTime(300); });
      expect(result.current.filterInput.search).toBe('login');
      vi.useRealTimers();
    });

    it('"all" values produce empty filterInput', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setStatusFilter('TODO'));
      expect(result.current.filterInput.status).toEqual(['TODO']);
      act(() => result.current.setStatusFilter('all'));
      expect(result.current.filterInput.status).toBeUndefined();
    });
  });

  // ── Combined filters ──

  describe('combined filters produce correct filterInput', () => {
    it('applies search + status + priority simultaneously', async () => {
      vi.useFakeTimers();
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => {
        result.current.setSearchQuery('login');
        result.current.setStatusFilter('TODO');
        result.current.setPriorityFilter('CRITICAL');
      });
      act(() => { vi.advanceTimersByTime(300); });
      expect(result.current.filterInput).toEqual({
        search: 'login',
        status: ['TODO'],
        priority: ['CRITICAL'],
      });
      vi.useRealTimers();
    });
  });

  // ── Custom field filters — state maintained ──

  describe('custom field filtering state', () => {
    it('maintains custom field filter state', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setCustomFieldFilter('cf-type', 'bug'));
      expect(result.current.customFieldFilters).toEqual({ 'cf-type': 'bug' });
      expect(result.current.hasActiveFilters).toBe(true);
    });

    it('ignores empty custom field filter values for hasActiveFilters', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setCustomFieldFilter('cf-type', ''));
      expect(result.current.hasActiveFilters).toBe(false);
    });
  });

  // ── Edge cases ──

  describe('edge cases', () => {
    it('handles empty task list', () => {
      const { result } = renderHook(() => useTaskFiltering([]));
      expect(result.current.filteredTasks).toHaveLength(0);
    });

    it('handles tasks with undefined optional fields', () => {
      const sparse: Task[] = [
        makeTask({
          taskId: 'sparse-1',
          description: undefined,
          assigneeId: undefined,
          labels: undefined,
        }),
      ];
      const { result } = renderHook(() => useTaskFiltering(sparse));
      expect(result.current.filteredTasks).toHaveLength(1);
    });
  });

  // ── clearFilters ──

  describe('clearFilters', () => {
    it('resets all filters to defaults', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => {
        result.current.setSearchQuery('test');
        result.current.setStatusFilter('DONE');
        result.current.setPriorityFilter('HIGH');
        result.current.setAssigneeFilter('user-1');
        result.current.setLabelFilter(['lbl-1']);
        result.current.setCustomFieldFilter('cf-1', 'val');
      });
      expect(result.current.hasActiveFilters).toBe(true);
      act(() => result.current.clearFilters());
      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.searchQuery).toBe('');
      expect(result.current.statusFilter).toBe('all');
      expect(result.current.priorityFilter).toBe('all');
      expect(result.current.assigneeFilter).toBe('all');
      expect(result.current.labelFilter).toEqual([]);
      expect(result.current.filterInput).toEqual({});
    });
  });

  // ── loadSavedFilter ──

  describe('loadSavedFilter', () => {
    it('loads saved filter from JSON and updates filterInput', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      const saved = JSON.stringify({
        statusFilter: 'DONE',
        priorityFilter: 'LOW',
        assigneeFilter: 'user-2',
        labelFilter: ['lbl-1'],
      });
      act(() => result.current.loadSavedFilter(saved));
      expect(result.current.statusFilter).toBe('DONE');
      expect(result.current.priorityFilter).toBe('LOW');
      expect(result.current.assigneeFilter).toBe('user-2');
      expect(result.current.labelFilter).toEqual(['lbl-1']);
      expect(result.current.filterInput).toEqual({
        status: ['DONE'],
        priority: ['LOW'],
        assigneeId: ['user-2'],
        labelIds: ['lbl-1'],
      });
    });

    it('ignores invalid JSON gracefully', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.loadSavedFilter('not json'));
      expect(result.current.statusFilter).toBe('all');
    });
  });
});
