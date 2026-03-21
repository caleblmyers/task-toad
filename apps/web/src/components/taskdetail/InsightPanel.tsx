import { useEffect, useState, useCallback } from 'react';
import { gql } from '../../api/client';
import Badge from '../shared/Badge';
import { TASK_INSIGHTS_QUERY, DISMISS_INSIGHT_MUTATION } from '../../api/queries';

interface TaskInsight {
  taskInsightId: string;
  sourceTaskId: string;
  targetTaskId: string | null;
  type: string;
  content: string;
  autoApplied: boolean;
  createdAt: string;
  sourceTask: { taskId: string; title: string } | null;
  targetTask: { taskId: string; title: string } | null;
}

const TYPE_BADGES: Record<string, { label: string; variant: 'info' | 'warning' | 'purple' }> = {
  discovery: { label: 'Discovery', variant: 'info' },
  warning: { label: 'Warning', variant: 'warning' },
  pattern: { label: 'Pattern', variant: 'purple' },
};

function relativeTime(isoString: string): string {
  const now = Date.now();
  const then = new Date(isoString).getTime();
  const diffMs = now - then;
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface Props {
  projectId: string;
  taskId: string;
  initialInsights?: TaskInsight[];
  onApplyInsight?: (insight: TaskInsight) => void;
}

export type { TaskInsight };

export default function InsightPanel({ projectId, taskId, initialInsights, onApplyInsight }: Props) {
  const [insights, setInsights] = useState<TaskInsight[]>(initialInsights ?? []);
  const [loading, setLoading] = useState(!initialInsights);

  const fetchInsights = useCallback(() => {
    setLoading(true);
    gql<{ taskInsights: TaskInsight[] }>(TASK_INSIGHTS_QUERY, { projectId, taskId })
      .then((data) => setInsights(data.taskInsights))
      .catch(() => {/* non-critical */})
      .finally(() => setLoading(false));
  }, [projectId, taskId]);

  useEffect(() => {
    if (!initialInsights) {
      fetchInsights();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, taskId]);

  const handleDismiss = (taskInsightId: string) => {
    gql<{ dismissInsight: boolean }>(DISMISS_INSIGHT_MUTATION, { taskInsightId })
      .then(() => {
        setInsights((prev) => prev.filter((i) => i.taskInsightId !== taskInsightId));
      })
      .catch(() => {/* non-critical */});
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <svg className="animate-spin h-5 w-5 text-slate-400" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="text-sm text-slate-400 py-6 text-center">
        No insights generated yet. Insights appear after auto-complete generates code for related tasks.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {insights.map((insight) => {
        const badge = TYPE_BADGES[insight.type] ?? { label: insight.type, variant: 'info' as const };

        return (
          <div
            key={insight.taskInsightId}
            className="group border border-slate-200 dark:border-slate-700 rounded-lg p-3"
          >
            <div className="flex items-start gap-2">
              <Badge variant={badge.variant} size="sm">
                {badge.label}
              </Badge>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-700 dark:text-slate-300">{insight.content}</p>
                <div className="flex items-center gap-3 mt-1.5">
                  {insight.sourceTask && (
                    <span className="text-[10px] text-slate-400">
                      From: {insight.sourceTask.title}
                    </span>
                  )}
                  {insight.targetTask && (
                    <span className="text-[10px] text-slate-400">
                      For: {insight.targetTask.title}
                    </span>
                  )}
                  <span className="text-[10px] text-slate-400">{relativeTime(insight.createdAt)}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {onApplyInsight && (
                  <button
                    type="button"
                    onClick={() => onApplyInsight(insight)}
                    className="px-2 py-1 text-xs font-medium text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded"
                  >
                    Apply
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleDismiss(insight.taskInsightId)}
                  className="px-2 py-1 text-xs font-medium text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
