import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Task } from '../types';

export interface TaskFilterInput {
  status?: string[];
  priority?: string[];
  assigneeId?: string[];
  labelIds?: string[];
  search?: string;
  showArchived?: boolean;
  epicId?: string;
  sprintId?: string;
  dueDateFrom?: string;
  dueDateTo?: string;
  sortBy?: string;
  sortOrder?: string;
}

export interface TaskFiltering {
  searchQuery: string;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  labelFilter: string[];
  showArchived: boolean;
  customFieldFilters: Record<string, string>;
  filteredTasks: Task[];
  filterInput: TaskFilterInput;
  setSearchQuery: (q: string) => void;
  setStatusFilter: (s: string) => void;
  setPriorityFilter: (p: string) => void;
  setAssigneeFilter: (a: string) => void;
  setLabelFilter: (ids: string[]) => void;
  setShowArchived: (v: boolean) => void;
  setCustomFieldFilter: (fieldId: string, value: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  loadSavedFilter: (filtersJson: string) => void;
}

/**
 * Task filtering hook that supports both client-side and server-side filtering.
 *
 * When `tasks` are provided, `filteredTasks` passes them through as-is (assumes
 * server-side filtering was already applied via `filterInput`). This maintains
 * backward compatibility with existing consumers.
 *
 * The `filterInput` object is always available for callers to pass to the
 * server-side `tasks` query.
 */
export function useTaskFiltering(tasks: Task[]): TaskFiltering {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'all'>('all');
  const [labelFilter, setLabelFilter] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [customFieldFilters, setCustomFieldFilters] = useState<Record<string, string>>({});

  // Debounce search input (300ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const hasCustomFieldFilters = Object.values(customFieldFilters).some((v) => v !== '');
  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all' || labelFilter.length > 0 || showArchived || hasCustomFieldFilters;

  const setCustomFieldFilter = useCallback((fieldId: string, value: string) => {
    setCustomFieldFilters((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

  // Build the GraphQL-ready filter input from current state
  const filterInput = useMemo((): TaskFilterInput => {
    const filter: TaskFilterInput = {};

    if (statusFilter !== 'all') {
      filter.status = [statusFilter];
    }

    if (priorityFilter !== 'all') {
      filter.priority = [priorityFilter];
    }

    if (assigneeFilter !== 'all') {
      filter.assigneeId = [assigneeFilter];
    }

    if (labelFilter.length > 0) {
      filter.labelIds = labelFilter;
    }

    if (debouncedSearch.trim()) {
      filter.search = debouncedSearch.trim();
    }

    if (showArchived) {
      filter.showArchived = true;
    }

    return filter;
  }, [statusFilter, priorityFilter, assigneeFilter, labelFilter, debouncedSearch, showArchived]);

  // Pass through tasks as-is — server-side filtering is applied via filterInput
  // when callers pass filterInput to loadTasks
  const filteredTasks = tasks;

  const clearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setLabelFilter([]);
    setCustomFieldFilters({});
  };

  const loadSavedFilter = useCallback((filtersJson: string) => {
    try {
      const parsed = JSON.parse(filtersJson) as {
        statusFilter?: string;
        priorityFilter?: string;
        assigneeFilter?: string;
        labelFilter?: string[];
        customFieldFilters?: Record<string, string>;
      };
      if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
      if (parsed.priorityFilter) setPriorityFilter(parsed.priorityFilter);
      if (parsed.assigneeFilter) setAssigneeFilter(parsed.assigneeFilter);
      if (parsed.labelFilter) setLabelFilter(parsed.labelFilter);
      if (parsed.customFieldFilters) setCustomFieldFilters(parsed.customFieldFilters);
    } catch { /* ignore invalid JSON */ }
  }, []);

  return {
    searchQuery, statusFilter, priorityFilter, assigneeFilter, labelFilter,
    customFieldFilters, filteredTasks, filterInput, setSearchQuery, setStatusFilter,
    setPriorityFilter, setAssigneeFilter, setLabelFilter, showArchived, setShowArchived,
    setCustomFieldFilter, clearFilters, hasActiveFilters, loadSavedFilter,
  };
}
