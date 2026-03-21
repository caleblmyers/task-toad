import { useState, useEffect, useCallback } from 'react';
import { gql } from '../api/client';
import { PROJECT_ACTION_PLANS_QUERY, EXECUTE_ACTION_PLAN_MUTATION, CANCEL_ACTION_PLAN_MUTATION } from '../api/queries';
import { useSSEListener } from '../hooks/useEventSource';
import type { TaskActionPlan, TaskActionType } from '../types';

interface PlanDependency {
  taskId: string;
  title: string;
  linkType: string;
}

interface ActionPlanWithTask extends TaskActionPlan {
  task?: {
    taskId: string;
    title: string;
    status: string;
    taskType: string | null;
    autoComplete: boolean;
    parentTaskTitle: string | null;
    blockedBy?: PlanDependency[];
  } | null;
}

const STATUS_ICONS: Record<string, string> = {
  pending: '\u25CB',
  executing: '\u25D4',
  completed: '\u2714',
  failed: '\u2718',
  skipped: '\u2500',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-slate-400',
  executing: 'text-blue-500 animate-pulse',
  completed: 'text-green-600',
  failed: 'text-red-500',
  skipped: 'text-slate-300',
};

const PLAN_STATUS_BADGE: Record<string, string> = {
  executing: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  approved: 'bg-slate-100 text-slate-600',
  draft: 'bg-slate-100 text-slate-500',
  cancelled: 'bg-slate-100 text-slate-400',
};

type FilterStatus = 'all' | 'executing' | 'completed' | 'failed';

const SSE_REFRESH_EVENTS = [
  'task.action_completed',
  'task.action_plan_completed',
  'task.action_plan_failed',
  'task.blocked',
  'task.unblocked',
] as const;

function formatElapsed(startedAt: string, completedAt?: string | null): string {
  const start = new Date(startedAt).getTime();
  const end = completedAt ? new Date(completedAt).getTime() : Date.now();
  const diffMs = end - start;
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">{value}</p>
    </div>
  );
}

function ActionStep({ action }: { action: TaskActionType }) {
  return (
    <div className="flex items-center gap-2 py-1">
      <span className={`text-sm ${STATUS_COLORS[action.status] ?? 'text-slate-400'}`}>
        {STATUS_ICONS[action.status] ?? '\u25CB'}
      </span>
      <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{action.label}</span>
      <span className="text-xs text-slate-400 ml-auto flex-shrink-0">{action.actionType.replace('_', ' ')}</span>
    </div>
  );
}

function PlanCard({ plan, onRetry, onCancel }: {
  plan: ActionPlanWithTask;
  onRetry: (planId: string) => Promise<void>;
  onCancel: (planId: string) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [acting, setActing] = useState(false);
  const completedCount = plan.actions.filter((a) => a.status === 'completed').length;
  const totalCount = plan.actions.length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const firstActionStarted = plan.actions.find((a) => a.startedAt)?.startedAt;
  const lastActionCompleted = plan.status === 'completed'
    ? plan.actions.filter((a) => a.completedAt).sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime())[0]?.completedAt
    : null;

  const isFailed = plan.status === 'failed';
  const isExecuting = plan.status === 'executing';

  const handleRetry = async () => {
    setActing(true);
    try { await onRetry(plan.id); } finally { setActing(false); }
  };
  const handleCancel = async () => {
    setActing(true);
    try { await onCancel(plan.id); } finally { setActing(false); }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
            {plan.task?.title ?? `Task ${plan.taskId.slice(0, 8)}`}
          </p>
          {plan.task?.parentTaskTitle && (
            <p className="text-xs text-slate-400 mt-0.5 truncate">{plan.task.parentTaskTitle}</p>
          )}
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${PLAN_STATUS_BADGE[plan.status] ?? 'bg-slate-100 text-slate-600'}`}>
          {plan.status}
        </span>
      </div>

      {/* Dependency badges */}
      {plan.task?.blockedBy && plan.task.blockedBy.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {plan.task.blockedBy.map((dep) => (
            <span
              key={dep.taskId}
              className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200 dark:border-amber-800"
              title={`${dep.linkType}: ${dep.title}`}
            >
              Blocked by: {dep.title.length > 30 ? dep.title.slice(0, 30) + '…' : dep.title}
            </span>
          ))}
        </div>
      )}

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>{completedCount}/{totalCount} actions</span>
          {firstActionStarted && (
            <span>{formatElapsed(firstActionStarted, lastActionCompleted)}</span>
          )}
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
          <div
            className={`rounded-full h-1.5 transition-all ${
              plan.status === 'failed' ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Controls row */}
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          {expanded ? 'Hide steps' : 'Show steps'}
        </button>
        <div className="flex-1" />
        {isFailed && (
          <button
            onClick={handleRetry}
            disabled={acting}
            className="text-xs px-2.5 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
          >
            Retry
          </button>
        )}
        {isExecuting && (
          <button
            onClick={handleCancel}
            disabled={acting}
            className="text-xs px-2.5 py-1 border border-red-200 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
          >
            Cancel
          </button>
        )}
      </div>

      {expanded && (
        <div className="mt-2 space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-2">
          {plan.actions.map((action) => (
            <ActionStep key={action.id} action={action} />
          ))}
        </div>
      )}
    </div>
  );
}

