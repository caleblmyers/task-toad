import { useState, useEffect } from 'react';
import type { TaskPlanPreview } from '../types';

const PRIORITY_STYLES: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-slate-100 text-slate-500',
};

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h >= 8) return `${+(h / 8).toFixed(1)}d`;
  return `${h}h`;
}

const PROGRESS_STEPS = [
  'Analyzing project scope…',
  'Breaking down into tasks…',
  'Estimating effort and priority…',
  'Building dependency graph…',
  'Finalizing task plan…',
];

function GeneratingProgress() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStep((s) => (s < PROGRESS_STEPS.length - 1 ? s + 1 : s));
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center py-12 gap-6">
      <div className="w-8 h-8 border-2 border-slate-300 border-t-slate-700 rounded-full animate-spin" />
      <div className="w-full max-w-xs space-y-3">
        {PROGRESS_STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium transition-colors duration-300 ${
              i < step ? 'bg-green-500 text-white' :
              i === step ? 'bg-slate-700 text-white' :
              'bg-slate-200 text-slate-400'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm transition-colors duration-300 ${
              i < step ? 'text-slate-400 line-through' :
              i === step ? 'text-slate-800 font-medium' :
              'text-slate-400'
            }`}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

interface TaskPlanCardProps {
  task: TaskPlanPreview;
  checked: boolean;
  onToggle: () => void;
}

function TaskPlanCard({ task, checked, onToggle }: TaskPlanCardProps) {
  const [expanded, setExpanded] = useState(false);
  const priorityClass = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium;

  return (
    <div
      className={`border rounded-xl p-4 transition-opacity ${
        checked ? 'border-slate-300 bg-white' : 'border-slate-200 bg-slate-50 opacity-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={checked}
          onChange={onToggle}
          className="mt-0.5 w-4 h-4 rounded border-slate-300 cursor-pointer flex-shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-800 text-sm">{task.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityClass}`}>
              {task.priority}
            </span>
            {task.estimatedHours != null && (
              <span className="text-xs text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                ~{formatHours(task.estimatedHours)}
              </span>
            )}
          </div>

          <p className="text-sm text-slate-600 mt-1 leading-snug">{task.description}</p>

          {task.dependsOn.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <span className="text-xs text-slate-400">Depends on:</span>
              {task.dependsOn.map((dep) => (
                <span key={dep} className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.5 rounded">
                  {dep}
                </span>
              ))}
            </div>
          )}

          {task.subtasks.length > 0 && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
            >
              <span>{expanded ? '▾' : '▸'}</span>
              <span>{task.subtasks.length} subtask{task.subtasks.length !== 1 ? 's' : ''} will be created</span>
            </button>
          )}

          {expanded && task.subtasks.length > 0 && (
            <ul className="mt-1.5 space-y-1 pl-3 border-l-2 border-slate-200">
              {task.subtasks.map((st, i) => (
                <li key={i} className="text-xs text-slate-600">
                  <span className="font-medium">{st.title}</span>
                  {st.description && (
                    <span className="text-slate-400"> — {st.description}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

export interface TaskPlanApprovalDialogProps {
  tasks: TaskPlanPreview[];
  loading: boolean;
  error: string | null;
  onApprove: (selectedTasks: TaskPlanPreview[]) => void;
  onRedo: (context: string) => void;
  onAddMore: (context: string) => void;
  onCancel: () => void;
}

export default function TaskPlanApprovalDialog({
  tasks,
  loading,
  error,
  onApprove,
  onRedo,
  onAddMore,
  onCancel,
}: TaskPlanApprovalDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(() => new Set(tasks.map((t) => t.title)));
  const [context, setContext] = useState('');

  // Sync selection when tasks list changes (redo/add-more)
  const prevTitles = tasks.map((t) => t.title).join('|');
  const [lastTitles, setLastTitles] = useState(prevTitles);
  if (prevTitles !== lastTitles) {
    setLastTitles(prevTitles);
    setSelected(new Set(tasks.map((t) => t.title)));
  }

  const toggleTask = (title: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const selectedTasks = tasks.filter((t) => selected.has(t.title));
  const selectedCount = selectedTasks.length;

  const handleRedo = () => {
    onRedo(context);
    setContext('');
  };

  const handleAddMore = () => {
    onAddMore(context);
    setContext('');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-start justify-center overflow-y-auto py-8 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-slate-200">
          <div>
            <h2 className="text-lg font-semibold text-slate-800">Review Task Plan</h2>
            {!loading && !error && (
              <p className="text-sm text-slate-500 mt-0.5">
                {tasks.length} task{tasks.length !== 1 ? 's' : ''} generated — deselect any you don't want
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none ml-4 mt-0.5 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Cancel"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <GeneratingProgress />
        ) : error ? (
          <div className="p-6 text-red-600 text-sm">{error}</div>
        ) : (
          <div className="overflow-y-auto max-h-[55vh] p-4 space-y-3">
            {tasks.map((task) => (
              <TaskPlanCard
                key={task.title}
                task={task}
                checked={selected.has(task.title)}
                onToggle={() => toggleTask(task.title)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          {/* Refine controls */}
          <div className="flex gap-2">
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add context to redo or add more tasks…"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-400 disabled:bg-slate-50 disabled:text-slate-400"
              disabled={loading}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey && !loading) handleRedo(); }}
            />
            <button
              type="button"
              onClick={handleRedo}
              disabled={loading}
              className="px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              ↺ Redo
            </button>
            <button
              type="button"
              onClick={handleAddMore}
              disabled={loading}
              className="px-3 py-1.5 text-sm border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              + Add more
            </button>
          </div>

          {/* Action row */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-500">
              {loading ? 'Generating…' : `${selectedCount} of ${tasks.length} task${tasks.length !== 1 ? 's' : ''} selected`}
            </span>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onCancel}
                disabled={loading}
                className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => onApprove(selectedTasks)}
                disabled={selectedCount === 0 || loading}
                className="px-5 py-2 text-sm bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Approve & create {selectedCount} task{selectedCount !== 1 ? 's' : ''} →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
