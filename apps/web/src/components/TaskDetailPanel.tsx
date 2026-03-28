import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Task, Sprint, OrgUser, Comment, Activity, Label, CodeReview, TaskActionPlan } from '../types';
import type { TaskTimeSummary } from '@tasktoad/shared-types';
import { gql } from '../api/client';
import { TASK_ANCESTORS_QUERY, TASK_INSIGHTS_QUERY } from '../api/queries';
import Tabs from './shared/Tabs';
import TaskTitleEditor from './taskdetail/TaskTitleEditor';
import type { TaskInsight } from './taskdetail/InsightPanel';
import DetailsTab from './taskdetail/DetailsTab';
import ActivityTab from './taskdetail/ActivityTab';
import RelationsTab from './taskdetail/RelationsTab';
import ActionsTab from './taskdetail/ActionsTab';
import InsightsTab from './taskdetail/InsightsTab';

interface TaskAncestor {
  taskId: string;
  title: string;
  status: string;
  taskType: string;
}

export interface TaskDetailPanelProps {
  task: Task;
  subtasks: Task[];
  editingTitle: boolean;
  editTitleValue: string;
  titleEditRef: React.RefObject<HTMLInputElement>;
  generatingInstructions: string | null;
  sprints: Sprint[];
  orgUsers: OrgUser[];
  statuses: string[];
  allTasks: Task[];
  comments: Comment[];
  activities: Activity[];
  currentUserId: string;
  isAdmin: boolean;
  can?: (permission: string) => boolean;
  disabled?: boolean;
  projectHasRepo?: boolean;
  onSyncToGitHub?: (taskId: string) => Promise<void>;
  onStartEditTitle: (task: Task) => void;
  onTitleChange: (val: string) => void;
  onTitleSave: () => void;
  onTitleKeyDown: (e: React.KeyboardEvent) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onSubtaskStatusChange: (parentId: string, taskId: string, status: string) => void;
  onGenerateInstructions: (task: Task) => void;
  onAssignSprint: (taskId: string, sprintId: string | null) => void;
  onAssignUser: (taskId: string, assigneeId: string | null) => void;
  onDueDateChange: (taskId: string, dueDate: string | null) => void;
  onAddDependency: (sourceTaskId: string, targetTaskId: string, linkType: string) => Promise<void>;
  onRemoveDependency: (taskDependencyId: string) => Promise<void>;
  onCreateComment: (content: string, parentCommentId?: string) => Promise<void>;
  onUpdateComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onUpdateTask?: (taskId: string, updates: { description?: string; instructions?: string; acceptanceCriteria?: string; storyPoints?: number | null; priority?: string }) => Promise<void>;
  onArchiveTask?: (taskId: string, archived: boolean) => Promise<void>;
  labels?: Label[];
  onAddTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onRemoveTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
  onAddWatcher?: (taskId: string, userId: string) => Promise<void>;
  onRemoveWatcher?: (taskId: string, userId: string) => Promise<void>;
  onCreateSubtask?: (parentTaskId: string, title: string) => Promise<void>;
  onReviewPR?: (taskId: string, prNumber: number) => Promise<CodeReview | null>;
  reviewResult?: CodeReview | null;
  reviewLoading?: boolean;
  onClose?: () => void;
  isDrawer?: boolean;
  onAutoComplete?: (task: Task) => void;
  autoCompleteLoading?: boolean;
  loadingMessage?: string | null;
  actionPlan?: TaskActionPlan | null;
  onCompleteManualAction?: (actionId: string) => Promise<void>;
  onSkipAction?: (actionId: string) => Promise<void>;
  onRetryAction?: (actionId: string) => Promise<void>;
  onCancelActionPlan?: (planId: string) => Promise<void>;
  onExecuteActionPlan?: (planId: string) => Promise<void>;
  timeSummary?: TaskTimeSummary | null;
  onLogTime?: (taskId: string, durationMinutes: number, loggedDate: string, description?: string, billable?: boolean) => Promise<unknown>;
  onDeleteTimeEntry?: (timeEntryId: string, taskId: string) => Promise<void>;
  onSelectTask?: (task: Task) => void;
}

