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
            {entry.autoTracked && (
              <span className="inline-flex items-center gap-0.5 text-[10px] text-blue-500 bg-blue-50 dark:bg-blue-900/30 px-1 rounded flex-shrink-0" title="Auto-tracked from status change">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" className="w-2.5 h-2.5"><path fillRule="evenodd" d="M8 15A7 7 0 1 0 8 1a7 7 0 0 0 0 14Zm.75-10.25a.75.75 0 0 0-1.5 0V8c0 .199.079.39.22.53l2 2a.75.75 0 1 0 1.06-1.06L8.75 7.69V4.75Z" clipRule="evenodd" /></svg>
                Auto
              </span>
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
