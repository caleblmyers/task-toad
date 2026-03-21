import { useState } from 'react';
import type { Release, Task } from '../types';
import Button from './shared/Button';
import ReleaseBurndownChart from './ReleaseBurndownChart';

interface ReleaseDetailPanelProps {
  release: Release;
  projectTasks: Task[];
  onUpdate: (releaseId: string, updates: Partial<Pick<Release, 'name' | 'version' | 'description' | 'status' | 'releaseDate' | 'releaseNotes'>>) => Promise<void>;
  onDelete: (releaseId: string) => Promise<void>;
  onAddTask: (releaseId: string, task: Task) => Promise<void>;
  onRemoveTask: (releaseId: string, taskId: string) => Promise<void>;
  onGenerateNotes: (releaseId: string) => Promise<void>;
  onClose: () => void;
}

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  { value: 'scheduled', label: 'Scheduled', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' },
  { value: 'released', label: 'Released', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' },
  { value: 'archived', label: 'Archived', color: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300' },
];

export default function ReleaseDetailPanel({
  release,
  projectTasks,
  onUpdate,
  onDelete,
  onAddTask,
  onRemoveTask,
  onGenerateNotes,
  onClose,
}: ReleaseDetailPanelProps) {
  const [generating, setGenerating] = useState(false);
  const [showTaskPicker, setShowTaskPicker] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const releaseTasks = release.tasks ?? [];
  const releaseTaskIds = new Set(releaseTasks.map((t) => t.taskId));
  const availableTasks = projectTasks.filter((t) => !releaseTaskIds.has(t.taskId));
  const doneTasks = releaseTasks.filter((t) => t.status === 'done');
  const completionPct = releaseTasks.length > 0 ? Math.round((doneTasks.length / releaseTasks.length) * 100) : 0;

  const handleGenerateNotes = async () => {
    setGenerating(true);
    try {
      await onGenerateNotes(release.releaseId);
    } finally {
      setGenerating(false);
    }
  };

  const handleDelete = async () => {
    await onDelete(release.releaseId);
  };

  return (
    <div className="bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 w-full max-w-lg h-full overflow-y-auto">
      <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200 truncate">{release.name}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      <div className="p-4 space-y-4">
        {/* Version & Status */}
        <div className="flex items-center gap-3">
          <span className="px-2 py-0.5 text-xs font-mono font-medium bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded">
            v{release.version}
          </span>
          <select
            value={release.status}
            onChange={(e) => onUpdate(release.releaseId, { status: e.target.value })}
            className="text-sm border border-slate-200 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 dark:text-slate-200"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Description</label>
          <textarea
            defaultValue={release.description ?? ''}
            onBlur={(e) => {
              if (e.target.value !== (release.description ?? '')) {
                onUpdate(release.releaseId, { description: e.target.value });
              }
            }}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
            rows={2}
            placeholder="Release description..."
          />
        </div>

        {/* Release Date */}
        <div>
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Release Date</label>
          <input
            type="date"
            defaultValue={release.releaseDate ?? ''}
            onChange={(e) => onUpdate(release.releaseId, { releaseDate: e.target.value || undefined })}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
          />
        </div>

        {/* Completion */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Completion</span>
            <span className="text-xs text-slate-500 dark:text-slate-400">{doneTasks.length}/{releaseTasks.length} tasks ({completionPct}%)</span>
          </div>
          <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
          </div>
        </div>

        {/* Burndown Chart */}
        {releaseTasks.length > 0 && (
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
            <ReleaseBurndownChart releaseId={release.releaseId} />
          </div>
        )}

        {/* Tasks */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Tasks ({releaseTasks.length})</span>
            <button
              onClick={() => setShowTaskPicker(!showTaskPicker)}
              className="text-xs text-brand-green hover:text-brand-green-hover"
            >
              + Add Task
            </button>
          </div>

          {showTaskPicker && (
            <div className="mb-2 max-h-40 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded-lg">
              {availableTasks.length === 0 ? (
                <p className="text-xs text-slate-400 p-2">No available tasks</p>
              ) : (
                availableTasks.map((task) => (
                  <button
                    key={task.taskId}
                    onClick={() => { onAddTask(release.releaseId, task); setShowTaskPicker(false); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 border-b border-slate-100 dark:border-slate-700 last:border-0"
                  >
                    <span className="text-slate-700 dark:text-slate-300">{task.title}</span>
                    <span className="ml-2 text-xs text-slate-400">{task.status}</span>
                  </button>
                ))
              )}
            </div>
          )}

          <div className="space-y-1">
            {releaseTasks.map((task) => (
              <div key={task.taskId} className="flex items-center justify-between py-1.5 px-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700/50 group">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${task.status === 'done' ? 'bg-green-500' : task.status === 'in_progress' ? 'bg-blue-500' : 'bg-slate-300'}`} />
                  <span className="text-sm text-slate-700 dark:text-slate-300 truncate">{task.title}</span>
                </div>
                <button
                  onClick={() => onRemoveTask(release.releaseId, task.taskId)}
                  className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Release Notes */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Release Notes</span>
            <Button size="sm" variant="secondary" loading={generating} onClick={handleGenerateNotes} disabled={releaseTasks.length === 0}>
              Generate Notes
            </Button>
          </div>
          {release.releaseNotes ? (
            <div className="prose prose-sm dark:prose-invert max-w-none bg-slate-50 dark:bg-slate-900 rounded-lg p-3 text-sm whitespace-pre-wrap">
              {release.releaseNotes}
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic">No release notes yet. Add tasks and click &ldquo;Generate Notes&rdquo;.</p>
          )}
        </div>

        {/* Delete */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-sm text-red-600">Delete this release?</span>
              <Button size="sm" variant="danger" onClick={handleDelete}>Confirm</Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
            </div>
          ) : (
            <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>Delete Release</Button>
          )}
        </div>
      </div>
    </div>
  );
}
