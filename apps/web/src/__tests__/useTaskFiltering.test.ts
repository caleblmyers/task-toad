// eslint-disable-next-line @typescript-eslint/triple-slash-reference
/// <reference types="vitest" />
import { describe, it, expect } from 'vitest';
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
  // ── Default behavior ──

  it('returns all non-archived tasks by default', () => {
    const { result } = renderHook(() => useTaskFiltering(sampleTasks));
    expect(result.current.filteredTasks).toHaveLength(4);
    expect(result.current.filteredTasks.every((t) => !t.archived)).toBe(true);
  });

  it('hasActiveFilters is false initially', () => {
    const { result } = renderHook(() => useTaskFiltering(sampleTasks));
    expect(result.current.hasActiveFilters).toBe(false);
  });

  // ── Search ──

  describe('search filtering', () => {
    it('filters by title (case-insensitive)', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setSearchQuery('LOGIN'));
      expect(result.current.filteredTasks.map((t) => t.taskId)).toEqual(
        expect.arrayContaining(['2', '5']),
      );
      expect(result.current.filteredTasks).toHaveLength(2);
    });

    it('filters by description (case-insensitive)', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setSearchQuery('postgresql'));
      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].taskId).toBe('1');
    });

    it('handles tasks with null description', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setSearchQuery('api tests'));
      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].taskId).toBe('3');
    });

    it('returns empty when no matches', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setSearchQuery('nonexistent xyz'));
      expect(result.current.filteredTasks).toHaveLength(0);
    });
  });

  // ── Status filter ──

  describe('status filtering', () => {
    it('filters by single status', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setStatusFilter('TODO'));
      // task 4 is archived, so only 1 and 5
      expect(result.current.filteredTasks.map((t) => t.taskId)).toEqual(
        expect.arrayContaining(['1', '5']),
      );
      expect(result.current.filteredTasks).toHaveLength(2);
    });

    it('"all" returns everything', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setStatusFilter('IN_PROGRESS'));
      act(() => result.current.setStatusFilter('all'));
      expect(result.current.filteredTasks).toHaveLength(4);
    });
  });

  // ── Priority filter ──

  describe('priority filtering', () => {
    it('filters by priority', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setPriorityFilter('HIGH'));
      // task 1 (HIGH, not archived) — task 4 is HIGH but archived
      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].taskId).toBe('1');
    });

    it('"all" returns everything', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setPriorityFilter('CRITICAL'));
      expect(result.current.filteredTasks).toHaveLength(1);
      act(() => result.current.setPriorityFilter('all'));
      expect(result.current.filteredTasks).toHaveLength(4);
    });
  });

  // ── Assignee filter ──

  describe('assignee filtering', () => {
    it('filters by specific assignee', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setAssigneeFilter('user-1'));
      expect(result.current.filteredTasks.map((t) => t.taskId)).toEqual(
        expect.arrayContaining(['1', '5']),
      );
      expect(result.current.filteredTasks).toHaveLength(2);
    });

    it('filters for unassigned tasks', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setAssigneeFilter('unassigned'));
      expect(result.current.filteredTasks.every((t) => !t.assigneeId)).toBe(true);
      // task 3 (unassigned, not archived) + task 4 is archived
      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].taskId).toBe('3');
    });
  });

  // ── Label filter ──

  describe('label filtering', () => {
    it('filters by single label', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setLabelFilter(['lbl-1']));
      // tasks 1 and 3 have lbl-1
      expect(result.current.filteredTasks.map((t) => t.taskId)).toEqual(
        expect.arrayContaining(['1', '3']),
      );
      expect(result.current.filteredTasks).toHaveLength(2);
    });

    it('filters by multiple labels (OR logic — task has any)', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setLabelFilter(['lbl-2', 'lbl-3']));
      // task 2 (lbl-2), task 3 (lbl-3)
      expect(result.current.filteredTasks.map((t) => t.taskId)).toEqual(
        expect.arrayContaining(['2', '3']),
      );
      expect(result.current.filteredTasks).toHaveLength(2);
    });

    it('returns no results if no tasks match label', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setLabelFilter(['lbl-999']));
      expect(result.current.filteredTasks).toHaveLength(0);
    });
  });

  // ── Custom field filter ──

  describe('custom field filtering', () => {
    const tasksWithCF: Task[] = [
      {
        ...makeTask({ taskId: 'cf-1', title: 'Task A' }),
        customFieldValues: [
          { field: { customFieldId: 'cf-type' }, value: 'Bug' },
        ],
      } as Task & { customFieldValues: Array<{ field: { customFieldId: string }; value: string }> },
      {
        ...makeTask({ taskId: 'cf-2', title: 'Task B' }),
        customFieldValues: [
          { field: { customFieldId: 'cf-type' }, value: 'Feature' },
        ],
      } as Task & { customFieldValues: Array<{ field: { customFieldId: string }; value: string }> },
      makeTask({ taskId: 'cf-3', title: 'Task C' }),
    ];

    it('filters by custom field value (case-insensitive includes)', () => {
      const { result } = renderHook(() => useTaskFiltering(tasksWithCF));
      act(() => result.current.setCustomFieldFilter('cf-type', 'bug'));
      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].taskId).toBe('cf-1');
    });

    it('excludes tasks without the custom field', () => {
      const { result } = renderHook(() => useTaskFiltering(tasksWithCF));
      act(() => result.current.setCustomFieldFilter('cf-type', 'feature'));
      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].taskId).toBe('cf-2');
    });

    it('ignores empty filter values', () => {
      const { result } = renderHook(() => useTaskFiltering(tasksWithCF));
      act(() => result.current.setCustomFieldFilter('cf-type', ''));
      expect(result.current.filteredTasks).toHaveLength(3);
    });
  });

  // ── Archived ──

  describe('showArchived', () => {
    it('shows archived tasks when enabled', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.setShowArchived(true));
      expect(result.current.filteredTasks).toHaveLength(5);
    });
  });

  // ── Combined filters ──

  describe('combined filters', () => {
    it('applies search + status + priority simultaneously', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => {
        result.current.setSearchQuery('login');
        result.current.setStatusFilter('TODO');
        result.current.setPriorityFilter('CRITICAL');
      });
      // Only task 5: "Fix login bug", TODO, CRITICAL
      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].taskId).toBe('5');
    });

    it('search + assignee narrows results', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => {
        result.current.setSearchQuery('database');
        result.current.setAssigneeFilter('user-1');
      });
      expect(result.current.filteredTasks).toHaveLength(1);
      expect(result.current.filteredTasks[0].taskId).toBe('1');
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
    });
  });

  // ── loadSavedFilter ──

  describe('loadSavedFilter', () => {
    it('loads saved filter from JSON', () => {
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
    });

    it('ignores invalid JSON gracefully', () => {
      const { result } = renderHook(() => useTaskFiltering(sampleTasks));
      act(() => result.current.loadSavedFilter('not json'));
      expect(result.current.statusFilter).toBe('all');
    });
  });
});