interface ExecutionDashboardProps {
  projectId: string;
  onClose: () => void;
}

export default function ExecutionDashboard({ projectId, onClose }: ExecutionDashboardProps) {
  const [plans, setPlans] = useState<ActionPlanWithTask[]>([]);
  const [allPlans, setAllPlans] = useState<ActionPlanWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');

  // Fetch filtered plans for the list
  const fetchPlans = useCallback(async () => {
    try {
      const statusParam = filter === 'all' ? undefined : filter;
      const data = await gql<{ projectActionPlans: ActionPlanWithTask[] }>(
        PROJECT_ACTION_PLANS_QUERY,
        { projectId, status: statusParam },
      );
      setPlans(data.projectActionPlans);
    } catch {
      // silently fail — dashboard is supplementary
    } finally {
      setLoading(false);
    }
  }, [projectId, filter]);

  // Fetch all plans (unfiltered) for stat card counts
  const fetchAllPlans = useCallback(async () => {
    try {
      const data = await gql<{ projectActionPlans: ActionPlanWithTask[] }>(
        PROJECT_ACTION_PLANS_QUERY,
        { projectId },
      );
      setAllPlans(data.projectActionPlans);
    } catch {
      // silently fail
    }
  }, [projectId]);

  useEffect(() => {
    setLoading(true);
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    fetchAllPlans();
  }, [fetchAllPlans]);

  // SSE: auto-refresh on action plan events
  useSSEListener(SSE_REFRESH_EVENTS, useCallback(() => {
    void fetchPlans();
    void fetchAllPlans();
  }, [fetchPlans, fetchAllPlans]));

  const handleRetry = useCallback(async (planId: string) => {
    await gql<{ executeActionPlan: TaskActionPlan }>(
      EXECUTE_ACTION_PLAN_MUTATION,
      { planId },
    );
    void fetchPlans();
    void fetchAllPlans();
  }, [fetchPlans, fetchAllPlans]);

  const handleCancel = useCallback(async (planId: string) => {
    await gql<{ cancelActionPlan: TaskActionPlan }>(
      CANCEL_ACTION_PLAN_MUTATION,
      { planId },
    );
    void fetchPlans();
    void fetchAllPlans();
  }, [fetchPlans, fetchAllPlans]);

  // Stat card counts always come from the unfiltered list
  const executingCount = allPlans.filter((p) => p.status === 'executing').length;
  const queuedCount = allPlans.filter((p) => p.status === 'approved' || p.status === 'draft').length;
  const completedCount = allPlans.filter((p) => p.status === 'completed').length;
  const failedCount = allPlans.filter((p) => p.status === 'failed').length;

  const filters: Array<{ label: string; value: FilterStatus }> = [
    { label: 'All', value: 'all' },
    { label: 'Executing', value: 'executing' },
    { label: 'Completed', value: 'completed' },
    { label: 'Failed', value: 'failed' },
  ];

  return (
    <div className="max-w-4xl mx-auto py-6 px-4 overflow-y-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Execution Dashboard</h2>
        <button
          onClick={onClose}
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          Close
        </button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard label="Executing" value={executingCount} />
        <StatCard label="Queued" value={queuedCount} />
        <StatCard label="Completed" value={completedCount} />
        <StatCard label="Failed" value={failedCount} />
      </div>

      {/* Filter buttons */}
      <div className="flex gap-2 mb-4">
        {filters.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === f.value
                ? 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/30 dark:border-blue-700 dark:text-blue-300'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-700 dark:text-slate-400'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Plan list */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block w-6 h-6 border-2 border-slate-300 border-t-blue-500 rounded-full animate-spin" />
        </div>
      ) : plans.length === 0 ? (
        <div className="text-center py-12 text-sm text-slate-400">
          No auto-complete tasks yet. Mark tasks as auto-complete and resolve their blockers to start.
        </div>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <PlanCard key={plan.id} plan={plan} onRetry={handleRetry} onCancel={handleCancel} />
          ))}
        </div>
      )}
    </div>
  );
}
