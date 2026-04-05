import { useState, useEffect, useCallback, useMemo } from 'react';
import { gql } from '../api/client';
import {
  PROJECT_PIPELINE_STATUS_QUERY,
  AUTO_START_PROJECT_MUTATION,
  PROJECT_ACTION_PLANS_QUERY,
  SESSIONS_QUERY,
  PAUSE_SESSION_MUTATION,
  CANCEL_SESSION_MUTATION,
  CANCEL_ACTION_PLAN_MUTATION,
} from '../api/queries';
import { useSSEListener } from '../hooks/useEventSource';
import { TaskRow } from './SprintSection';
import type { Task, OrgUser, TaskActionPlan, TaskActionType } from '../types';

// ── Types ──

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
  taskIds: string[];
  progress: SessionProgress | null;
  startedAt: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

interface ActionPlanWithTask extends TaskActionPlan {
  task?: {
    taskId: string;
    title: string;
    status: string;
    taskType: string | null;
    autoComplete: boolean;
    parentTaskTitle: string | null;
  } | null;
}

// ── Constants ──

const SSE_REFRESH_EVENTS = [
  'task.action_started',
  'task.action_completed',
  'task.action_plan_completed',
  'task.action_plan_failed',
  'task.blocked',
  'task.unblocked',
  'task.updated',
  'task.created',
  'tasks.bulk_updated',
  'session.started',
  'session.completed',
  'session.failed',
  'session.paused',
] as const;

const STATUS_ORDER: Record<string, number> = {
  in_progress: 0,
  in_review: 1,
  todo: 2,
  done: 3,
  archived: 4,
};

