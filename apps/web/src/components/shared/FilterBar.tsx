import type { OrgUser } from '../../types';
import { statusLabel } from '../../utils/taskHelpers';

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
}

const pillBase = 'text-xs px-2.5 py-1 rounded-full border transition-colors cursor-pointer';
const pillActive = 'border-slate-400 bg-slate-100 text-slate-700';
const pillInactive = 'border-slate-200 bg-white text-slate-500 hover:border-slate-300';

export default function FilterBar({
  statusFilter, priorityFilter, assigneeFilter,
  orgUsers, statuses, labels, labelFilter, onLabelChange,
  onStatusChange, onPriorityChange, onAssigneeChange,
  onClear, hasActiveFilters, className = '',
}: FilterBarProps) {
  const statusOptions = statuses ?? ['todo', 'in_progress', 'done'];

  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      <select
        value={statusFilter}
        onChange={(e) => onStatusChange(e.target.value)}
        className={`${pillBase} ${statusFilter !== 'all' ? pillActive : pillInactive}`}
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

      {hasActiveFilters && (
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
