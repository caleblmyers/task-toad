import { useState } from 'react';
import type { Task } from '../../types';
import { statusLabel } from '../../utils/taskHelpers';

interface TaskSubtasksSectionProps {
  task: Task;
  subtasks: Task[];
  statuses: string[];
  generatingInstructions: string | null;
  disabled?: boolean;
  onSubtaskStatusChange: (parentId: string, taskId: string, status: string) => void;
  onGenerateInstructions: (task: Task) => void;
  onCreateSubtask?: (parentTaskId: string, title: string) => Promise<void>;
  onAutoComplete?: (task: Task) => void;
  autoCompleteLoading?: boolean;
}

export default function TaskSubtasksSection({
  task,
  subtasks,
  statuses,
  generatingInstructions,
  disabled,
  onSubtaskStatusChange,
  onGenerateInstructions,
  onCreateSubtask,
  onAutoComplete,
  autoCompleteLoading,
}: TaskSubtasksSectionProps) {
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [showSubtaskForm, setShowSubtaskForm] = useState(false);

  const showSection = subtasks.length > 0 || ((task.taskType === 'epic' || task.taskType === 'story') && onCreateSubtask);

  if (!showSection) return null;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Tasks
        </p>
        {task.progress && task.progress.total > 0 && (
          <span className="text-xs text-slate-400">
            {task.progress.completed}/{task.progress.total} done
          </span>
        )}
      </div>
      {task.progress && task.progress.total > 0 && (
        <div className="w-full bg-slate-200 rounded-full h-1.5 mb-2">
          <div
            className="bg-green-500 rounded-full h-1.5 transition-all"
            style={{ width: `${task.progress.percentage}%` }}
          />
        </div>
      )}
      <ul className="space-y-2">
        {subtasks.map((st) => (
          <li key={st.taskId} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                {st.taskType && st.taskType !== 'task' && (
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    st.taskType === 'story' ? 'bg-blue-500' : 'bg-slate-400'
                  }`} />
                )}
                <p className="text-sm font-medium text-slate-800">{st.title}</p>
              </div>
              <select
                value={st.status}
                onChange={(e) =>
                  onSubtaskStatusChange(task.taskId, st.taskId, e.target.value)
                }
                className="text-xs border border-slate-300 rounded px-1.5 py-0.5 flex-shrink-0"
                disabled={disabled}
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>{statusLabel(s)}</option>
                ))}
              </select>
            </div>
            {st.description && (
              <p className="text-xs text-slate-500 mt-1">{st.description}</p>
            )}
            {st.instructions && (
              <details className="mt-2">
                <summary className="text-xs text-slate-500 cursor-pointer">Instructions</summary>
                <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{st.instructions}</p>
              </details>
            )}
          </li>
        ))}
      </ul>

      {/* Generate instructions button (for subtasks without instructions) */}
      {subtasks.some((st) => !st.instructions) && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => onGenerateInstructions(task)}
            disabled={disabled || generatingInstructions === task.taskId}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
          >
            {generatingInstructions === task.taskId ? 'Generating…' : '✦ Generate instructions'}
          </button>
          {onAutoComplete && task.instructions && (
            <button
              type="button"
              onClick={() => onAutoComplete(task)}
              disabled={disabled || autoCompleteLoading}
              className="px-3 py-1.5 text-sm border border-indigo-300 text-indigo-700 rounded hover:bg-indigo-50 disabled:opacity-50"
            >
              {autoCompleteLoading ? 'Planning…' : '⚡ Auto-Complete'}
            </button>
          )}
        </div>
      )}

      {onCreateSubtask && (task.taskType === 'epic' || task.taskType === 'story') && (
        showSubtaskForm ? (
          <form
            className="flex gap-2 mt-2"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newSubtaskTitle.trim()) return;
              await onCreateSubtask(task.taskId, newSubtaskTitle.trim());
              setNewSubtaskTitle('');
              setShowSubtaskForm(false);
            }}
          >
            <input
              type="text"
              value={newSubtaskTitle}
              onChange={(e) => setNewSubtaskTitle(e.target.value)}
              placeholder="New task title…"
              className="flex-1 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-green"
              autoFocus
            />
            <button type="submit" className="text-sm px-3 py-1 bg-brand-green text-white rounded hover:bg-brand-green-hover">Add</button>
            <button type="button" onClick={() => setShowSubtaskForm(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
          </form>
        ) : (
          <button
            onClick={() => setShowSubtaskForm(true)}
            className="text-xs text-slate-500 hover:text-slate-700 mt-2"
            disabled={disabled}
          >
            + Add task
          </button>
        )
      )}
    </div>
  );
}
