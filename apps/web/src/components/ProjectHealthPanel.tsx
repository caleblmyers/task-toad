import { gql } from '../api/client';
import { ANALYZE_PROJECT_HEALTH_QUERY } from '../api/queries';
import useAsyncData from '../hooks/useAsyncData';
import { IconClose } from './shared/Icons';
import Badge from './shared/Badge';

interface HealthIssue {
  title: string;
  severity: string;
  description: string;
}

interface ProjectHealth {
  healthScore: number;
  status: string;
  issues: HealthIssue[];
  strengths: string[];
  actionItems: string[];
}

interface Props {
  projectId: string;
  disabled?: boolean;
  onClose: () => void;
}

const statusVariant: Record<string, 'success' | 'warning' | 'danger'> = {
  healthy: 'success',
  'at-risk': 'warning',
  critical: 'danger',
};

const severityVariant: Record<string, 'danger' | 'warning' | 'neutral'> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

function scoreColor(score: number): string {
  if (score >= 80) return 'text-emerald-600';
  if (score >= 50) return 'text-amber-600';
  return 'text-red-600';
}

function scoreTrackColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 50) return 'bg-amber-500';
  return 'bg-red-500';
}

export default function ProjectHealthPanel({ projectId, disabled, onClose }: Props) {
  const { data: health, loading, error, retry } = useAsyncData(
    () =>
      disabled
        ? Promise.resolve(null)
        : gql<{ analyzeProjectHealth: ProjectHealth }>(
            ANALYZE_PROJECT_HEALTH_QUERY,
            { projectId },
          ).then((d) => d.analyzeProjectHealth),
    [projectId, disabled],
  );

  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Project Health</p>
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
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-slate-200 rounded-full animate-pulse" />
              <div className="space-y-2 flex-1">
                <div className="h-4 w-20 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
              </div>
            </div>
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 rounded-lg p-3">
            {error}
            <button onClick={retry} className="ml-2 text-red-500 underline hover:text-red-700">Retry</button>
          </div>
        )}

        {health && (
          <div className="space-y-5">
            {/* Score + Status */}
            <div className="flex items-center gap-4">
              <div className="relative w-16 h-16">
                <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                  <circle cx="18" cy="18" r="15.9" fill="none" stroke="#e2e8f0" strokeWidth="3" />
                  <circle
                    cx="18" cy="18" r="15.9" fill="none"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeDasharray={`${health.healthScore} ${100 - health.healthScore}`}
                    className={scoreColor(health.healthScore)}
                  />
                </svg>
                <span className={`absolute inset-0 flex items-center justify-center text-lg font-bold ${scoreColor(health.healthScore)}`}>
                  {health.healthScore}
                </span>
              </div>
              <div>
                <Badge variant={statusVariant[health.status] ?? 'neutral'} size="sm" className="font-semibold">
                  {health.status}
                </Badge>
                <div className="mt-1.5 h-1.5 w-32 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${scoreTrackColor(health.healthScore)}`}
                    style={{ width: `${health.healthScore}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Issues */}
            {health.issues.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Issues</h3>
                <div className="space-y-2">
                  {health.issues.map((issue, i) => (
                    <div key={i} className="bg-slate-50 rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={severityVariant[issue.severity] ?? 'neutral'} size="sm" className="font-semibold">
                          {issue.severity}
                        </Badge>
                        <span className="text-sm font-medium text-slate-700">{issue.title}</span>
                      </div>
                      <p className="text-xs text-slate-500">{issue.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Strengths */}
            {health.strengths.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">Strengths</h3>
                <ul className="space-y-1">
                  {health.strengths.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-emerald-300">{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Action Items */}
            {health.actionItems.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1.5">Action Items</h3>
                <ul className="space-y-1">
                  {health.actionItems.map((item, i) => (
                    <li key={i} className="text-sm text-slate-700 pl-3 border-l-2 border-blue-300">{item}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
