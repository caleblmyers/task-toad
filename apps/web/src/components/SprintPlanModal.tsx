import { useState } from 'react';
import { gql } from '../api/client';
import type { Task, Sprint, SprintPlanItem } from '../types';
import Modal from './shared/Modal';
import Button from './shared/Button';

interface SprintPlanModalProps {
  projectId: string;
  tasks: Task[];
  onCreated: (sprints: Sprint[]) => void;
  onTasksUpdated: () => void;
  onClose: () => void;
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h >= 8) return `${+(h / 8).toFixed(1)}d`;
  return `${h}h`;
}

export default function SprintPlanModal({
  projectId,
  tasks,
  onCreated,
  onTasksUpdated,
  onClose,
}: SprintPlanModalProps) {
  const [sprintLengthWeeks, setSprintLengthWeeks] = useState(2);
  const [teamSize, setTeamSize] = useState(2);
  const [plan, setPlan] = useState<SprintPlanItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const backlogTasks = tasks.filter((t) => !t.sprintId && !t.parentTaskId);
  const taskMap = Object.fromEntries(tasks.map((t) => [t.taskId, t]));
  const capacity = Math.round(sprintLengthWeeks * teamSize * 40 * 0.7);

  const handleGenerate = async () => {
    setLoading(true);
    setErr(null);
    try {
      const data = await gql<{ previewSprintPlan: SprintPlanItem[] }>(
        `mutation PreviewSprintPlan($projectId: ID!, $sprintLengthWeeks: Int!, $teamSize: Int!) {
          previewSprintPlan(projectId: $projectId, sprintLengthWeeks: $sprintLengthWeeks, teamSize: $teamSize) {
            name taskIds totalHours
          }
        }`,
        { projectId, sprintLengthWeeks, teamSize }
      );
      setPlan(data.previewSprintPlan);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to generate sprint plan');
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!plan) return;
    setCommitting(true);
    setErr(null);
    try {
      const data = await gql<{ commitSprintPlan: Sprint[] }>(
        `mutation CommitSprintPlan($projectId: ID!, $sprints: [SprintPlanInput!]!) {
          commitSprintPlan(projectId: $projectId, sprints: $sprints) {
            sprintId projectId name isActive columns startDate endDate createdAt
          }
        }`,
        {
          projectId,
          sprints: plan.map((s) => ({ name: s.name, taskIds: s.taskIds })),
        }
      );
      onCreated(data.commitSprintPlan);
      onTasksUpdated();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to commit sprint plan');
    } finally {
      setCommitting(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={onClose} title="AI Sprint Planning" size="md">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-600 flex-shrink-0">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">AI Sprint Planning</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {backlogTasks.length} unassigned task{backlogTasks.length !== 1 ? 's' : ''} in backlog
          </p>
        </div>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg" aria-label="Close">✕</button>
      </div>

      {/* Config row */}
      <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
        <div className="flex gap-4 items-end">
          <div>
            <label htmlFor="sprint-plan-length" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Sprint Length</label>
            <div className="flex items-center gap-2">
              <input
                id="sprint-plan-length"
                type="number"
                min={1}
                max={8}
                value={sprintLengthWeeks}
                onChange={(e) => { setSprintLengthWeeks(Number(e.target.value)); setPlan(null); }}
                className="w-16 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
              <span className="text-sm text-slate-500 dark:text-slate-400">weeks</span>
            </div>
          </div>
          <div>
            <label htmlFor="sprint-plan-team-size" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Team Size</label>
            <div className="flex items-center gap-2">
              <input
                id="sprint-plan-team-size"
                type="number"
                min={1}
                max={20}
                value={teamSize}
                onChange={(e) => { setTeamSize(Number(e.target.value)); setPlan(null); }}
                className="w-16 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
              <span className="text-sm text-slate-500 dark:text-slate-400">devs</span>
            </div>
          </div>
          <div className="flex-1 text-right">
            <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">~{capacity}h capacity/sprint</p>
            <Button size="sm" onClick={handleGenerate} disabled={loading || backlogTasks.length === 0}>
              {loading ? '◌ Planning…' : plan ? '↺ Regenerate' : '✦ Generate Plan'}
            </Button>
          </div>
        </div>
      </div>

      {/* Plan preview */}
      {plan && (
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {plan.map((sprint, idx) => {
            const pct = Math.round((sprint.totalHours / capacity) * 100);
            const barColor = pct > 100 ? 'bg-red-400' : pct > 85 ? 'bg-orange-400' : 'bg-blue-400';
            return (
              <div key={idx} className="border border-slate-200 dark:border-slate-600 rounded-lg overflow-hidden">
                <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-600">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{sprint.name}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      {formatHours(sprint.totalHours)} / {formatHours(capacity)}
                      <span className={`ml-1 font-medium ${pct > 100 ? 'text-red-600' : pct > 85 ? 'text-orange-600' : 'text-slate-500'}`}>
                        ({pct}%)
                      </span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${barColor}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                </div>
                <ul className="px-4 py-2 space-y-1">
                  {sprint.taskIds.map((taskId) => {
                    const task = taskMap[taskId];
                    return (
                      <li key={taskId} className="flex items-center gap-2 text-sm py-0.5">
                        <span className="text-slate-500 dark:text-slate-400 flex-shrink-0">–</span>
                        <span className="text-slate-700 dark:text-slate-300 flex-1">{task?.title ?? taskId}</span>
                        {task?.estimatedHours != null && (
                          <span className="text-xs text-slate-400 flex-shrink-0">
                            {formatHours(task.estimatedHours)}
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      {!plan && !loading && (
        <div className="flex-1 flex items-center justify-center px-6 py-10 text-center">
          {backlogTasks.length === 0 ? (
            <p className="text-orange-500 text-sm">No backlog tasks to plan. Add tasks to the backlog first.</p>
          ) : (
            <p className="text-slate-400 dark:text-slate-500 text-sm">
              Set your sprint length and team size, then click Generate Plan.
            </p>
          )}
        </div>
      )}

      {err && (
        <div className="px-6 py-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border-t border-red-100 dark:border-red-800 flex-shrink-0">
          {err}
        </div>
      )}

      {/* Footer */}
      {plan && (
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-600 flex items-center justify-between flex-shrink-0">
          <p className="text-xs text-slate-400 dark:text-slate-500">
            {plan.length} sprint{plan.length !== 1 ? 's' : ''} · {plan.reduce((s, p) => s + p.taskIds.length, 0)} tasks
          </p>
          <div className="flex gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCommit} disabled={committing}>
              {committing ? 'Creating…' : 'Accept Plan'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