function PanelContent({
  task, subtasks, editingTitle, editTitleValue, titleEditRef, generatingInstructions,
  sprints, orgUsers, statuses, allTasks, comments, activities, currentUserId, isAdmin,
  can: canDo,
  labels, onAddTaskLabel, onRemoveTaskLabel, onCreateLabel,
  disabled, projectHasRepo, onSyncToGitHub,
  onStartEditTitle, onTitleChange, onTitleSave, onTitleKeyDown,
  onStatusChange, onSubtaskStatusChange, onGenerateInstructions,
  onAssignSprint, onAssignUser, onDueDateChange, onAddDependency, onRemoveDependency,
  onCreateComment, onUpdateComment, onDeleteComment, onUpdateTask, onArchiveTask,
  onAddWatcher, onRemoveWatcher,
  onCreateSubtask,
  onReviewPR, reviewResult, reviewLoading,
  onAutoComplete, autoCompleteLoading, loadingMessage,
  actionPlan, onCompleteManualAction, onSkipAction, onRetryAction, onCancelActionPlan, onExecuteActionPlan,
  timeSummary, onLogTime, onDeleteTimeEntry,
  onSelectTask,
}: Omit<TaskDetailPanelProps, 'onClose' | 'isDrawer'>) {
  const canEdit = canDo ? canDo('EDIT_TASKS') : true;
  const isDisabled = disabled || !canEdit;
  const [ancestors, setAncestors] = useState<TaskAncestor[]>([]);

  useEffect(() => {
    if (!task.parentTaskId) {
      setAncestors([]);
      return;
    }
    let cancelled = false;
    gql<{ taskAncestors: TaskAncestor[] }>(TASK_ANCESTORS_QUERY, { taskId: task.taskId })
      .then((data) => { if (!cancelled) setAncestors(data.taskAncestors); })
      .catch(() => { if (!cancelled) setAncestors([]); });
    return () => { cancelled = true; };
  }, [task.taskId, task.parentTaskId]);

  const [insightCount, setInsightCount] = useState(0);
  const [fetchedInsights, setFetchedInsights] = useState<TaskInsight[]>([]);

  // Fetch insights for tab badge count
  useEffect(() => {
    if (!task.autoComplete) {
      setInsightCount(0);
      setFetchedInsights([]);
      return;
    }
    let cancelled = false;
    gql<{ taskInsights: TaskInsight[] }>(TASK_INSIGHTS_QUERY, { projectId: task.projectId, taskId: task.taskId })
      .then((data) => {
        if (!cancelled) {
          setInsightCount(data.taskInsights.length);
          setFetchedInsights(data.taskInsights);
        }
      })
      .catch(() => { if (!cancelled) { setInsightCount(0); setFetchedInsights([]); } });
    return () => { cancelled = true; };
  }, [task.taskId, task.projectId, task.autoComplete]);

  const handleApplyInsight = useCallback((insight: TaskInsight) => {
    if (onUpdateTask) {
      void onUpdateTask(task.taskId, {
        instructions: (task.instructions || '') + '\n\n---\nInsight: ' + insight.content,
      });
    }
  }, [task.taskId, task.instructions, onUpdateTask]);

  const showInsightsTab = task.autoComplete || insightCount > 0;

  const insightsLabel = insightCount > 0
    ? `Insights (${insightCount})`
    : 'Insights';

  const tabs = useMemo(() => {
    const result = [
      {
        id: 'details',
        label: 'Details',
        content: (
          <DetailsTab
            task={task}
            sprints={sprints}
            orgUsers={orgUsers}
            statuses={statuses}
            labels={labels}
            disabled={isDisabled}
            currentUserId={currentUserId}
            generatingInstructions={generatingInstructions}
            projectHasRepo={projectHasRepo}
            can={canDo}
            onStatusChange={onStatusChange}
            onAssignSprint={onAssignSprint}
            onAssignUser={onAssignUser}
            onDueDateChange={onDueDateChange}
            onUpdateTask={onUpdateTask}
            onAddTaskLabel={onAddTaskLabel}
            onRemoveTaskLabel={onRemoveTaskLabel}
            onCreateLabel={onCreateLabel}
            onAddWatcher={onAddWatcher}
            onRemoveWatcher={onRemoveWatcher}
            onGenerateInstructions={onGenerateInstructions}
            onSyncToGitHub={onSyncToGitHub}
            timeSummary={timeSummary}
            onLogTime={onLogTime}
            onDeleteTimeEntry={onDeleteTimeEntry}
          />
        ),
      },
      {
        id: 'activity',
        label: 'Activity',
        content: (
          <ActivityTab
            taskId={task.taskId}
            comments={comments}
            activities={activities}
            currentUserId={currentUserId}
            isAdmin={isAdmin}
            orgUsers={orgUsers}
            onCreateComment={onCreateComment}
            onUpdateComment={onUpdateComment}
            onDeleteComment={onDeleteComment}
            commentsDisabled={canDo ? !canDo('CREATE_COMMENTS') : false}
          />
        ),
      },
      {
        id: 'relations',
        label: 'Relations',
        content: (
          <RelationsTab
            task={task}
            subtasks={subtasks}
            statuses={statuses}
            allTasks={allTasks}
            disabled={isDisabled}
            generatingInstructions={generatingInstructions}
            onAddDependency={onAddDependency}
            onRemoveDependency={onRemoveDependency}
            onSubtaskStatusChange={onSubtaskStatusChange}
            onGenerateInstructions={onGenerateInstructions}
            onCreateSubtask={onCreateSubtask}
            onAutoComplete={onAutoComplete}
            autoCompleteLoading={autoCompleteLoading}
          />
        ),
      },
      {
        id: 'actions',
        label: 'Actions',
        content: (
          <ActionsTab
            task={task}
            subtasks={subtasks}
            disabled={isDisabled}
            can={canDo}
            onReviewPR={onReviewPR}
            reviewResult={reviewResult}
            reviewLoading={reviewLoading}
            onAutoComplete={onAutoComplete}
            autoCompleteLoading={autoCompleteLoading}
            loadingMessage={loadingMessage}
            actionPlan={actionPlan}
            onCompleteManualAction={onCompleteManualAction}
            onSkipAction={onSkipAction}
            onRetryAction={onRetryAction}
            onCancelActionPlan={onCancelActionPlan}
            onExecuteActionPlan={onExecuteActionPlan}
            onArchiveTask={onArchiveTask}
          />
        ),
      },
    ];
    if (showInsightsTab) {
      result.push({
        id: 'insights',
        label: insightsLabel,
        content: (
          <InsightsTab
            projectId={task.projectId}
            taskId={task.taskId}
            fetchedInsights={fetchedInsights}
            onApplyInsight={onUpdateTask ? handleApplyInsight : undefined}
          />
        ),
      });
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    task, subtasks, editingTitle, editTitleValue, generatingInstructions,
    sprints, orgUsers, statuses, allTasks, comments, activities, labels,
    disabled, projectHasRepo, reviewResult, reviewLoading,
    autoCompleteLoading, actionPlan, timeSummary, ancestors,
    showInsightsTab, insightCount, fetchedInsights,
  ]);

  return (
    <div className="p-6 max-w-2xl">
      {ancestors.length > 0 && onSelectTask && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap" aria-label="Task hierarchy">
          {ancestors.map((ancestor, i) => (
            <span key={ancestor.taskId} className="flex items-center gap-1">
              {i > 0 && <span className="text-slate-300 dark:text-slate-600">›</span>}
              <button
                type="button"
                onClick={() => onSelectTask({ taskId: ancestor.taskId, title: ancestor.title, status: ancestor.status, taskType: ancestor.taskType } as unknown as Task)}
                className="hover:text-slate-700 dark:hover:text-slate-200 hover:underline truncate max-w-[150px]"
              >
                {ancestor.title}
              </button>
            </span>
          ))}
          <span className="text-slate-300 dark:text-slate-600">›</span>
          <span className="text-slate-700 dark:text-slate-200 font-medium truncate max-w-[150px]">{task.title}</span>
        </nav>
      )}
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <TaskTitleEditor
            task={task}
            editingTitle={editingTitle}
            editTitleValue={editTitleValue}
            titleEditRef={titleEditRef}
            disabled={isDisabled}
            onStartEdit={onStartEditTitle}
            onChange={onTitleChange}
            onSave={onTitleSave}
            onKeyDown={onTitleKeyDown}
            allTasks={allTasks}
          />
        </div>
      </div>

      <Tabs tabs={tabs} defaultTab="details" ariaLabel="Task detail sections" />
    </div>
  );
}

export default function TaskDetailPanel(props: TaskDetailPanelProps) {
  const { onClose, isDrawer: _isDrawer = false, ...contentProps } = props;

  return (
    <>
      {onClose && (
        <div className="flex items-center justify-end px-4 pt-4 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
      <PanelContent {...contentProps} />
    </>
  );
}
