import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import { IconClose } from './shared/Icons';

interface StandupReport {
  completed: string[];
  inProgress: string[];
  blockers: string[];
  summary: string;
}

interface Props {
  projectId: string;
  disabled?: boolean;
  onClose: () => void;
}

export default function StandupReportPanel({ projectId, disabled, onClose }: Props) {
  const [report, setReport] = useState<StandupReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ generateStandupReport: StandupReport }>(
        `query GenerateStandup($projectId: ID!) {
          generateStandupReport(projectId: $projectId) {
            completed inProgress blockers summary
          }
        }`,
        { projectId }
      );
      setReport(data.generateStandupReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate standup report');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!disabled) generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Daily Standup</p>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            <IconClose className="w-3 h-3" /> Dismiss
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                <div className="h-3 w-3/4 bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
            {error}
            <button onClick={generate} className="ml-2 text-red-500 underline hover:text-red-700">Retry</button>
          </div>
        )}

        {report && (
          <div className="space-y-4">
            <div>
              <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">Completed</h3>
              {report.completed.length > 0 ? (
                <ul className="space-y-1">
                  {report.completed.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-emerald-300">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic">No completed items</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">In Progress</h3>
              {report.inProgress.length > 0 ? (
                <ul className="space-y-1">
                  {report.inProgress.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-blue-300">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic">No items in progress</p>
              )}
            </div>

            <div>
              <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Blockers</h3>
              {report.blockers.length > 0 ? (
                <ul className="space-y-1">
                  {report.blockers.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-amber-300">{item}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-slate-400 italic">No blockers</p>
              )}
            </div>

            <div className="pt-2 border-t border-slate-100">
              <p className="text-sm text-slate-600 leading-relaxed">{report.summary}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
