import type { TimeEntry } from '@tasktoad/shared-types';

interface TimeEntryListProps {
  entries: TimeEntry[];
  currentUserId?: string;
  onDelete: (timeEntryId: string) => void;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function TimeEntryList({ entries, currentUserId, onDelete }: TimeEntryListProps) {
  if (entries.length === 0) {
    return <p className="text-xs text-slate-400 italic">No time logged yet</p>;
  }

  return (
    <div className="space-y-1 max-h-40 overflow-y-auto">
      {entries.map((entry) => (
        <div
          key={entry.timeEntryId}
          className="flex items-center justify-between text-xs text-slate-600 py-1 px-1.5 rounded hover:bg-slate-50 group"
        >
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-slate-400 flex-shrink-0">{entry.loggedDate}</span>
            <span className="font-medium flex-shrink-0">{formatDuration(entry.durationMinutes)}</span>
            {entry.description && (
              <span className="truncate text-slate-500">{entry.description}</span>
            )}
            {entry.billable && (
              <span className="text-emerald-600 flex-shrink-0" title="Billable">$</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <span className="text-slate-400 text-[10px]">{entry.userEmail.split('@')[0]}</span>
            {currentUserId === entry.userId && (
              <button
                onClick={() => onDelete(entry.timeEntryId)}
                className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete"
                aria-label="Delete time entry"
              >
                &times;
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
