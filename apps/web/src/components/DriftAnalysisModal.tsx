import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import { IconClose } from './shared/Icons';
import Modal from './shared/Modal';

interface DriftOutdatedTask { taskId: string; title: string; reason: string }
interface DriftUntrackedWork { description: string; suggestedTaskTitle: string }
interface DriftCompletedButOpen { taskId: string; title: string; evidence: string }

interface DriftAnalysis {
  summary: string;
  outdatedTasks: DriftOutdatedTask[];
  untrackedWork: DriftUntrackedWork[];
  completedButOpen: DriftCompletedButOpen[];
}

interface DriftAnalysisModalProps {
  projectId: string;
  onMarkDone?: (taskId: string) => void;
  onCreateTask?: (title: string) => void;
  onClose: () => void;
}

export default function DriftAnalysisModal({ projectId, onMarkDone, onCreateTask, onClose }: DriftAnalysisModalProps) {
  const [analysis, setAnalysis] = useState<DriftAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await gql<{ analyzeRepoDrift: DriftAnalysis }>(
          `query AnalyzeDrift($projectId: ID!) {
            analyzeRepoDrift(projectId: $projectId) {
              summary
              outdatedTasks { taskId title reason }
              untrackedWork { description suggestedTaskTitle }
              completedButOpen { taskId title evidence }
            }
          }`,
          { projectId }
        );
        setAnalysis(data.analyzeRepoDrift);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to analyze drift');
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [projectId]);

  return (
    <Modal isOpen={true} onClose={onClose} title="Repo Drift Analysis" size="md">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
        <h2 className="text-base font-semibold text-slate-800">Repo Drift Analysis</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
          <IconClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <p className="text-sm text-slate-500">Analyzing repo activity vs task board...</p>
          </div>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : analysis ? (
          <>
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm text-slate-700">{analysis.summary}</p>
            </div>

            {analysis.completedButOpen.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-green-700 mb-2">Completed But Still Open ({analysis.completedButOpen.length})</h3>
                <div className="space-y-2">
                  {analysis.completedButOpen.map((t) => (
                    <div key={t.taskId} className="flex items-start justify-between gap-2 p-2 bg-green-50 rounded">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700">{t.title}</p>
                        <p className="text-xs text-slate-500">{t.evidence}</p>
                      </div>
                      {onMarkDone && (
                        <button
                          onClick={() => onMarkDone(t.taskId)}
                          className="text-xs text-green-600 hover:text-green-800 flex-shrink-0 px-2 py-1 border border-green-200 rounded"
                        >
                          Mark Done
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.untrackedWork.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-amber-700 mb-2">Untracked Work ({analysis.untrackedWork.length})</h3>
                <div className="space-y-2">
                  {analysis.untrackedWork.map((w, i) => (
                    <div key={i} className="flex items-start justify-between gap-2 p-2 bg-amber-50 rounded">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-700">{w.suggestedTaskTitle}</p>
                        <p className="text-xs text-slate-500">{w.description}</p>
                      </div>
                      {onCreateTask && (
                        <button
                          onClick={() => onCreateTask(w.suggestedTaskTitle)}
                          className="text-xs text-amber-600 hover:text-amber-800 flex-shrink-0 px-2 py-1 border border-amber-200 rounded"
                        >
                          Create Task
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.outdatedTasks.length > 0 && (
              <div>
                <h3 className="text-sm font-medium text-slate-700 mb-2">Outdated Tasks ({analysis.outdatedTasks.length})</h3>
                <div className="space-y-2">
                  {analysis.outdatedTasks.map((t) => (
                    <div key={t.taskId} className="p-2 bg-slate-50 rounded">
                      <p className="text-sm font-medium text-slate-700">{t.title}</p>
                      <p className="text-xs text-slate-500">{t.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {analysis.outdatedTasks.length === 0 && analysis.untrackedWork.length === 0 && analysis.completedButOpen.length === 0 && (
              <p className="text-sm text-slate-500 text-center py-4">No drift detected — your task board is in sync with the repo.</p>
            )}
          </>
        ) : null}
      </div>

      <div className="flex items-center justify-end px-5 py-3 border-t border-slate-100 flex-shrink-0">
        <button onClick={onClose} className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800">
          Close
        </button>
      </div>
    </Modal>
  );
}
