import { useState, useMemo } from 'react';
import type { Task } from '../types';

export interface TaskFiltering {
  searchQuery: string;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  labelFilter: string[];
  showArchived: boolean;
  filteredTasks: Task[];
  setSearchQuery: (q: string) => void;
  setStatusFilter: (s: string) => void;
  setPriorityFilter: (p: string) => void;
  setAssigneeFilter: (a: string) => void;
  setLabelFilter: (ids: string[]) => void;
  setShowArchived: (v: boolean) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
}

export function useTaskFiltering(tasks: Task[]): TaskFiltering {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'all'>('all');
  const [labelFilter, setLabelFilter] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);

  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all' || labelFilter.length > 0 || showArchived;

  const filteredTasks = useMemo(() => {
    let result = tasks;
    if (!showArchived) {
      result = result.filter((t) => !t.archived);
    }
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
    if (labelFilter.length > 0) {
      result = result.filter((t) =>
        t.labels?.some((l) => labelFilter.includes(l.labelId))
      );
    }
    return result;
  }, [tasks, searchQuery, statusFilter, priorityFilter, assigneeFilter, labelFilter, showArchived]);

  const clearFilters = () => {
    setSearchQuery('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setLabelFilter([]);
  };

  return {
    searchQuery, statusFilter, priorityFilter, assigneeFilter, labelFilter,
    filteredTasks, setSearchQuery, setStatusFilter, setPriorityFilter,
    setAssigneeFilter, setLabelFilter, showArchived, setShowArchived, clearFilters, hasActiveFilters,
  };
}
