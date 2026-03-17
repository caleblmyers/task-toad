import { useState, useEffect } from 'react';
import type { TaskPlanPreview } from '../types';
import Modal from './shared/Modal';
import Button from './shared/Button';
import Badge from './shared/Badge';

const PRIORITY_VARIANT: Record<string, 'danger' | 'accent' | 'info' | 'neutral'> = {
  critical: 'danger',
  high: 'accent',
  medium: 'info',
  low: 'neutral',
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
      <div className="w-8 h-8 border-2 border-slate-300 border-t-brand-green rounded-full animate-spin" />
      <div className="w-full max-w-xs space-y-3">
        {PROGRESS_STEPS.map((label, i) => (
          <div key={i} className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-medium transition-colors duration-300 ${
              i < step ? 'bg-green-500 text-white' :
              i === step ? 'bg-brand-green text-white' :
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
  const priorityVar = PRIORITY_VARIANT[task.priority] ?? 'info';

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
            <Badge variant={priorityVar} size="sm">
              {task.priority}
            </Badge>
            {task.estimatedHours != null && (
              <Badge variant="neutral" size="sm">
                ~{formatHours(task.estimatedHours)}
              </Badge>
            )}
          </div>

          <p className="text-sm text-slate-600 mt-1 leading-snug">{task.description}</p>

          {task.dependsOn.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              <span className="text-xs text-slate-400">Depends on:</span>
              {task.dependsOn.map((dep) => (
                <Badge key={dep} variant="warning" size="sm">
                  {dep}
                </Badge>
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
  const [rejectionCount, setRejectionCount] = useState(0);
  const [showContextInput, setShowContextInput] = useState(false);
  const MAX_REJECTIONS = 3;
  const [refinements, setRefinements] = useState<string[]>([]);
  const [refinementText, setRefinementText] = useState('');
  const [refineOpen, setRefineOpen] = useState(false);

  // Sync selection when tasks list changes (redo/add-more)
  const prevTitles = tasks.map((t) => t.title).join('|');
  const [lastTitles, setLastTitles] = useState(prevTitles);
  if (prevTitles !== lastTitles) {
    setLastTitles(prevTitles);
    setSelected(new Set(tasks.map((t) => t.title)));
    setRejectionCount(0);
    setShowContextInput(false);
    setRefinements([]);
    setRefinementText('');
    setRefineOpen(false);
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
    const nextCount = rejectionCount + 1;
    setRejectionCount(nextCount);
    if (nextCount >= MAX_REJECTIONS) {
      setShowContextInput(true);
      return;
    }
    onRedo(context);
    setContext('');
  };

  const buildRefinementContext = (baseContext: string, extraRefinements: string[] = refinements): string => {
    if (extraRefinements.length === 0) return baseContext;
    const history = extraRefinements.map((r, i) => `Refinement ${i + 1}: ${r}`).join('\n');
    return baseContext ? `${baseContext}\n\n${history}` : history;
  };

  const handleRetryWithContext = () => {
    onRedo(buildRefinementContext(context));
    setContext('');
    setRejectionCount(0);
    setShowContextInput(false);
    setRefinements([]);
  };

  const handleAddMore = () => {
    onAddMore(buildRefinementContext(context));
    setContext('');
  };

  const handleRefineAndRegenerate = () => {
    if (!refinementText.trim()) return;
    const updatedRefinements = [...refinements, refinementText.trim()];
    setRefinements(updatedRefinements);
    const combinedContext = buildRefinementContext(context, updatedRefinements);
    onRedo(combinedContext);
    setRefinementText('');
    setRefineOpen(false);
  };

  return (
    <Modal isOpen={true} onClose={onCancel} title="Review Task Plan" size="lg" variant="top-aligned">
      {/* Header */}
      <div className="flex items-start justify-between p-6 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Review Task Plan</h2>
          {!loading && !error && (
            <p className="text-sm text-slate-500 mt-0.5">
              {tasks.length} task{tasks.length !== 1 ? 's' : ''} generated based on project scope — deselect any you don&apos;t want, or use &lsquo;+ Add more&rsquo; below
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

          {/* Refine section */}
          <div className="border border-slate-200 rounded-lg">
            <button
              type="button"
              onClick={() => setRefineOpen(!refineOpen)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-50 rounded-lg"
            >
              <span className="flex items-center gap-1.5">
                <span>{refineOpen ? '▾' : '▸'}</span>
                <span>Refine</span>
                {refinements.length > 0 && (
                  <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded-full font-medium">
                    {refinements.length}
                  </span>
                )}
              </span>
            </button>
            {refineOpen && (
              <div className="px-3 pb-3 space-y-2">
                <textarea
                  value={refinementText}
                  onChange={(e) => setRefinementText(e.target.value)}
                  placeholder="e.g. Split the auth task into smaller pieces, add a testing task..."
                  className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green resize-none"
                  rows={2}
                />
                <div className="flex justify-end">
                  <Button size="sm" disabled={!refinementText.trim()} onClick={handleRefineAndRegenerate} className="font-medium rounded-lg">
                    Regenerate with feedback
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-slate-200 space-y-3">
        {/* Refine controls */}
        {showContextInput ? (
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              You&apos;ve rejected multiple plans. Try providing more specific context to get better results.
            </p>
            <textarea
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Describe what you're looking for in more detail…"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green resize-none"
              rows={3}
            />
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={onCancel}>
                Cancel
              </Button>
              <Button size="sm" disabled={!context.trim()} onClick={handleRetryWithContext} className="font-medium rounded-lg px-4">
                Try with context →
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <input
              type="text"
              value={context}
              onChange={(e) => setContext(e.target.value)}
              placeholder="Add context to redo or add more tasks…"
              className="flex-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green disabled:bg-slate-50 disabled:text-slate-400"
              disabled={loading}
              onKeyDown={(e) => { if (e.key === 'Enter' && e.metaKey && !loading) handleRedo(); }}
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRedo}
              disabled={loading}
              aria-label="Redo task generation"
              className="rounded-lg whitespace-nowrap"
            >
              ↺ Redo
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleAddMore}
              disabled={loading}
              aria-label="Add more tasks"
              className="rounded-lg whitespace-nowrap"
            >
              + Add more
            </Button>
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-500">
            {loading ? 'Generating…' : `${selectedCount} of ${tasks.length} task${tasks.length !== 1 ? 's' : ''} selected`}
          </span>
          <div className="flex gap-3">
            <Button variant="ghost" onClick={onCancel} disabled={loading}>
              Cancel
            </Button>
            <Button size="lg" disabled={selectedCount === 0 || loading} onClick={() => onApprove(selectedTasks)} className="font-medium rounded-lg">
              Approve & create {selectedCount} task{selectedCount !== 1 ? 's' : ''} →
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
