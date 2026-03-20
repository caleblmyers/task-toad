import { useState } from 'react';
import type { OrgUser } from '../../types';
import { statusLabel } from '../../utils/taskHelpers';
import { parseOptions } from '../../utils/jsonHelpers';
import { gql } from '../../api/client';

export interface SavedFilter {
  savedFilterId: string;
  name: string;
  filters: string;
  viewType?: string | null;
  sortBy?: string | null;
  sortOrder?: string | null;
  groupBy?: string | null;
  visibleColumns?: string | null;
  isShared: boolean;
  isDefault: boolean;
  createdAt: string;
}

interface CustomFieldDef {
  customFieldId: string;
  name: string;
  fieldType: string;
  options: string | null;
}

interface FilterBarProps {
  statusFilter: string;
  priorityFilter: string;
  assigneeFilter: string;
  orgUsers: OrgUser[];
  statuses?: string[];
  labels?: Array<{ labelId: string; name: string; color: string }>;
  labelFilter?: string[];
  onLabelChange?: (ids: string[]) => void;
  onStatusChange: (v: string) => void;
  onPriorityChange: (v: string) => void;
  onAssigneeChange: (v: string) => void;
  onClear: () => void;
  hasActiveFilters: boolean;
  className?: string;
  projectId?: string;
  savedFilters?: SavedFilter[];
  onSavedFiltersChange?: (filters: SavedFilter[]) => void;
  onLoadFilter?: (filters: string) => void;
  customFields?: CustomFieldDef[];
  customFieldFilters?: Record<string, string>;
  onCustomFieldFilterChange?: (fieldId: string, value: string) => void;
}

const pillBase = 'text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer';
const pillActive = 'border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200';
const pillInactive = 'border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500';

