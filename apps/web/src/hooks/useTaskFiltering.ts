import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import type { Task } from '../types';
import type { FilterGroupInput } from '../components/shared/FilterBuilder';
import { isTQLQuery } from '../utils/tqlHelpers';

export type { FilterGroupInput };

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
  filterGroup?: FilterGroupInput | null;
  tql?: string;
}

export interface ViewConfig {
  viewType?: string | null;
  sortBy?: string | null;
  sortOrder?: string | null;
  groupBy?: string | null;
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
  filterGroup: FilterGroupInput | null;
  setFilterGroup: (g: FilterGroupInput | null) => void;
  clearFilterGroup: () => void;
  setSearchQuery: (q: string) => void;
  setStatusFilter: (s: string) => void;
  setPriorityFilter: (p: string) => void;
  setAssigneeFilter: (a: string) => void;
  setLabelFilter: (ids: string[]) => void;
  setShowArchived: (v: boolean) => void;
  setCustomFieldFilter: (fieldId: string, value: string) => void;
  clearFilters: () => void;
  hasActiveFilters: boolean;
  loadSavedFilter: (filtersJson: string, viewConfig?: ViewConfig) => void;
  onViewConfigApplied?: (config: ViewConfig) => void;
  setOnViewConfigApplied: (cb: ((config: ViewConfig) => void) | undefined) => void;
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
  const [filterGroup, setFilterGroup] = useState<FilterGroupInput | null>(null);
  const viewConfigCallbackRef = useRef<((config: ViewConfig) => void) | undefined>();

  const setOnViewConfigApplied = useCallback((cb: ((config: ViewConfig) => void) | undefined) => {
    viewConfigCallbackRef.current = cb;
  }, []);

  // Debounce search input (300ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 300);
    return () => clearTimeout(debounceRef.current);
  }, [searchQuery]);

  const hasCustomFieldFilters = Object.values(customFieldFilters).some((v) => v !== '');
  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all' || labelFilter.length > 0 || showArchived || hasCustomFieldFilters || filterGroup !== null;

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
      if (isTQLQuery(debouncedSearch.trim())) {
        filter.tql = debouncedSearch.trim();
      } else {
        filter.search = debouncedSearch.trim();
      }
    }

    if (showArchived) {
      filter.showArchived = true;
    }

    if (filterGroup) {
      filter.filterGroup = filterGroup;
    }

    return filter;
  }, [statusFilter, priorityFilter, assigneeFilter, labelFilter, debouncedSearch, showArchived, filterGroup]);

  // Pass through tasks as-is — server-side filtering is applied via filterInput
  // when callers pass filterInput to loadTasks
  const filteredTasks = tasks;

  const clearFilterGroup = useCallback(() => setFilterGroup(null), []);

  const clearFilters = () => {
    setSearchQuery('');
    setDebouncedSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setAssigneeFilter('all');
    setLabelFilter([]);
    setCustomFieldFilters({});
    setFilterGroup(null);
  };

  const loadSavedFilter = useCallback((filtersJson: string, viewConfig?: ViewConfig) => {
    try {
      const parsed = JSON.parse(filtersJson) as {
        statusFilter?: string;
        priorityFilter?: string;
        assigneeFilter?: string;
        labelFilter?: string[];
        customFieldFilters?: Record<string, string>;
        filterGroup?: FilterGroupInput | null;
      };
      if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
      if (parsed.priorityFilter) setPriorityFilter(parsed.priorityFilter);
      if (parsed.assigneeFilter) setAssigneeFilter(parsed.assigneeFilter);
      if (parsed.labelFilter) setLabelFilter(parsed.labelFilter);
      if (parsed.customFieldFilters) setCustomFieldFilters(parsed.customFieldFilters);
      setFilterGroup(parsed.filterGroup ?? null);
    } catch { /* ignore invalid JSON */ }
    if (viewConfig && viewConfigCallbackRef.current) {
      viewConfigCallbackRef.current(viewConfig);
    }
  }, []);

  return {
    searchQuery, statusFilter, priorityFilter, assigneeFilter, labelFilter,
    customFieldFilters, filteredTasks, filterInput, filterGroup, setFilterGroup,
    clearFilterGroup, setSearchQuery, setStatusFilter,
    setPriorityFilter, setAssigneeFilter, setLabelFilter, showArchived, setShowArchived,
    setCustomFieldFilter, clearFilters, hasActiveFilters, loadSavedFilter,
    onViewConfigApplied: viewConfigCallbackRef.current, setOnViewConfigApplied,
  };
}
