import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import { IconClose } from './shared/Icons';
import Modal from './shared/Modal';

interface TransitionTask {
  taskId: string;
  reason: string;
}

interface SprintTransitionAnalysis {
  summary: string;
  carryOver: TransitionTask[];
  deprioritize: TransitionTask[];
  recommendations: string[];
}

interface SprintTransitionModalProps {
  sprintId: string;
  sprintName: string;
  onApply: (carryOverTaskIds: string[], deprioritizeTaskIds: string[]) => Promise<void>;
  onClose: () => void;
}

export default function SprintTransitionModal({ sprintId, sprintName, onApply, onClose }: SprintTransitionModalProps) {
  const [analysis, setAnalysis] = useState<SprintTransitionAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCarryOver, setSelectedCarryOver] = useState<Set<string>>(new Set());
  const [selectedDeprioritize, setSelectedDeprioritize] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAnalysis = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await gql<{ analyzeSprintTransition: SprintTransitionAnalysis }>(
          `query AnalyzeTransition($sprintId: ID!) {
            analyzeSprintTransition(sprintId: $sprintId) {
              summary carryOver { taskId reason } deprioritize { taskId reason } recommendations
            }
          }`,
          { sprintId }
        );
        setAnalysis(data.analyzeSprintTransition);
        setSelectedCarryOver(new Set(data.analyzeSprintTransition.carryOver.map((t) => t.taskId)));
        setSelectedDeprioritize(new Set(data.analyzeSprintTransition.deprioritize.map((t) => t.taskId)));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to analyze sprint');
      } finally {
        setLoading(false);
      }
    };
    fetchAnalysis();
  }, [sprintId]);

  const toggleCarryOver = (taskId: string) => {
    setSelectedCarryOver((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const toggleDeprioritize = (taskId: string) => {
    setSelectedDeprioritize((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleApply = async () => {
    setApplying(true);
    try {
      await onApply([...selectedCarryOver], [...selectedDeprioritize]);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply transition');
    } finally {
      setApplying(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Sprint Transition: ${sprintName}`} size="md">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-600 flex-shrink-0">
        <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">Sprint Transition: {sprintName}</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300" aria-label="Close">
          <IconClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-slate-500 dark:text-slate-400">Analyzing sprint...</div>
          </div>
        ) : error ? (
          <div className="text-sm text-red-600">{error}</div>
        ) : analysis ? (
          <>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3">
              <p className="text-sm text-slate-700 dark:text-slate-300">{analysis.summary}</p>
            </div>

            {analysis.carryOver.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Carry Over to Next Sprint</h3>
                <div className="space-y-1.5">
                  {analysis.carryOver.map((t) => (
                    <label key={t.taskId} className="flex items-start gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedCarryOver.has(t.taskId)}
                        onChange={() => toggleCarryOver(t.taskId)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{t.taskId}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.reason}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {analysis.deprioritize.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Deprioritize to Backlog</h3>
                <div className="space-y-1.5">
                  {analysis.deprioritize.map((t) => (
                    <label key={t.taskId} className="flex items-start gap-2 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedDeprioritize.has(t.taskId)}
                        onChange={() => toggleDeprioritize(t.taskId)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-700 dark:text-slate-300 font-medium">{t.taskId}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.reason}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {analysis.recommendations.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Recommendations</h3>
                <ul className="list-disc list-inside space-y-1">
                  {analysis.recommendations.map((r, i) => (
                    <li key={i} className="text-sm text-slate-600 dark:text-slate-400">{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-700 flex-shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-300 dark:hover:text-slate-200"
          disabled={applying}
        >
          Cancel
        </button>
        <button
          onClick={handleApply}
          disabled={loading || applying || !analysis}
          className="px-4 py-1.5 text-sm bg-brand-green text-white rounded-lg hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {applying ? 'Applying...' : 'Apply Transition'}
        </button>
      </div>
    </Modal>
  );
}
