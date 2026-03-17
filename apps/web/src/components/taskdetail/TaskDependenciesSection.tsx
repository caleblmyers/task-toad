import { useState } from 'react';
import type { Task } from '../../types';

interface TaskDependenciesSectionProps {
  task: Task;
  allTasks: Task[];
  disabled?: boolean;
  onUpdateDependencies: (taskId: string, dependsOnIds: string[]) => void;
}

function parseDependsOn(raw?: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
}

export default function TaskDependenciesSection({
  task,
  allTasks,
  disabled,
  onUpdateDependencies,
}: TaskDependenciesSectionProps) {
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [depSearch, setDepSearch] = useState('');

  const depIds = parseDependsOn(task.dependsOn);

  const availableTasks = allTasks.filter(
    (t) => t.taskId !== task.taskId && !depIds.includes(t.taskId)
  );
  const filteredAvailable = depSearch
    ? availableTasks.filter((t) => t.title.toLowerCase().includes(depSearch.toLowerCase()))
    : availableTasks;

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Dependencies</p>
      <div className="space-y-1 mb-1">
        {depIds.map((id) => {
          const depTask = allTasks.find((t) => t.taskId === id);
          const dotColor = depTask
            ? depTask.status === 'done' ? 'bg-green-500'
            : depTask.status === 'in_progress' ? 'bg-blue-500'
            : depTask.status === 'in_review' ? 'bg-amber-500'
            : 'bg-slate-400'
            : 'bg-slate-300';
          return (
            <div key={id} className="flex items-center gap-2 group">
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
              {depTask ? (
                <span className="text-xs text-slate-700 truncate">{depTask.title}</span>
              ) : (
                <span className="text-xs font-mono text-slate-400">{id.slice(0, 8)} (unknown)</span>
              )}
              <button
                onClick={() => onUpdateDependencies(task.taskId, depIds.filter((d) => d !== id))}
                className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                disabled={disabled}
              >
                <span className="text-xs">✕</span>
              </button>
            </div>
          );
        })}
        {depIds.length === 0 && !showDepPicker && (
          <span className="text-xs text-slate-400">None</span>
        )}
      </div>
      {showDepPicker ? (
        <div>
          <input
            type="text"
            value={depSearch}
            onChange={(e) => setDepSearch(e.target.value)}
            placeholder="Search tasks…"
            className="w-full text-sm border border-slate-300 rounded px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-brand-green"
            autoFocus
          />
          <div className="max-h-32 overflow-y-auto border border-slate-200 rounded">
            {filteredAvailable.slice(0, 10).map((t) => (
              <button
                key={t.taskId}
                onClick={() => {
                  onUpdateDependencies(task.taskId, [...depIds, t.taskId]);
                  setDepSearch('');
                  setShowDepPicker(false);
                }}
                className="w-full text-left px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                {t.title}
              </button>
            ))}
            {filteredAvailable.length === 0 && (
              <p className="text-xs text-slate-400 px-2 py-1">No tasks available</p>
            )}
          </div>
          <button onClick={() => setShowDepPicker(false)} className="text-xs text-slate-400 hover:text-slate-600 mt-1">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setShowDepPicker(true)}
          className="text-xs text-slate-500 hover:text-slate-700"
          disabled={disabled}
        >
          + Add dependency
        </button>
      )}
    </div>
  );
}
