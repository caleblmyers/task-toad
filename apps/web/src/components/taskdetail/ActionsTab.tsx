import type { Task, CodeReview, TaskActionPlan } from '../../types';
import ActionProgressPanel from '../ActionProgressPanel';
import TaskAIReviewSection from './TaskAIReviewSection';

export interface ActionsTabProps {
  task: Task;
  subtasks: Task[];
  disabled: boolean;
  can?: (permission: string) => boolean;
  onReviewPR?: (taskId: string, prNumber: number) => Promise<CodeReview | null>;
  reviewResult?: CodeReview | null;
  reviewLoading?: boolean;
  onAutoComplete?: (task: Task) => void;
  autoCompleteLoading?: boolean;
  loadingMessage?: string | null;
  actionPlan?: TaskActionPlan | null;
  onCompleteManualAction?: (actionId: string) => Promise<void>;
  onSkipAction?: (actionId: string) => Promise<void>;
  onRetryAction?: (actionId: string) => Promise<void>;
  onCancelActionPlan?: (planId: string) => Promise<void>;
  onExecuteActionPlan?: (planId: string) => Promise<void>;
  onArchiveTask?: (taskId: string, archived: boolean) => Promise<void>;
}

export default function ActionsTab({
  task, subtasks, disabled, can: canDo,
  onReviewPR, reviewResult, reviewLoading,
  onAutoComplete, autoCompleteLoading, loadingMessage,
  actionPlan, onCompleteManualAction, onSkipAction, onRetryAction, onCancelActionPlan, onExecuteActionPlan,
  onArchiveTask,
}: ActionsTabProps) {
  return (
    <section aria-labelledby="task-tab-actions-heading">
      <h3 id="task-tab-actions-heading" className="sr-only">Actions</h3>

      {/* AI Review */}
      {onReviewPR && task.pullRequests && task.pullRequests.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => onReviewPR(task.taskId, task.pullRequests![0].prNumber)}
            disabled={disabled || reviewLoading}
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 dark:text-slate-200"
          >
            {reviewLoading ? 'Reviewing…' : '✦ AI Review'}
          </button>
        </div>
      )}

      <TaskAIReviewSection review={reviewResult ?? null} loading={reviewLoading ?? false} />

      {/* Auto-Complete for leaf tasks — hidden when a plan exists in an active/terminal state */}
      {subtasks.length === 0 && task.taskType !== 'epic' && task.taskType !== 'story' && task.instructions && onAutoComplete && (
        !actionPlan || actionPlan.status === 'failed'
      ) && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAutoComplete(task)}
            disabled={disabled || autoCompleteLoading}
            className="px-3 py-1.5 text-sm border border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50"
          >
            {autoCompleteLoading ? 'Planning…' : '⚡ Auto-Complete'}
          </button>
          {autoCompleteLoading && loadingMessage && (
            <p className="text-xs text-indigo-600 dark:text-indigo-400 mt-1">{loadingMessage}</p>
          )}
        </div>
      )}

      {actionPlan && onCompleteManualAction && onSkipAction && onRetryAction && onCancelActionPlan && (
        <ActionProgressPanel
          plan={actionPlan}
          onCompleteManual={onCompleteManualAction}
          onSkip={onSkipAction}
          onRetry={onRetryAction}
          onCancel={onCancelActionPlan}
          onExecute={onExecuteActionPlan}
        />
      )}

      {/* Archive / Unarchive */}
      {onArchiveTask && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => onArchiveTask(task.taskId, !task.archived)}
            disabled={disabled || (canDo ? !canDo('DELETE_TASKS') : false)}
            title={canDo && !canDo('DELETE_TASKS') ? "You don't have permission to archive tasks" : undefined}
            className={`text-sm px-3 py-1.5 rounded border ${
              task.archived
                ? 'text-slate-600 border-slate-300 hover:bg-slate-50'
                : 'text-red-600 border-red-200 hover:bg-red-50'
            } disabled:opacity-50`}
          >
            {task.archived ? 'Unarchive task' : 'Archive task'}
          </button>
        </div>
      )}
    </section>
  );
}
