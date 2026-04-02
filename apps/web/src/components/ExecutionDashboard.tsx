import { useState, useEffect, useCallback } from 'react';
import { gql } from '../api/client';
import {
  PROJECT_ACTION_PLANS_QUERY,
  EXECUTE_ACTION_PLAN_MUTATION,
  CANCEL_ACTION_PLAN_MUTATION,
  SESSIONS_QUERY,
  CREATE_SESSION_MUTATION,
  START_SESSION_MUTATION,
  PAUSE_SESSION_MUTATION,
  CANCEL_SESSION_MUTATION,
  AUTO_START_PROJECT_MUTATION,
  TASKS_QUERY,
  PROJECT_PIPELINE_STATUS_QUERY,
} from '../api/queries';
import { useSSEListener } from '../hooks/useEventSource';
import type { Task, TaskActionPlan, TaskActionType } from '../types';

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

interface SessionConfig {
  autonomyLevel: string;
  budgetCapCents: number | null;
  failurePolicy: string;
  maxRetries: number | null;
  scopeLimit: number | null;
}

interface SessionProgress {
  tasksCompleted: number;
  tasksFailed: number;
  tasksSkipped: number;
  tokensUsed: number;
  estimatedCostCents: number;
}

interface Session {
  id: string;
  status: string;
  config: SessionConfig;
  taskIds: string[];
  progress: SessionProgress | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ActivePlanDetail {
  planId: string;
  taskTitle: string;
  currentAction: string | null;
  startedAt: string;
}

interface PipelineStatus {
  totalTasks: number;
  todoTasks: number;
  executingTasks: number;
  inReviewTasks: number;
  completedTasks: number;
  failedTasks: number;
  blockedTasks: number;
  openPRs: number;
  mergedPRs: number;
  activePlans: number;
  activePlanDetails: ActivePlanDetail[];
  estimatedRemainingHours: number | null;
  activeSession: {
    id: string;
    status: string;
    tasksCompleted: number;
    tasksFailed: number;
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
  'task.updated',
] as const;

const SESSION_SSE_EVENTS = [
  'session.started',
  'session.completed',
  'session.failed',
  'session.paused',
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
              Blocked by: {dep.title.length > 30 ? dep.title.slice(0, 30) + '\u2026' : dep.title}
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

// ── Session Creation Dialog ──

const AUTONOMY_OPTIONS = [
  { value: 'full', label: 'Full autonomy', description: 'Execute everything without approval' },
  { value: 'approve_external', label: 'Approve PRs only', description: 'Auto-approve code gen, pause for PRs' },
  { value: 'approve_all', label: 'Approve everything', description: 'Require approval before each action' },
];

const FAILURE_OPTIONS = [
  { value: 'retry_then_pause', label: 'Retry then pause' },
  { value: 'pause_immediately', label: 'Pause immediately' },
  { value: 'skip_and_continue', label: 'Skip and continue' },
];

function SessionDialog({ projectId, onClose, onCreated }: {
  projectId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [autonomyLevel, setAutonomyLevel] = useState('full');
  const [failurePolicy, setFailurePolicy] = useState('retry_then_pause');
  const [budgetCap, setBudgetCap] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loadingTasks, setLoadingTasks] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const data = await gql<{ tasks: { tasks: Task[] } }>(TASKS_QUERY, { projectId });
        const eligible = data.tasks.tasks.filter(
          (t) => t.status !== 'done' && t.status !== 'archived',
        );
        setTasks(eligible);
      } catch {
        // ignore
      } finally {
        setLoadingTasks(false);
      }
    })();
  }, [projectId]);

  const toggleTask = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === tasks.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tasks.map((t) => t.taskId)));
    }
  };

  const handleCreate = async () => {
    if (selectedIds.size === 0) return;
    setSubmitting(true);
    setError(null);
    try {
      const config = {
        autonomyLevel,
        failurePolicy,
        budgetCapCents: budgetCap ? Math.round(parseFloat(budgetCap) * 100) : null,
        maxRetries: 2,
        scopeLimit: null,
        timeLimitMinutes: null,
      };
      const { createSession: session } = await gql<{ createSession: Session }>(
        CREATE_SESSION_MUTATION,
        { projectId, taskIds: Array.from(selectedIds), config },
      );
      await gql<{ startSession: Session }>(START_SESSION_MUTATION, { sessionId: session.id });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start session');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">Start Session</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg">&times;</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Task selection */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Select tasks</p>
              <button onClick={selectAll} className="text-xs text-blue-600 hover:text-blue-700">
                {selectedIds.size === tasks.length ? 'Deselect all' : 'Select all'}
              </button>
            </div>
            {loadingTasks ? (
              <div className="text-xs text-slate-400 py-4 text-center">Loading tasks...</div>
            ) : tasks.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center">No eligible tasks found</div>
            ) : (
              <div className="max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg divide-y divide-slate-100 dark:divide-slate-800">
                {tasks.map((task) => (
                  <label
                    key={task.taskId}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.taskId)}
                      onChange={() => toggleTask(task.taskId)}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500"
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300 truncate flex-1">{task.title}</span>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{task.status}</span>
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-slate-400 mt-1">{selectedIds.size} task{selectedIds.size !== 1 ? 's' : ''} selected</p>
          </div>

          {/* Config */}
          <div className="space-y-4">
            {/* Autonomy level */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Autonomy level</p>
              <div className="space-y-1">
                {AUTONOMY_OPTIONS.map((opt) => (
                  <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="autonomy"
                      value={opt.value}
                      checked={autonomyLevel === opt.value}
                      onChange={() => setAutonomyLevel(opt.value)}
                      className="mt-0.5 text-violet-600 focus:ring-violet-500"
                    />
                    <div>
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{opt.label}</p>
                      <p className="text-[10px] text-slate-400">{opt.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* Failure policy */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">On failure</p>
              <select
                value={failurePolicy}
                onChange={(e) => setFailurePolicy(e.target.value)}
                className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                {FAILURE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* Budget cap */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Budget cap (USD, optional)</p>
              <input
                type="number"
                min="0"
                step="0.01"
                placeholder="No limit"
                value={budgetCap}
                onChange={(e) => setBudgetCap(e.target.value)}
                className="w-full text-xs border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 placeholder-slate-400"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 space-y-3">
          {error && (
            <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex items-center justify-end gap-3">
          <button onClick={onClose} className="text-xs px-4 py-2 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={submitting || selectedIds.size === 0}
            className="text-xs px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 font-medium"
          >
            {submitting ? 'Starting...' : `Start Session (${selectedIds.size} tasks)`}
          </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Active Session Banner ──

function SessionBanner({ session, onPause, onCancel, onRefresh }: {
  session: Session;
  onPause: () => void;
  onCancel: () => void;
  onRefresh: () => void;
}) {
  const progress = session.progress ?? { tasksCompleted: 0, tasksFailed: 0, tasksSkipped: 0, tokensUsed: 0, estimatedCostCents: 0 };
  const totalTasks = session.taskIds.length;
  const processed = progress.tasksCompleted + progress.tasksFailed + progress.tasksSkipped;
  const percentage = totalTasks > 0 ? Math.round((processed / totalTasks) * 100) : 0;
  const isPaused = session.status === 'paused';
  const isRunning = session.status === 'running';

  const statusLabel = isPaused ? 'Session paused' : 'Session running';
  const borderColor = isPaused
    ? 'border-amber-200 dark:border-amber-800'
    : 'border-violet-200 dark:border-violet-800';
  const bgColor = isPaused
    ? 'bg-amber-50 dark:bg-amber-900/20'
    : 'bg-violet-50 dark:bg-violet-900/20';
  const textColor = isPaused
    ? 'text-amber-800 dark:text-amber-200'
    : 'text-violet-800 dark:text-violet-200';
  const subTextColor = isPaused
    ? 'text-amber-600 dark:text-amber-400'
    : 'text-violet-600 dark:text-violet-400';

  // Listen for session SSE events
  useSSEListener(SESSION_SSE_EVENTS, useCallback(() => {
    onRefresh();
  }, [onRefresh]));

  return (
    <div className={`mb-4 p-4 ${bgColor} border ${borderColor} rounded-lg`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${textColor}`}>{statusLabel}</p>
          <p className={`text-xs ${subTextColor} mt-0.5`}>
            {progress.tasksCompleted}/{totalTasks} tasks completed
            {progress.tasksFailed > 0 && ` \u00b7 ${progress.tasksFailed} failed`}
            {progress.tasksSkipped > 0 && ` \u00b7 ${progress.tasksSkipped} skipped`}
            {progress.estimatedCostCents > 0 && ` \u00b7 $${(progress.estimatedCostCents / 100).toFixed(2)}`}
          </p>
          {/* Progress bar */}
          <div className="mt-2 w-full bg-white/50 dark:bg-slate-700/50 rounded-full h-1.5">
            <div
              className={`rounded-full h-1.5 transition-all ${
                progress.tasksFailed > 0 ? 'bg-red-500' : 'bg-violet-500'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>
        <div className="flex gap-2 ml-4 flex-shrink-0">
          {isRunning && (
            <button
              onClick={onPause}
              className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded hover:bg-amber-600"
            >
              Pause
            </button>
          )}
          {(isRunning || isPaused) && (
            <button
              onClick={onCancel}
              className="text-xs px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Pipeline Overview ──

function PipelineOverview({ status, onCancelPlan }: { status: PipelineStatus; onCancelPlan: (planId: string) => Promise<void> }) {
  const [activePlansExpanded, setActivePlansExpanded] = useState(false);

  const completionPct = status.totalTasks > 0
    ? Math.round((status.completedTasks / status.totalTasks) * 100)
    : 0;

  const cards: Array<{ label: string; value: number | string; color?: string }> = [
    { label: 'Todo', value: status.todoTasks },
    { label: 'Executing', value: status.executingTasks, color: status.executingTasks > 0 ? 'text-blue-600 dark:text-blue-400' : undefined },
    { label: 'In Review', value: status.inReviewTasks, color: status.inReviewTasks > 0 ? 'text-amber-600 dark:text-amber-400' : undefined },
    { label: 'Done', value: status.completedTasks, color: status.completedTasks > 0 ? 'text-green-600 dark:text-green-400' : undefined },
    { label: 'Failed', value: status.failedTasks, color: status.failedTasks > 0 ? 'text-red-600 dark:text-red-400' : undefined },
    { label: 'Blocked', value: status.blockedTasks, color: status.blockedTasks > 0 ? 'text-amber-600 dark:text-amber-400' : undefined },
  ];

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Pipeline Status</h3>
        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
          {status.openPRs > 0 && <span>{status.openPRs} open PR{status.openPRs !== 1 ? 's' : ''}</span>}
          {status.mergedPRs > 0 && <span>{status.mergedPRs} merged</span>}
          {status.estimatedRemainingHours != null && status.estimatedRemainingHours > 0 && (
            <span>~{status.estimatedRemainingHours.toFixed(1)}h remaining</span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
          <span>{completionPct}% complete</span>
          <span>{status.completedTasks}/{status.totalTasks} tasks</span>
        </div>
        <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
          <div
            className="rounded-full h-2 transition-all bg-green-500"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Stat cards row */}
      <div className="grid grid-cols-6 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-center">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{card.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${card.color ?? 'text-slate-800 dark:text-slate-200'}`}>{card.value}</p>
          </div>
        ))}
      </div>

      {/* Active Plans expandable section */}
      {status.activePlanDetails.length > 0 && (
        <div className="mt-3">
          <button
            onClick={() => setActivePlansExpanded(!activePlansExpanded)}
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
          >
            <span className={`transition-transform ${activePlansExpanded ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
            {status.activePlanDetails.length} active plan{status.activePlanDetails.length !== 1 ? 's' : ''}
          </button>
          {activePlansExpanded && (
            <div className="mt-2 space-y-2">
              {status.activePlanDetails.map((plan) => (
                <div key={plan.planId} className="flex items-center gap-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{plan.taskTitle}</p>
                    {plan.currentAction && (
                      <p className="text-[10px] text-blue-500 mt-0.5">{plan.currentAction}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-slate-400 flex-shrink-0">{formatElapsed(plan.startedAt)}</span>
                  <button
                    onClick={() => void onCancelPlan(plan.planId)}
                    className="text-[10px] px-2 py-0.5 border border-red-200 text-red-600 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 flex-shrink-0"
                  >
                    Cancel
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Dashboard ──

interface ExecutionDashboardProps {
  projectId: string;
  onClose: () => void;
}

export default function ExecutionDashboard({ projectId, onClose }: ExecutionDashboardProps) {
  const [plans, setPlans] = useState<ActionPlanWithTask[]>([]);
  const [allPlans, setAllPlans] = useState<ActionPlanWithTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showSessionDialog, setShowSessionDialog] = useState(false);
  const [showQuickStartConfirm, setShowQuickStartConfirm] = useState(false);
  const [quickStarting, setQuickStarting] = useState(false);
  const [quickStartError, setQuickStartError] = useState<string | null>(null);
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);

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

  // Fetch pipeline status
  const fetchPipelineStatus = useCallback(async () => {
    try {
      const data = await gql<{ projectPipelineStatus: PipelineStatus }>(
        PROJECT_PIPELINE_STATUS_QUERY,
        { projectId },
      );
      setPipelineStatus(data.projectPipelineStatus);
    } catch {
      // silently fail
    }
  }, [projectId]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const data = await gql<{ sessions: Session[] }>(SESSIONS_QUERY, { projectId });
      setSessions(data.sessions);
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

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    fetchPipelineStatus();
  }, [fetchPipelineStatus]);

  // Use todoTasks from pipeline status instead of fetching all tasks
  const todoTaskCount = pipelineStatus?.todoTasks ?? 0;

  const handleQuickStart = useCallback(async () => {
    setQuickStarting(true);
    setQuickStartError(null);
    try {
      await gql<{ autoStartProject: Session }>(
        AUTO_START_PROJECT_MUTATION,
        { projectId },
      );
      setShowQuickStartConfirm(false);
      void fetchSessions();
      void fetchPlans();
      void fetchAllPlans();
    } catch (err) {
      setQuickStartError(err instanceof Error ? err.message : 'Failed to quick start');
    } finally {
      setQuickStarting(false);
    }
  }, [projectId, fetchSessions, fetchPlans, fetchAllPlans]);

  // SSE: auto-refresh on action plan events
  useSSEListener(SSE_REFRESH_EVENTS, useCallback(() => {
    void fetchPlans();
    void fetchAllPlans();
    void fetchSessions();
    void fetchPipelineStatus();
  }, [fetchPlans, fetchAllPlans, fetchSessions, fetchPipelineStatus]));

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

  const handlePauseSession = useCallback(async (sessionId: string) => {
    await gql<{ pauseSession: Session }>(PAUSE_SESSION_MUTATION, { sessionId });
    void fetchSessions();
  }, [fetchSessions]);

  const handleCancelSession = useCallback(async (sessionId: string) => {
    await gql<{ cancelSession: Session }>(CANCEL_SESSION_MUTATION, { sessionId });
    void fetchSessions();
  }, [fetchSessions]);

  // Active session = running or paused
  const activeSession = sessions.find((s) => s.status === 'running' || s.status === 'paused');

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
        <div className="flex items-center gap-3">
          {!activeSession && (
            <>
              <button
                onClick={() => setShowQuickStartConfirm(true)}
                disabled={todoTaskCount === 0}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                title={todoTaskCount === 0 ? 'No todo tasks to execute' : `Quick start autopilot for ${todoTaskCount} tasks`}
              >
                Quick Start
              </button>
              <button
                onClick={() => setShowSessionDialog(true)}
                className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 text-sm font-medium"
              >
                Start Session
              </button>
            </>
          )}
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
          >
            Close
          </button>
        </div>
      </div>

      {/* Active session banner */}
      {activeSession && (
        <SessionBanner
          session={activeSession}
          onPause={() => void handlePauseSession(activeSession.id)}
          onCancel={() => void handleCancelSession(activeSession.id)}
          onRefresh={fetchSessions}
        />
      )}

      {/* Pipeline status overview */}
      {pipelineStatus && <PipelineOverview status={pipelineStatus} onCancelPlan={handleCancel} />}

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

      {/* Quick Start confirmation */}
      {showQuickStartConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200 mb-2">
              Start autopilot for {todoTaskCount} task{todoTaskCount !== 1 ? 's' : ''}?
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              All todo tasks will be queued for automatic execution with default settings (approve PRs only, retry then pause).
            </p>
            {quickStartError && (
              <p className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2 mb-3">
                {quickStartError}
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowQuickStartConfirm(false); setQuickStartError(null); }}
                className="text-xs px-4 py-2 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleQuickStart()}
                disabled={quickStarting}
                className="text-xs px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 font-medium"
              >
                {quickStarting ? 'Starting...' : 'Start'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Session creation dialog */}
      {showSessionDialog && (
        <SessionDialog
          projectId={projectId}
          onClose={() => setShowSessionDialog(false)}
          onCreated={() => void fetchSessions()}
        />
      )}
    </div>
  );
}
