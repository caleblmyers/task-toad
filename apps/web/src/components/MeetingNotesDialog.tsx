import { useState } from 'react';
import { gql } from '../api/client';
import { IconClose } from './shared/Icons';

interface ExtractedTask {
  title: string;
  description?: string;
  assigneeName?: string;
  priority?: string;
  status?: string;
}

interface MeetingNotesResult {
  tasks: ExtractedTask[];
  summary: string;
}

interface Props {
  projectId: string;
  onTasksCreated: () => void;
  onClose: () => void;
}

const priorityStyles: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-slate-100 text-slate-500',
};

export default function MeetingNotesDialog({ projectId, onTasksCreated, onClose }: Props) {
  const [notes, setNotes] = useState('');
  const [result, setResult] = useState<MeetingNotesResult | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = async () => {
    if (!notes.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ extractTasksFromNotes: MeetingNotesResult }>(
        `query ExtractTasks($projectId: ID!, $notes: String!) {
          extractTasksFromNotes(projectId: $projectId, notes: $notes) {
            tasks { title description assigneeName priority status }
            summary
          }
        }`,
        { projectId, notes }
      );
      setResult(data.extractTasksFromNotes);
      setSelected(new Set(data.extractTasksFromNotes.tasks.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to extract tasks');
    } finally {
      setLoading(false);
    }
  };

  const toggleTask = (idx: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (!result) return;
    if (selected.size === result.tasks.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(result.tasks.map((_, i) => i)));
    }
  };

  const handleCreate = async () => {
    if (!result || selected.size === 0) return;
    setCreating(true);
    setError(null);
    try {
      const tasksToCreate = result.tasks.filter((_, i) => selected.has(i));
      for (const task of tasksToCreate) {
        await gql<{ createTask: { taskId: string } }>(
          `mutation CreateTask($projectId: ID!, $title: String!, $status: String) {
            createTask(projectId: $projectId, title: $title, status: $status) { taskId }
          }`,
          { projectId, title: task.title, status: task.status || 'todo' }
        );
      }
      onTasksCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tasks');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-shrink-0">
          <p className="text-sm font-semibold text-slate-800">Extract Tasks from Meeting Notes</p>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {!result ? (
            <>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Paste your meeting notes here..."
                className="w-full h-48 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-400 resize-y"
                disabled={loading}
              />
              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
              )}
            </>
          ) : (
            <>
              {/* Summary */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Meeting Summary</p>
                <p className="text-sm text-slate-700">{result.summary}</p>
              </div>

              {/* Task list with checkboxes */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
                    Extracted Tasks ({result.tasks.length})
                  </p>
                  <button
                    type="button"
                    onClick={toggleAll}
                    className="text-xs text-slate-500 hover:text-slate-700"
                  >
                    {selected.size === result.tasks.length ? 'Deselect all' : 'Select all'}
                  </button>
                </div>

                {result.tasks.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">No actionable tasks found in the notes.</p>
                ) : (
                  <div className="space-y-2">
                    {result.tasks.map((task, i) => (
                      <label
                        key={i}
                        className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                          selected.has(i)
                            ? 'border-slate-300 bg-white'
                            : 'border-slate-100 bg-slate-50 opacity-60'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selected.has(i)}
                          onChange={() => toggleTask(i)}
                          className="mt-0.5 rounded border-slate-300"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800">{task.title}</p>
                          {task.description && (
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{task.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5">
                            {task.priority && (
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${priorityStyles[task.priority] ?? 'bg-slate-100 text-slate-500'}`}>
                                {task.priority}
                              </span>
                            )}
                            {task.assigneeName && (
                              <span className="text-[10px] text-slate-400">
                                {task.assigneeName}
                              </span>
                            )}
                          </div>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">{error}</div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-slate-100 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
          >
            Cancel
          </button>
          {!result ? (
            <button
              type="button"
              onClick={handleExtract}
              disabled={loading || !notes.trim()}
              className="px-4 py-1.5 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Extracting...' : 'Extract Tasks'}
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => { setResult(null); setError(null); }}
                className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || selected.size === 0}
                className="px-4 py-1.5 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {creating ? 'Creating...' : `Create ${selected.size} Task${selected.size !== 1 ? 's' : ''}`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
