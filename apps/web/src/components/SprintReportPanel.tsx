import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import { SPRINT_TIME_SUMMARY_QUERY, GENERATE_SPRINT_REPORT_QUERY } from '../api/queries';
import { IconClose } from './shared/Icons';
import Modal from './shared/Modal';
import type { SprintTimeSummary } from '@tasktoad/shared-types';

interface SprintReport {
  summary: string;
  completionRate: number;
  highlights: string[];
  concerns: string[];
  recommendations: string[];
}

interface Props {
  projectId: string;
  sprintId: string;
  sprintName: string;
  onClose: () => void;
}

export default function SprintReportPanel({ projectId, sprintId, sprintName, onClose }: Props) {
  const [report, setReport] = useState<SprintReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ generateSprintReport: SprintReport }>(
        GENERATE_SPRINT_REPORT_QUERY,
        { projectId, sprintId }
      );
      setReport(data.generateSprintReport);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate sprint report');
    } finally {
      setLoading(false);
    }
  };

  const [timeSummary, setTimeSummary] = useState<SprintTimeSummary | null>(null);

  // Auto-generate on mount
  if (!report && !loading && !error) {
    generate();
  }

  // Load sprint time summary
  useEffect(() => {
    gql<{ sprintTimeSummary: SprintTimeSummary }>(SPRINT_TIME_SUMMARY_QUERY, { sprintId })
      .then((data) => setTimeSummary(data.sprintTimeSummary))
      .catch(() => { /* non-critical */ });
  }, [sprintId]);

  const rateColor = (rate: number) => {
    if (rate >= 80) return 'text-emerald-600 bg-emerald-50';
    if (rate >= 50) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={`Sprint Report — ${sprintName}`} size="md">
      <div className="flex items-center justify-between p-4 border-b border-slate-100">
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sprint Report</p>
          <p className="text-sm font-semibold text-slate-800">{sprintName}</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
          <IconClose className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 overflow-y-auto">
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-28 bg-slate-200 rounded animate-pulse" />
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
          <div className="space-y-5">
            {/* Summary */}
            <div>
              <p className="text-sm text-slate-700 leading-relaxed">{report.summary}</p>
            </div>

            {/* Completion Rate */}
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Completion</h3>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${Math.min(100, report.completionRate)}%` }}
                  />
                </div>
                <span className={`text-sm font-semibold px-2 py-0.5 rounded ${rateColor(report.completionRate)}`}>
                  {Math.round(report.completionRate)}%
                </span>
              </div>
            </div>

            {/* Time Tracked */}
            {timeSummary && timeSummary.totalMinutes > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Time Tracked</h3>
                <p className="text-sm text-slate-700 mb-2">
                  Total: <span className="font-semibold">{Math.floor(timeSummary.totalMinutes / 60)}h {timeSummary.totalMinutes % 60}m</span>
                </p>
                {timeSummary.byUser.length > 0 && (
                  <div className="space-y-1">
                    {timeSummary.byUser.map((u) => (
                      <div key={u.userId} className="flex items-center justify-between text-xs text-slate-600">
                        <span>{u.userEmail}</span>
                        <span className="font-medium">{Math.floor(u.totalMinutes / 60)}h {u.totalMinutes % 60}m</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Highlights */}
            {report.highlights.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">Highlights</h3>
                <ul className="space-y-1">
                  {report.highlights.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-emerald-300">{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Concerns */}
            {report.concerns.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Concerns</h3>
                <ul className="space-y-1">
                  {report.concerns.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-amber-300">{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {report.recommendations.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Recommendations</h3>
                <ul className="space-y-1">
                  {report.recommendations.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-blue-300">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
