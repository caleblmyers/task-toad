import { useState, useMemo } from 'react';
import type { Task } from '../types';

export interface TaskFiltering {
  searchQuery: string;
  statusFilter: Task['status'] | 'all';
  priorityFilter: string | 'all';
  assigneeFilter: string | 'all';
  filteredTasks: Task[];
  setSearchQuery: (q: string) => void;
  setStatusFilter: (s: Task['status'] | 'all') => void;
  setPriorityFilter: (p: string | 'all') => void;
  setAssigneeFilter: (a: string | 'all') => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useTaskFiltering(tasks: Task[]): TaskFiltering {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<Task['status'] | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<string | 'all'>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'all'>('all');

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all';

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') {
      result = result.filter((t) => t.status === statusFilter);
    }
    if (priorityFilter !== 'all') {
      result = result.filter((t) => t.priority === priorityFilter);
    }
    if (assigneeFilter !== 'all') {
      if (assigneeFilter === 'unassigned') {
        result = result.filter((t) => !t.assigneeId);
      } else {
        result = result.filter((t) => t.assigneeId === assigneeFilter);
      }
    }
    return result;
  }, [tasks, searchQuery, statusFilter, priorityFilter, assigneeFilter]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
  };

  return {
    searchQuery, statusFilter, priorityFilter, assigneeFilter,
    filteredTasks, setSearchQuery, setStatusFilter, setPriorityFilter,
    setAssigneeFilter, clearFilters, hasActiveFilters,
  };
}