export default function FilterBar({
  statusFilter, priorityFilter, assigneeFilter,
  orgUsers, statuses, labels, labelFilter, onLabelChange,
  onStatusChange, onPriorityChange, onAssigneeChange,
  onClear, hasActiveFilters, className = '',
  projectId, savedFilters, onSavedFiltersChange, onLoadFilter,
  customFields, customFieldFilters, onCustomFieldFilterChange,
}: FilterBarProps) {
  const statusOptions = statuses ?? ['todo', 'in_progress', 'done'];
  const [saveName, setSaveName] = useState('');
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [filterError, setFilterError] = useState<string | null>(null);

  const handleSaveFilter = async () => {
    if (!projectId || !saveName.trim()) return;
    const filtersJson = JSON.stringify({
      statusFilter, priorityFilter, assigneeFilter, labelFilter: labelFilter ?? [],
      customFieldFilters: customFieldFilters ?? {},
    });
    try {
      setFilterError(null);
      const { saveFilter } = await gql<{ saveFilter: SavedFilter }>(
        `mutation SaveFilter($projectId: ID!, $name: String!, $filters: String!) {
          saveFilter(projectId: $projectId, name: $name, filters: $filters) { savedFilterId name filters viewType sortBy sortOrder groupBy visibleColumns isShared isDefault createdAt }
        }`,
        { projectId, name: saveName.trim(), filters: filtersJson },
      );
      onSavedFiltersChange?.([...(savedFilters ?? []), saveFilter]);
      setSaveName('');
      setShowSaveInput(false);
    } catch (e) {
      setFilterError(e instanceof Error ? e.message : 'Failed to save filter');
    }
  };

  const handleDeleteFilter = async (filterId: string) => {
    try {
      setFilterError(null);
      await gql<{ deleteFilter: boolean }>(
        `mutation DeleteFilter($savedFilterId: ID!) { deleteFilter(savedFilterId: $savedFilterId) }`,
        { savedFilterId: filterId },
      );
      onSavedFiltersChange?.((savedFilters ?? []).filter((f) => f.savedFilterId !== filterId));
    } catch (e) {
      setFilterError(e instanceof Error ? e.message : 'Failed to delete filter');
    }
  };

  const getDropdownOptions = (field: CustomFieldDef): string[] => {
    return parseOptions(field.options);
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {filterError && (
        <p className="text-xs text-red-500">{filterError}</p>
      )}
      {/* Saved filters pills */}
      {savedFilters && savedFilters.length > 0 && onLoadFilter && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-xs text-slate-500 mr-1">Saved:</span>
          {savedFilters.map((sf) => (
            <span key={sf.savedFilterId} className="inline-flex items-center gap-1">
              <button
                onClick={() => onLoadFilter(sf.filters)}
                className={`${pillBase} ${pillInactive}`}
              >
                {sf.name}
              </button>
              <button
                onClick={() => handleDeleteFilter(sf.savedFilterId)}
                className="text-xs text-slate-500 hover:text-red-400 -ml-1"
                title="Delete filter"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value)}
          className={`${pillBase} ${statusFilter !== 'all' ? pillActive : pillInactive}`}
          aria-label="Filter by status"
        >
          <option value="all">Status</option>
          {statusOptions.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>

        <select
          value={priorityFilter}
          onChange={(e) => onPriorityChange(e.target.value)}
          className={`${pillBase} ${priorityFilter !== 'all' ? pillActive : pillInactive}`}
          aria-label="Filter by priority"
        >
          <option value="all">Priority</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <select
          value={assigneeFilter}
          onChange={(e) => onAssigneeChange(e.target.value)}
          className={`${pillBase} ${assigneeFilter !== 'all' ? pillActive : pillInactive}`}
          aria-label="Filter by assignee"
        >
          <option value="all">Assignee</option>
          <option value="unassigned">Unassigned</option>
          {orgUsers.map((u) => (
            <option key={u.userId} value={u.userId}>{u.email}</option>
          ))}
        </select>

        {labels && labels.length > 0 && onLabelChange && (
          <div className="flex items-center gap-1">
            {labels.map((l) => {
              const isActive = labelFilter?.includes(l.labelId);
              return (
                <button
                  key={l.labelId}
                  onClick={() => {
                    if (isActive) {
                      onLabelChange((labelFilter ?? []).filter((id) => id !== l.labelId));
                    } else {
                      onLabelChange([...(labelFilter ?? []), l.labelId]);
                    }
                  }}
                  className={`${pillBase} ${isActive ? pillActive : pillInactive} flex items-center gap-1`}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} />
                  {l.name}
                </button>
              );
            })}
          </div>
        )}

        {/* Custom field filters */}
        {customFields && customFields.length > 0 && onCustomFieldFilterChange && customFields.map((field) => {
          const filterVal = customFieldFilters?.[field.customFieldId] ?? '';
          if (field.fieldType === 'DROPDOWN') {
            return (
              <select
                key={field.customFieldId}
                value={filterVal}
                onChange={(e) => onCustomFieldFilterChange(field.customFieldId, e.target.value)}
                className={`${pillBase} ${filterVal ? pillActive : pillInactive}`}
                aria-label={`Filter by ${field.name}`}
              >
                <option value="">{field.name}</option>
                {getDropdownOptions(field).map((opt) => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
            );
          }
          if (field.fieldType === 'TEXT') {
            return (
              <input
                key={field.customFieldId}
                type="text"
                value={filterVal}
                onChange={(e) => onCustomFieldFilterChange(field.customFieldId, e.target.value)}
                placeholder={field.name}
                aria-label={`Filter by ${field.name}`}
                className={`${pillBase} w-24 ${filterVal ? pillActive : pillInactive}`}
              />
            );
          }
          if (field.fieldType === 'NUMBER') {
            const [numOp, numVal] = filterVal.includes(':') ? filterVal.split(':', 2) : ['=', filterVal];
            return (
              <span key={field.customFieldId} className="inline-flex items-center gap-0.5">
                <select
                  value={numOp || '='}
                  onChange={(e) => onCustomFieldFilterChange(field.customFieldId, `${e.target.value}:${numVal || ''}`)}
                  className={`${pillBase} ${filterVal ? pillActive : pillInactive}`}
                  aria-label={`${field.name} comparison operator`}
                >
                  <option value="=">=</option>
                  <option value="<">&lt;</option>
                  <option value=">">&gt;</option>
                  <option value="<=">&le;</option>
                  <option value=">=">&ge;</option>
                </select>
                <input
                  type="number"
                  value={numVal || ''}
                  onChange={(e) => onCustomFieldFilterChange(field.customFieldId, `${numOp || '='}:${e.target.value}`)}
                  placeholder={field.name}
                  aria-label={`Filter by ${field.name}`}
                  className={`${pillBase} w-20 ${filterVal ? pillActive : pillInactive}`}
                />
              </span>
            );
          }
          if (field.fieldType === 'DATE') {
            const [dateOp, dateVal] = filterVal.includes(':') ? filterVal.split(':', 2) : ['=', filterVal];
            return (
              <span key={field.customFieldId} className="inline-flex items-center gap-0.5">
                <select
                  value={dateOp || '='}
                  onChange={(e) => onCustomFieldFilterChange(field.customFieldId, `${e.target.value}:${dateVal || ''}`)}
                  className={`${pillBase} ${filterVal ? pillActive : pillInactive}`}
                  aria-label={`${field.name} date comparison operator`}
                >
                  <option value="=">=</option>
                  <option value="<">&lt;</option>
                  <option value=">">&gt;</option>
                  <option value="<=">&le;</option>
                  <option value=">=">&ge;</option>
                </select>
                <input
                  type="date"
                  value={dateVal || ''}
                  onChange={(e) => onCustomFieldFilterChange(field.customFieldId, `${dateOp || '='}:${e.target.value}`)}
                  aria-label={`Filter by ${field.name}`}
                  className={`${pillBase} ${filterVal ? pillActive : pillInactive}`}
                />
              </span>
            );
          }
          return null;
        })}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-slate-500 hover:text-slate-600 px-2 py-1"
          >
            Clear filters
          </button>
        )}

        {/* Save filter button */}
        {projectId && onSavedFiltersChange && hasActiveFilters && (
          showSaveInput ? (
            <span className="inline-flex items-center gap-1">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="Filter name"
                aria-label="Save filter name"
                className="text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 w-28 focus:outline-none focus:ring-1 focus:ring-brand-green dark:bg-slate-700 dark:text-slate-200"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveFilter(); }}
                autoFocus
              />
              <button
                onClick={handleSaveFilter}
                disabled={!saveName.trim()}
                className="text-xs text-slate-600 hover:text-slate-800 disabled:opacity-50"
              >
                Save
              </button>
              <button onClick={() => setShowSaveInput(false)} className="text-xs text-slate-500 hover:text-slate-600">
                Cancel
              </button>
            </span>
          ) : (
            <button
              onClick={() => setShowSaveInput(true)}
              className="text-xs text-slate-500 hover:text-slate-600 px-2 py-1"
            >
              Save filter
            </button>
          )
        )}
      </div>
    </div>
  );
}
