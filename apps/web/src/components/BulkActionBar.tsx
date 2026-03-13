import type { Sprint, OrgUser } from '../types';
import { statusLabel } from '../utils/taskHelpers';

interface BulkActionBarProps {
  selectedCount: number;
  statuses: string[];
  sprints: Sprint[];
  orgUsers: OrgUser[];
  onBulkUpdate: (updates: { status?: string; assigneeId?: string | null; sprintId?: string | null; archived?: boolean }) => void;
  onClearSelection: () => void;
}

export default function BulkActionBar({
  selectedCount,
  statuses,
  sprints,
  orgUsers,
  onBulkUpdate,
  onClearSelection,
}: BulkActionBarProps) {
  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-slate-800 text-white rounded-xl shadow-xl px-4 py-2.5 flex items-center gap-3 z-50 animate-slide-in-up">
      <span className="text-sm font-medium">{selectedCount} selected</span>
      <div className="w-px h-5 bg-slate-600" />

      {/* Status */}
      <select
        defaultValue=""
        onChange={(e) => { if (e.target.value) onBulkUpdate({ status: e.target.value }); e.target.value = ''; }}
        className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 cursor-pointer"
      >
        <option value="" disabled>Status…</option>
        {statuses.map((s) => (
          <option key={s} value={s}>{statusLabel(s)}</option>
        ))}
      </select>

      {/* Assign */}
      <select
        defaultValue=""
        onChange={(e) => { if (e.target.value !== '') onBulkUpdate({ assigneeId: e.target.value || null }); e.target.value = ''; }}
        className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 cursor-pointer"
      >
        <option value="" disabled>Assign…</option>
        <option value="">Unassign</option>
        {orgUsers.map((u) => (
          <option key={u.userId} value={u.userId}>{u.email}</option>
        ))}
      </select>

      {/* Sprint */}
      <select
        defaultValue=""
        onChange={(e) => { if (e.target.value !== '') onBulkUpdate({ sprintId: e.target.value || null }); e.target.value = ''; }}
        className="bg-slate-700 text-white text-xs rounded px-2 py-1 border border-slate-600 cursor-pointer"
      >
        <option value="" disabled>Sprint…</option>
        <option value="">Backlog</option>
        {sprints.filter((s) => !s.closedAt).map((s) => (
          <option key={s.sprintId} value={s.sprintId}>{s.name}</option>
        ))}
      </select>

      {/* Archive */}
      <button
        onClick={() => onBulkUpdate({ archived: true })}
        className="text-xs bg-slate-700 hover:bg-red-600 text-white px-2 py-1 rounded border border-slate-600 transition-colors"
      >
        Archive
      </button>

      <div className="w-px h-5 bg-slate-600" />
      <button
        onClick={onClearSelection}
        className="text-xs text-slate-400 hover:text-white px-1"
      >
        ✕ Clear
      </button>
    </div>
  );
}
