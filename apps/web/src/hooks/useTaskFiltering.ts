import { useState, useMemo, useCallback } from 'react';
import type { Task } from '../types';

export interface TaskFiltering {
  searchQuery: string;
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  labelFilter: string[];
  showArchived: boolean;
  customFieldFilters: Record<string, string>;
  filteredTasks: Task[];
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

interface CustomFieldValue {
  field: { customFieldId: string };
  value: string;
}

export function useTaskFiltering(tasks: Task[]): TaskFiltering {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string | 'all'>('all');
  const [labelFilter, setLabelFilter] = useState<string[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [customFieldFilters, setCustomFieldFilters] = useState<Record<string, string>>({});

  const hasCustomFieldFilters = Object.values(customFieldFilters).some((v) => v !== '');
  const hasActiveFilters = searchQuery !== '' || statusFilter !== 'all' || priorityFilter !== 'all' || assigneeFilter !== 'all' || labelFilter.length > 0 || showArchived || hasCustomFieldFilters;

  const setCustomFieldFilter = useCallback((fieldId: string, value: string) => {
    setCustomFieldFilters((prev) => ({ ...prev, [fieldId]: value }));
  }, []);

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
    // Custom field filters
    const activeCfFilters = Object.entries(customFieldFilters).filter(([, v]) => v !== '');
    if (activeCfFilters.length > 0) {
      result = result.filter((t) => {
        const cfValues = (t as Task & { customFieldValues?: CustomFieldValue[] }).customFieldValues ?? [];
        return activeCfFilters.every(([fieldId, filterVal]) => {
          const cfv = cfValues.find((v) => v.field.customFieldId === fieldId);
          if (!cfv) return false;
          return cfv.value.toLowerCase().includes(filterVal.toLowerCase());
        });
      });
    }
    return result;
  }, [tasks, searchQuery, statusFilter, priorityFilter, assigneeFilter, labelFilter, showArchived, customFieldFilters]);

  const clearFilters = () => {
    setSearchQuery('');
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
    customFieldFilters, filteredTasks, setSearchQuery, setStatusFilter, setPriorityFilter,
    setAssigneeFilter, setLabelFilter, showArchived, setShowArchived,
    setCustomFieldFilter, clearFilters, hasActiveFilters, loadSavedFilter,
  };
}
