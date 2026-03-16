import { useState } from 'react';
import { IconClose } from './shared/Icons';
import Modal from './shared/Modal';
import Button from './shared/Button';

interface PRDTask {
  title: string;
  description: string;
  priority: string;
  estimatedHours?: number | null;
  acceptanceCriteria?: string | null;
}

interface PRDEpic {
  title: string;
  description: string;
  tasks: PRDTask[];
}

interface PRDBreakdownModalProps {
  onPreview: (prd: string) => Promise<{ epics: PRDEpic[] }>;
  onCommit: (epics: string) => Promise<void>;
  onClose: () => void;
}

export default function PRDBreakdownModal({ onPreview, onCommit, onClose }: PRDBreakdownModalProps) {
  const [prd, setPrd] = useState('');
  const [preview, setPreview] = useState<{ epics: PRDEpic[] } | null>(null);
  const [expandedEpics, setExpandedEpics] = useState<Set<number>>(new Set());
  const [analyzing, setAnalyzing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!prd.trim()) return;
    setAnalyzing(true);
    setError(null);
    try {
      const result = await onPreview(prd);
      setPreview(result);
      setExpandedEpics(new Set(result.epics.map((_, i) => i)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze PRD');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCommit = async () => {
    if (!preview) return;
    setCommitting(true);
    setError(null);
    try {
      await onCommit(JSON.stringify(preview.epics));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tasks');
    } finally {
      setCommitting(false);
    }
  };

  const toggleEpic = (index: number) => {
    setExpandedEpics((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const priorityColor = (p: string) => {
    switch (p) {
      case 'critical': return 'text-red-700 bg-red-50';
      case 'high': return 'text-orange-700 bg-orange-50';
      case 'medium': return 'text-yellow-700 bg-yellow-50';
      default: return 'text-slate-600 bg-slate-50';
    }
  };

  const loading = analyzing || committing;

  return (
    <Modal isOpen={true} onClose={onClose} title="PRD Breakdown" size="md">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
        <h2 className="text-base font-semibold text-slate-800">PRD Breakdown</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
          <IconClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!preview ? (
          <>
            <textarea
              value={prd}
              onChange={(e) => setPrd(e.target.value)}
              placeholder="Paste your Product Requirements Document here..."
              rows={12}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-brand-green"
              disabled={loading}
              autoFocus
            />
          </>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              {preview.epics.length} epic{preview.epics.length !== 1 ? 's' : ''} with{' '}
              {preview.epics.reduce((sum, e) => sum + e.tasks.length, 0)} tasks total
            </p>
            {preview.epics.map((epic, i) => (
              <div key={i} className="border border-slate-200 rounded-lg">
                <button
                  onClick={() => toggleEpic(i)}
                  className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-slate-50"
                >
                  <div>
                    <span className="text-sm font-medium text-slate-800">{epic.title}</span>
                    <span className="ml-2 text-xs text-slate-400">{epic.tasks.length} tasks</span>
                  </div>
                  <span className="text-slate-400 text-xs">{expandedEpics.has(i) ? '▼' : '▶'}</span>
                </button>
                {expandedEpics.has(i) && (
                  <div className="border-t border-slate-100 px-4 py-2 space-y-2">
                    <p className="text-xs text-slate-500">{epic.description}</p>
                    {epic.tasks.map((task, j) => (
                      <div key={j} className="flex items-start gap-2 py-1.5 border-t border-slate-50 first:border-0">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${priorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-slate-700">{task.title}</p>
                          <p className="text-xs text-slate-400 truncate">{task.description}</p>
                        </div>
                        {task.estimatedHours != null && (
                          <span className="text-[10px] text-slate-400 flex-shrink-0">{task.estimatedHours}h</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 flex-shrink-0">
        <div>
          {preview && (
            <button
              onClick={() => { setPreview(null); setError(null); }}
              className="text-sm text-slate-500 hover:text-slate-700"
              disabled={loading}
            >
              Back to edit
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
            disabled={loading}
          >
            Cancel
          </button>
          {!preview ? (
            <Button size="sm" onClick={handleAnalyze} disabled={loading || !prd.trim()} className="rounded-lg">
              {analyzing ? 'Analyzing...' : 'Analyze PRD'}
            </Button>
          ) : (
            <Button size="sm" onClick={handleCommit} disabled={loading} className="rounded-lg">
              {committing ? 'Creating...' : 'Create Tasks'}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