const ACTION_PLAN_BADGE: Record<string, { bg: string; text: string }> = {
  executing: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
  completed: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300' },
  failed: { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300' },
};

const ACTION_STATUS_ICONS: Record<string, string> = {
  pending: '\u25CB',
  executing: '\u25D4',
  completed: '\u2714',
  failed: '\u2718',
  skipped: '\u2500',
};

const ACTION_STATUS_COLORS: Record<string, string> = {
  pending: 'text-slate-400',
  executing: 'text-blue-500 animate-pulse',
  completed: 'text-green-600',
  failed: 'text-red-500',
  skipped: 'text-slate-300',
};

// ── Helpers ──

function statusGroupLabel(status: string): string {
  switch (status) {
    case 'in_progress': return 'Executing';
    case 'in_review': return 'In Review';
    case 'todo': return 'Todo';
    case 'done': return 'Done';
    default: return status;
  }
}

// ── Sub-components ──

function PipelineStatsBar({ status }: { status: PipelineStatus }) {
  const cards: Array<{ label: string; value: number; color?: string }> = [
    { label: 'Todo', value: status.todoTasks },
    { label: 'Executing', value: status.executingTasks, color: status.executingTasks > 0 ? 'text-blue-600 dark:text-blue-400' : undefined },
    { label: 'In Review', value: status.inReviewTasks, color: status.inReviewTasks > 0 ? 'text-amber-600 dark:text-amber-400' : undefined },
    { label: 'Done', value: status.completedTasks, color: status.completedTasks > 0 ? 'text-green-600 dark:text-green-400' : undefined },
    { label: 'Failed', value: status.failedTasks, color: status.failedTasks > 0 ? 'text-red-600 dark:text-red-400' : undefined },
    { label: 'Blocked', value: status.blockedTasks, color: status.blockedTasks > 0 ? 'text-amber-600 dark:text-amber-400' : undefined },
  ];

  const completionPct = status.totalTasks > 0
    ? Math.round((status.completedTasks / status.totalTasks) * 100)
    : 0;

  return (
    <div>
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
        <span>{completionPct}% complete</span>
        <span>{status.completedTasks}/{status.totalTasks} tasks</span>
      </div>
      <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mb-3">
        <div
          className="rounded-full h-1.5 transition-all bg-green-500"
          style={{ width: `${completionPct}%` }}
        />
      </div>
      <div className="grid grid-cols-6 gap-2">
        {cards.map((card) => (
          <div key={card.label} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-center">
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{card.label}</p>
            <p className={`text-lg font-bold mt-0.5 ${card.color ?? 'text-slate-800 dark:text-slate-200'}`}>{card.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function SessionControls({
  session,
  todoTaskCount,
  quickStarting,
  quickStartError,
  onQuickStart,
  onConfigureSession,
  onPause,
  onCancel,
}: {
  session: Session | null;
  todoTaskCount: number;
  quickStarting: boolean;
  quickStartError: string | null;
  onQuickStart: () => void;
  onConfigureSession: () => void;
  onPause: () => void;
  onCancel: () => void;
}) {
  if (!session) {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={onQuickStart}
          disabled={todoTaskCount === 0 || quickStarting}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          title={todoTaskCount === 0 ? 'No todo tasks to execute' : `Quick start autopilot for ${todoTaskCount} tasks`}
        >
          {quickStarting ? 'Starting...' : `Quick Start (${todoTaskCount})`}
        </button>
        <button
          onClick={onConfigureSession}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          Configure Session
        </button>
        {quickStartError && (
          <span className="text-xs text-red-600 dark:text-red-400">{quickStartError}</span>
        )}
      </div>
    );
  }

  const progress = session.progress ?? { tasksCompleted: 0, tasksFailed: 0, tasksSkipped: 0, tokensUsed: 0, estimatedCostCents: 0 };
  const totalTasks = session.taskIds.length;
  const processed = progress.tasksCompleted + progress.tasksFailed + progress.tasksSkipped;
  const percentage = totalTasks > 0 ? Math.round((processed / totalTasks) * 100) : 0;
  const isPaused = session.status === 'paused';
  const isRunning = session.status === 'running';

  const borderColor = isPaused ? 'border-amber-200 dark:border-amber-800' : 'border-violet-200 dark:border-violet-800';
  const bgColor = isPaused ? 'bg-amber-50 dark:bg-amber-900/20' : 'bg-violet-50 dark:bg-violet-900/20';
  const textColor = isPaused ? 'text-amber-800 dark:text-amber-200' : 'text-violet-800 dark:text-violet-200';
  const subTextColor = isPaused ? 'text-amber-600 dark:text-amber-400' : 'text-violet-600 dark:text-violet-400';

  return (
    <div className={`p-3 ${bgColor} border ${borderColor} rounded-lg`}>
      <div className="flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className={`text-sm font-medium ${textColor}`}>
            {isPaused ? 'Session paused' : 'Session running'}
          </p>
          <p className={`text-xs ${subTextColor} mt-0.5`}>
            {progress.tasksCompleted}/{totalTasks} tasks completed
            {progress.tasksFailed > 0 && ` \u00b7 ${progress.tasksFailed} failed`}
            {progress.tasksSkipped > 0 && ` \u00b7 ${progress.tasksSkipped} skipped`}
            {progress.estimatedCostCents > 0 && ` \u00b7 $${(progress.estimatedCostCents / 100).toFixed(2)}`}
          </p>
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
            <button onClick={onPause} className="text-xs px-3 py-1.5 bg-amber-500 text-white rounded hover:bg-amber-600">
              Pause
            </button>
          )}
          {(isRunning || isPaused) && (
            <button onClick={onCancel} className="text-xs px-3 py-1.5 bg-red-500 text-white rounded hover:bg-red-600">
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ActivePlansList({
  plans,
  onCancel,
}: {
  plans: ActionPlanWithTask[];
  onCancel: (planId: string) => Promise<void>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (plans.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
        Active Plans ({plans.length})
      </h3>
      <div className="space-y-2">
        {plans.map((plan) => {
          const completedCount = plan.actions.filter((a: TaskActionType) => a.status === 'completed').length;
          const totalCount = plan.actions.length;
          const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
          const isExpanded = expandedId === plan.id;

          return (
            <div
              key={plan.id}
              className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2"
            >
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setExpandedId(isExpanded ? null : plan.id)}
                  className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
                >
                  <span className={`inline-block transition-transform ${isExpanded ? 'rotate-90' : ''}`}>{'\u25B6'}</span>
                </button>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">
                    {plan.task?.title ?? `Task ${plan.taskId.slice(0, 8)}`}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <div className="flex-1 bg-slate-200 dark:bg-slate-700 rounded-full h-1">
                      <div className="rounded-full h-1 transition-all bg-green-500" style={{ width: `${percentage}%` }} />
                    </div>
                    <span className="text-[10px] text-slate-400 flex-shrink-0">{completedCount}/{totalCount}</span>
                  </div>
                </div>
                <button
                  onClick={() => void onCancel(plan.id)}
                  className="text-[10px] px-2 py-0.5 border border-red-200 text-red-600 rounded hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20 flex-shrink-0"
                >
                  Cancel
                </button>
              </div>
              {isExpanded && (
                <div className="mt-2 space-y-0.5 border-t border-slate-100 dark:border-slate-800 pt-2">
                  {plan.actions.map((action: TaskActionType) => (
                    <div key={action.id} className="flex items-center gap-2 py-0.5">
                      <span className={`text-sm ${ACTION_STATUS_COLORS[action.status] ?? 'text-slate-400'}`}>
                        {ACTION_STATUS_ICONS[action.status] ?? '\u25CB'}
                      </span>
                      <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{action.label}</span>
                      <span className="text-xs text-slate-400 ml-auto flex-shrink-0">{action.actionType.replace('_', ' ')}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main Component ──

interface AutopilotViewProps {
  projectId: string;
  tasks: Task[];
  orgUsers: OrgUser[];
  selectedTask: Task | null;
  selectedTaskIds: Set<string>;
  onSelectTask: (task: Task) => void;
  onToggleTaskId: (taskId: string) => void;
  onToggleAll: (taskIds: string[]) => void;
  onAutoComplete: (task: Task) => void;
  autoCompleteLoading: boolean;
  isProjectBusy: boolean;
  onOpenModal: (modal: string) => void;
  epicMap?: Map<string, string>;
}

export default function AutopilotView({
  projectId,
  tasks,
  orgUsers,
  selectedTask,
  selectedTaskIds,
  onSelectTask,
  onToggleTaskId,
  onToggleAll,
  onAutoComplete,
  autoCompleteLoading,
  isProjectBusy,
  onOpenModal,
  epicMap,
}: AutopilotViewProps) {
  const [pipelineStatus, setPipelineStatus] = useState<PipelineStatus | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activePlans, setActivePlans] = useState<ActionPlanWithTask[]>([]);
  const [quickStarting, setQuickStarting] = useState(false);
  const [quickStartError, setQuickStartError] = useState<string | null>(null);

  // Fetch pipeline status
  const fetchPipelineStatus = useCallback(async () => {
    try {
      const data = await gql<{ projectPipelineStatus: PipelineStatus }>(
        PROJECT_PIPELINE_STATUS_QUERY,
        { projectId },
      );
      setPipelineStatus(data.projectPipelineStatus);
    } catch {
      // non-critical
    }
  }, [projectId]);

  // Fetch sessions
  const fetchSessions = useCallback(async () => {
    try {
      const data = await gql<{ sessions: Session[] }>(SESSIONS_QUERY, { projectId });
      setSessions(data.sessions);
    } catch {
      // non-critical
    }
  }, [projectId]);

  // Fetch executing action plans
  const fetchActivePlans = useCallback(async () => {
    try {
      const data = await gql<{ projectActionPlans: ActionPlanWithTask[] }>(
        PROJECT_ACTION_PLANS_QUERY,
        { projectId, status: 'executing' },
      );
      setActivePlans(data.projectActionPlans);
    } catch {
      // non-critical
    }
  }, [projectId]);

  useEffect(() => { void fetchPipelineStatus(); }, [fetchPipelineStatus]);
  useEffect(() => { void fetchSessions(); }, [fetchSessions]);
  useEffect(() => { void fetchActivePlans(); }, [fetchActivePlans]);

  // SSE refresh
  useSSEListener(SSE_REFRESH_EVENTS, useCallback(() => {
    void fetchPipelineStatus();
    void fetchSessions();
    void fetchActivePlans();
  }, [fetchPipelineStatus, fetchSessions, fetchActivePlans]));

  // Quick Start
  const handleQuickStart = useCallback(async () => {
    setQuickStarting(true);
    setQuickStartError(null);
    try {
      await gql<{ autoStartProject: Session }>(
        AUTO_START_PROJECT_MUTATION,
        { projectId },
      );
      void fetchSessions();
      void fetchPipelineStatus();
      void fetchActivePlans();
    } catch (err) {
      setQuickStartError(err instanceof Error ? err.message : 'Failed to quick start');
    } finally {
      setQuickStarting(false);
    }
  }, [projectId, fetchSessions, fetchPipelineStatus, fetchActivePlans]);

  // Session controls
  const activeSession = sessions.find((s) => s.status === 'running' || s.status === 'paused') ?? null;

  const handlePauseSession = useCallback(async () => {
    if (!activeSession) return;
    await gql<{ pauseSession: Session }>(PAUSE_SESSION_MUTATION, { sessionId: activeSession.id });
    void fetchSessions();
  }, [activeSession, fetchSessions]);

  const handleCancelSession = useCallback(async () => {
    if (!activeSession) return;
    await gql<{ cancelSession: Session }>(CANCEL_SESSION_MUTATION, { sessionId: activeSession.id });
    void fetchSessions();
  }, [activeSession, fetchSessions]);

  const handleCancelPlan = useCallback(async (planId: string) => {
    await gql<{ cancelActionPlan: TaskActionPlan }>(CANCEL_ACTION_PLAN_MUTATION, { planId });
    void fetchActivePlans();
    void fetchPipelineStatus();
  }, [fetchActivePlans, fetchPipelineStatus]);

  // Group tasks by execution status
  const taskGroups = useMemo(() => {
    const groups: Record<string, Task[]> = {};
    for (const task of tasks) {
      if (task.archived) continue;
      const status = task.status;
      if (!groups[status]) groups[status] = [];
      groups[status].push(task);
    }

    // Sort each group by position
    for (const key of Object.keys(groups)) {
      groups[key].sort((a, b) => {
        if (a.position != null && b.position != null) return a.position - b.position;
        if (a.position != null) return -1;
        if (b.position != null) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });
    }

    // Build ordered list of groups
    const orderedStatuses = Object.keys(groups).sort(
      (a, b) => (STATUS_ORDER[a] ?? 99) - (STATUS_ORDER[b] ?? 99)
    );

    return orderedStatuses.map((status) => ({
      status,
      label: statusGroupLabel(status),
      tasks: groups[status],
    }));
  }, [tasks]);

  // Build a map of taskId -> action plan status for badges
  const taskPlanStatusMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const plan of activePlans) {
      if (plan.task?.taskId) {
        map.set(plan.task.taskId, plan.status);
      }
    }
    return map;
  }, [activePlans]);

  const showCheckboxes = selectedTaskIds.size > 0;
  const todoTaskCount = pipelineStatus?.todoTasks ?? 0;

  return (
    <div className="flex-1 overflow-hidden px-6 py-4">
      {/* Side-by-side on large screens, stacked on small */}
      <div className="h-full flex flex-col lg:flex-row gap-4 max-w-7xl mx-auto">
        {/* Left panel: Execution controls */}
        <div className="lg:w-80 xl:w-96 flex-shrink-0 space-y-4 lg:overflow-y-auto lg:h-full lg:pr-2">
          {/* Pipeline Stats Bar */}
          {pipelineStatus && <PipelineStatsBar status={pipelineStatus} />}

          {/* Session Controls */}
          <SessionControls
            session={activeSession}
            todoTaskCount={todoTaskCount}
            quickStarting={quickStarting}
            quickStartError={quickStartError}
            onQuickStart={() => void handleQuickStart()}
            onConfigureSession={() => onOpenModal('execution-dashboard')}
            onPause={() => void handlePauseSession()}
            onCancel={() => void handleCancelSession()}
          />

          {/* Active Plans */}
          <ActivePlansList plans={activePlans} onCancel={handleCancelPlan} />
        </div>

        {/* Right panel: Scrollable task list */}
        <div className="flex-1 min-w-0 overflow-y-auto lg:h-full space-y-4">
        {taskGroups.map((group) => (
          <div key={group.status} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
            <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
              <input
                type="checkbox"
                checked={group.tasks.length > 0 && group.tasks.every((t) => selectedTaskIds.has(t.taskId))}
                onChange={() => onToggleAll(group.tasks.map((t) => t.taskId))}
                className={`w-3.5 h-3.5 rounded border-slate-300 text-slate-600 cursor-pointer ${showCheckboxes ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}
              />
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{group.label}</span>
              <span className="text-xs text-slate-500">({group.tasks.length})</span>
            </div>
            <div className="px-3 py-2 space-y-0">
              {group.tasks.map((task) => {
                const planStatus = taskPlanStatusMap.get(task.taskId);
                const badge = planStatus ? ACTION_PLAN_BADGE[planStatus] : null;

                return (
                  <div key={task.taskId} className="flex items-center gap-0">
                    <div className="flex-1 min-w-0 flex items-center">
                      <div className="flex-1 min-w-0">
                        <TaskRow
                          task={task}
                          orgUsers={orgUsers}
                          allTasks={tasks}
                          selectedTask={selectedTask}
                          onSelectTask={onSelectTask}
                          onDragStart={() => {}}
                          isChecked={selectedTaskIds.has(task.taskId)}
                          showCheckboxes={showCheckboxes}
                          onToggleTaskId={onToggleTaskId}
                          epicMap={epicMap}
                        />
                      </div>
                      {/* Action plan status badge */}
                      {badge && (
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 mr-1 ${badge.bg} ${badge.text}`}>
                          {planStatus}
                        </span>
                      )}
                      {/* Auto-Complete button */}
                      {task.status === 'todo' && !planStatus && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onAutoComplete(task); }}
                          disabled={autoCompleteLoading || isProjectBusy}
                          className="text-[10px] px-2 py-0.5 bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 rounded hover:bg-violet-200 dark:hover:bg-violet-900/50 disabled:opacity-50 flex-shrink-0 mr-1"
                          title="Auto-complete this task"
                        >
                          Auto
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {tasks.filter((t) => !t.archived).length === 0 && (
          <div className="text-center py-12 text-sm text-slate-400">
            No tasks yet. Create tasks to get started with the autopilot.
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
