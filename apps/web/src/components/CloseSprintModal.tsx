import { useState } from 'react';
import { gql } from '../api/client';
import type { Task, Sprint, CloseSprintResult } from '../types';
import { parseColumns } from '../utils/jsonHelpers';
import Modal from './shared/Modal';
import Button from './shared/Button';

interface CloseSprintModalProps {
  sprint: Sprint;
  sprintTasks: Task[];
  otherSprints: Sprint[];
  onClosed: (result: CloseSprintResult) => void;
  onActivateNext: (sprintId: string) => void;
  onCreateSprint: () => void;
  onClose: () => void;
}

type TaskAction = 'backlog' | 'sprint' | 'archive';

interface TaskDisposition {
  action: TaskAction;
  targetSprintId?: string;
}

export default function CloseSprintModal({
  sprint,
  sprintTasks,
  otherSprints,
  onClosed,
  onActivateNext,
  onCreateSprint,
  onClose,
}: CloseSprintModalProps) {
  const cols = parseColumns(sprint.columns);
  const doneCol = cols[cols.length - 1];
  const completeTasks = sprintTasks.filter((t) => t.sprintColumn === doneCol || t.status === 'done');
  const incompleteTasks = sprintTasks.filter((t) => t.sprintColumn !== doneCol && t.status !== 'done');

  const [step, setStep] = useState<'review' | 'done'>('review');
  const [result, setResult] = useState<CloseSprintResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [dispositions, setDispositions] = useState<Record<string, TaskDisposition>>(() =>
    Object.fromEntries(incompleteTasks.map((t) => [t.taskId, { action: 'backlog' as TaskAction }]))
  );

  const [globalAction, setGlobalAction] = useState<TaskAction>('backlog');
  const [globalSprintId, setGlobalSprintId] = useState<string>(otherSprints[0]?.sprintId ?? '');

  const applyGlobalAction = () => {
    setDispositions(
      Object.fromEntries(
        incompleteTasks.map((t) => [
          t.taskId,
          {
            action: globalAction,
            targetSprintId: globalAction === 'sprint' ? globalSprintId : undefined,
          },
        ])
      )
    );
  };

  const setTaskAction = (taskId: string, action: TaskAction) => {
    setDispositions((prev) => ({
      ...prev,
      [taskId]: {
        action,
        targetSprintId: action === 'sprint' ? (prev[taskId]?.targetSprintId ?? otherSprints[0]?.sprintId) : undefined,
      },
    }));
  };

  const setTaskSprint = (taskId: string, targetSprintId: string) => {
    setDispositions((prev) => ({
      ...prev,
      [taskId]: { ...prev[taskId], targetSprintId },
    }));
  };

  const handleClose = async () => {
    setLoading(true);
    setErr(null);
    try {
      const incompleteTaskActions = incompleteTasks.map((t) => {
        const d = dispositions[t.taskId] ?? { action: 'backlog' };
        return {
          taskId: t.taskId,
          action: d.action,
          targetSprintId: d.targetSprintId ?? null,
        };
      });

      const data = await gql<{ closeSprint: CloseSprintResult }>(
        `mutation CloseSprint($sprintId: ID!, $incompleteTaskActions: [IncompleteTaskAction!]!) {
          closeSprint(sprintId: $sprintId, incompleteTaskActions: $incompleteTaskActions) {
            sprint {
              sprintId projectId name isActive columns startDate endDate createdAt closedAt
            }
            nextSprint {
              sprintId projectId name isActive columns startDate endDate createdAt closedAt
            }
          }
        }`,
        { sprintId: sprint.sprintId, incompleteTaskActions }
      );

      setResult(data.closeSprint);
      onClosed(data.closeSprint);
      setStep('done');
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to close sprint');
    } finally {
      setLoading(false);
    }
  };

  const actionColor: Record<TaskAction, string> = {
    backlog: 'text-slate-700',
    sprint: 'text-blue-700',
    archive: 'text-red-600',
  };

  return (
    <Modal isOpen={true} onClose={onClose} title={step === 'review' ? 'Close Sprint' : 'Sprint Closed'} size="md">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">
            {step === 'review' ? 'Close Sprint' : 'Sprint Closed'}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{sprint.name}</p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg" aria-label="Close">✕</button>
      </div>

      {/* ── STEP 1: Review ── */}
      {step === 'review' && (
        <>
          {/* Stats bar */}
          <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex gap-6 flex-shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-green-600 font-bold text-lg">{completeTasks.length}</span>
              <span className="text-sm text-slate-600">completed</span>
            </div>
            <div className="flex items-center gap-2">
              <span className={`font-bold text-lg ${incompleteTasks.length > 0 ? 'text-orange-500' : 'text-slate-400'}`}>
                {incompleteTasks.length}
              </span>
              <span className="text-sm text-slate-600">incomplete</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500 text-sm">{sprintTasks.length} total</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Completed */}
            {completeTasks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  ✓ Completed ({completeTasks.length})
                </p>
                <ul className="space-y-1">
                  {completeTasks.map((t) => (
                    <li key={t.taskId} className="flex items-center gap-2 text-sm text-slate-600 py-0.5">
                      <span className="text-green-500 flex-shrink-0">✓</span>
                      <span>{t.title}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Incomplete */}
            {incompleteTasks.length > 0 && (
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">
                  ○ Incomplete ({incompleteTasks.length})
                </p>

                {/* Global shortcut */}
                <div className="flex items-center gap-2 mb-3 p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-xs text-slate-500 flex-shrink-0">Apply to all:</span>
                  <select
                    value={globalAction}
                    onChange={(e) => setGlobalAction(e.target.value as TaskAction)}
                    className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none"
                  >
                    <option value="backlog">Move to Backlog</option>
                    {otherSprints.length > 0 && <option value="sprint">Move to Sprint</option>}
                    <option value="archive">Archive</option>
                  </select>
                  {globalAction === 'sprint' && (
                    <select
                      value={globalSprintId}
                      onChange={(e) => setGlobalSprintId(e.target.value)}
                      className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none"
                    >
                      {otherSprints.map((s) => (
                        <option key={s.sprintId} value={s.sprintId}>{s.name}</option>
                      ))}
                    </select>
                  )}
                  <Button size="sm" onClick={applyGlobalAction} className="flex-shrink-0">
                    Apply
                  </Button>
                </div>

                {/* Per-task rows */}
                <ul className="space-y-2">
                  {incompleteTasks.map((t) => {
                    const d = dispositions[t.taskId] ?? { action: 'backlog' as TaskAction };
                    return (
                      <li key={t.taskId} className="flex items-center gap-2 p-2 rounded-lg border border-slate-200 bg-white">
                        <span className="text-slate-400 flex-shrink-0">○</span>
                        <span className="flex-1 text-sm text-slate-700 truncate">{t.title}</span>
                        <select
                          value={d.action}
                          onChange={(e) => setTaskAction(t.taskId, e.target.value as TaskAction)}
                          className={`text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none flex-shrink-0 ${actionColor[d.action]}`}
                        >
                          <option value="backlog">Backlog</option>
                          {otherSprints.length > 0 && <option value="sprint">Move to Sprint</option>}
                          <option value="archive">Archive</option>
                        </select>
                        {d.action === 'sprint' && (
                          <select
                            value={d.targetSprintId ?? ''}
                            onChange={(e) => setTaskSprint(t.taskId, e.target.value)}
                            className="text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none flex-shrink-0"
                          >
                            {otherSprints.map((s) => (
                              <option key={s.sprintId} value={s.sprintId}>{s.name}</option>
                            ))}
                          </select>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {incompleteTasks.length === 0 && (
              <div className="flex items-center justify-center py-6 text-center">
                <div>
                  <p className="text-3xl mb-2">🎉</p>
                  <p className="text-sm font-medium text-slate-700">All tasks completed!</p>
                  <p className="text-xs text-slate-500 mt-1">Great work. Ready to close this sprint.</p>
                </div>
              </div>
            )}
          </div>

          {err && (
            <div className="px-6 py-2 text-sm text-red-600 bg-red-50 border-t border-red-100 flex-shrink-0">{err}</div>
          )}

          <div className="px-6 py-4 border-t border-slate-200 flex justify-end gap-2 flex-shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-1.5 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <Button size="sm" onClick={handleClose} disabled={loading}>
              {loading ? 'Closing…' : 'Close Sprint'}
            </Button>
          </div>
        </>
      )}

      {/* ── STEP 2: What's Next ── */}
      {step === 'done' && result && (
        <div className="flex-1 px-6 py-8 flex items-center justify-center">
          <div className="text-center space-y-4 w-full max-w-sm">
            <p className="text-3xl">✓</p>
            <p className="text-base font-semibold text-slate-800">Sprint closed successfully</p>

            {result.nextSprint ? (
              <div className="mt-4 space-y-3">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="text-xs text-blue-600 font-medium uppercase tracking-wide mb-1">Next Sprint</p>
                  <p className="text-sm font-semibold text-slate-800">{result.nextSprint.name}</p>
                </div>
                <Button onClick={() => { onActivateNext(result.nextSprint!.sprintId); onClose(); }} className="w-full rounded-lg">
                  Activate {result.nextSprint.name}
                </Button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Go to Backlog
                </button>
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <p className="text-sm text-slate-500">No more sprints planned. What would you like to do next?</p>
                <Button onClick={() => { onCreateSprint(); onClose(); }} className="w-full rounded-lg">
                  + Create Next Sprint
                </Button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full px-4 py-2 text-sm text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  Go to Backlog
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
