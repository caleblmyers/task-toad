import { useState, useCallback, useEffect, useMemo } from 'react';
import type { Task, Sprint, OrgUser, Comment, Activity, Label, CodeReview, Attachment, TaskActionPlan } from '../types';
import type { TaskTimeSummary } from '@tasktoad/shared-types';
import ActionProgressPanel from './ActionProgressPanel';
import { gql } from '../api/client';
import { TASK_ANCESTORS_QUERY, TASK_INSIGHTS_QUERY, GENERATE_MANUAL_TASK_SPEC_MUTATION } from '../api/queries';
import ManualTaskSpecView from './taskdetail/ManualTaskSpecView';
import type { ManualTaskSpec } from './taskdetail/ManualTaskSpecView';
import CommentSection from './CommentSection';
import ActivityFeed from './ActivityFeed';
import MarkdownRenderer from './shared/MarkdownRenderer';
import MarkdownEditor from './shared/MarkdownEditor';
import Tabs from './shared/Tabs';
import TaskTitleEditor from './taskdetail/TaskTitleEditor';
import TaskFieldsPanel from './taskdetail/TaskFieldsPanel';
import TaskGitHubSection from './taskdetail/TaskGitHubSection';
import TaskDependenciesSection from './taskdetail/TaskDependenciesSection';
import TaskSubtasksSection from './taskdetail/TaskSubtasksSection';
import TaskAIHistory from './taskdetail/TaskAIHistory';
import TaskAIReviewSection from './taskdetail/TaskAIReviewSection';
import InsightPanel from './taskdetail/InsightPanel';
import type { TaskInsight } from './taskdetail/InsightPanel';
import Badge from './shared/Badge';

interface TaskAncestor {
  taskId: string;
  title: string;
  status: string;
  taskType: string;
}

function parseTools(raw?: string | null): Array<{ name: string; category: string; reason?: string }> {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

const categoryVariant: Record<string, 'purple' | 'info' | 'warning' | 'success' | 'accent' | 'neutral'> = {
  'ai-model': 'purple',
  'code-editor': 'info',
  'design-tool': 'purple',
  'database': 'warning',
  'cloud-service': 'info',
  'communication': 'success',
  'testing': 'accent',
  'other': 'neutral',
};

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
  onUpdateTask?: (taskId: string, updates: { description?: string; instructions?: string; acceptanceCriteria?: string; storyPoints?: number | null }) => Promise<void>;
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
  actionPlan?: TaskActionPlan | null;
  onCompleteManualAction?: (actionId: string) => Promise<void>;
  onSkipAction?: (actionId: string) => Promise<void>;
  onRetryAction?: (actionId: string) => Promise<void>;
  onCancelActionPlan?: (planId: string) => Promise<void>;
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
  onAutoComplete, autoCompleteLoading,
  actionPlan, onCompleteManualAction, onSkipAction, onRetryAction, onCancelActionPlan,
  timeSummary, onLogTime, onDeleteTimeEntry,
  onSelectTask,
}: Omit<TaskDetailPanelProps, 'onClose' | 'isDrawer'>) {
  // Disable editing when user lacks EDIT_TASKS permission
  const canEdit = canDo ? canDo('EDIT_TASKS') : true;
  const isDisabled = disabled || !canEdit;
  const tools = parseTools(task.suggestedTools);
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

  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [editInstrValue, setEditInstrValue] = useState('');
  const [editingAC, setEditingAC] = useState(false);
  const [editACValue, setEditACValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [localAttachments, setLocalAttachments] = useState<Attachment[]>(task.attachments ?? []);
  const [manualSpec, setManualSpec] = useState<ManualTaskSpec | null>(null);
  const [specLoading, setSpecLoading] = useState(false);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/uploads/${task.taskId}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (res.ok) {
        const attachment = await res.json() as Attachment;
        setLocalAttachments(prev => [attachment, ...prev]);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, [task.taskId]);

  const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
    try {
      await gql<{ deleteAttachment: boolean }>(
        `mutation($attachmentId: ID!) { deleteAttachment(attachmentId: $attachmentId) }`,
        { attachmentId },
      );
      setLocalAttachments(prev => prev.filter(a => a.attachmentId !== attachmentId));
    } catch { /* ignore */ }
  }, []);

  const detailsTab = (
    <section aria-labelledby="task-tab-details-heading">
      <h3 id="task-tab-details-heading" className="sr-only">Task Details</h3>

      <TaskFieldsPanel
        task={task}
        sprints={sprints}
        orgUsers={orgUsers}
        statuses={statuses}
        labels={labels}
        disabled={isDisabled}
        currentUserId={currentUserId}
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
        timeSummary={timeSummary}
        onLogTime={canDo && !canDo('LOG_TIME') ? undefined : onLogTime}
        onDeleteTimeEntry={onDeleteTimeEntry}
      />

      {/* Recurrence */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">
          {task.recurrenceRule && <span className="mr-1">↻</span>}Recurrence
        </p>
        <select
          value={task.recurrenceRule ?? ''}
          onChange={(e) => {
            const rule = e.target.value || null;
            if (onUpdateTask) {
              (onUpdateTask as (taskId: string, updates: Record<string, unknown>) => Promise<void>)(
                task.taskId,
                { recurrenceRule: rule },
              );
            }
          }}
          disabled={isDisabled}
          className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-800 dark:text-slate-200"
        >
          <option value="">None</option>
          <option value="0 9 * * *">Daily (9am)</option>
          <option value="0 9 * * 1">Weekly (Monday)</option>
          <option value="0 9 * * 5">Weekly (Friday)</option>
          <option value="0 9 1,15 * *">Biweekly (1st &amp; 15th)</option>
          <option value="0 9 1 * *">Monthly (1st)</option>
        </select>
      </div>

      {/* Description */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Description</p>
        {editingDescription ? (
          <MarkdownEditor
            value={editDescValue}
            onChange={setEditDescValue}
            onSave={async () => {
              if (onUpdateTask) await onUpdateTask(task.taskId, { description: editDescValue });
              setEditingDescription(false);
            }}
            onCancel={() => setEditingDescription(false)}
            placeholder="Add a description…"
            rows={4}
          />
        ) : task.description ? (
          <button
            type="button"
            className="w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded p-1 -m-1"
            onClick={() => { if (!isDisabled) { setEditDescValue(task.description ?? ''); setEditingDescription(true); } }}
            disabled={isDisabled}
            aria-label="Edit description"
          >
            <MarkdownRenderer content={task.description} />
          </button>
        ) : (
          <button
            onClick={() => { setEditDescValue(''); setEditingDescription(true); }}
            className="text-xs text-slate-500 hover:text-slate-600"
            disabled={isDisabled}
          >
            + Add description
          </button>
        )}
      </div>

      {/* Acceptance Criteria */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">
          <span className="mr-1">&#10003;</span>Acceptance Criteria
        </p>
        {editingAC ? (
          <MarkdownEditor
            value={editACValue}
            onChange={setEditACValue}
            onSave={async () => {
              if (onUpdateTask) await onUpdateTask(task.taskId, { acceptanceCriteria: editACValue });
              setEditingAC(false);
            }}
            onCancel={() => setEditingAC(false)}
            placeholder="Add acceptance criteria…"
            rows={4}
          />
        ) : task.acceptanceCriteria ? (
          <button
            type="button"
            className="w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded p-1 -m-1"
            onClick={() => { if (!isDisabled) { setEditACValue(task.acceptanceCriteria ?? ''); setEditingAC(true); } }}
            disabled={isDisabled}
            aria-label="Edit acceptance criteria"
          >
            <MarkdownRenderer content={task.acceptanceCriteria} />
          </button>
        ) : (
          <button
            onClick={() => { setEditACValue(''); setEditingAC(true); }}
            className="text-xs text-slate-500 hover:text-slate-600"
            disabled={isDisabled}
          >
            + Add acceptance criteria
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Instructions</p>
        {editingInstructions ? (
          <MarkdownEditor
            value={editInstrValue}
            onChange={setEditInstrValue}
            onSave={async () => {
              if (onUpdateTask) await onUpdateTask(task.taskId, { instructions: editInstrValue });
              setEditingInstructions(false);
            }}
            onCancel={() => setEditingInstructions(false)}
            placeholder="Add instructions…"
            rows={6}
          />
        ) : task.instructions ? (
          <button
            type="button"
            className="w-full text-left bg-slate-50 dark:bg-slate-800 rounded-lg p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => { if (!isDisabled) { setEditInstrValue(task.instructions ?? ''); setEditingInstructions(true); } }}
            disabled={isDisabled}
            aria-label="Edit instructions"
          >
            <MarkdownRenderer content={task.instructions} />
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onGenerateInstructions(task)}
              disabled={isDisabled || generatingInstructions === task.taskId}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 dark:text-slate-200"
            >
              {generatingInstructions === task.taskId ? 'Generating…' : '✦ Generate instructions'}
            </button>
            <button
              onClick={() => { setEditInstrValue(''); setEditingInstructions(true); }}
              className="text-xs text-slate-500 hover:text-slate-600 px-2"
              disabled={isDisabled}
            >
              Write manually
            </button>
          </div>
        )}
        {task.instructions && !editingInstructions && (
          <ManualTaskSpecView
            spec={manualSpec}
            loading={specLoading}
            onGenerate={async () => {
              setSpecLoading(true);
              try {
                const data = await gql<{ generateManualTaskSpec: ManualTaskSpec }>(
                  GENERATE_MANUAL_TASK_SPEC_MUTATION,
                  { taskId: task.taskId }
                );
                setManualSpec(data.generateManualTaskSpec);
              } catch {
                // silently fail — button stays available
              } finally {
                setSpecLoading(false);
              }
            }}
          />
        )}
      </div>

      <TaskGitHubSection
        task={task}
        projectHasRepo={projectHasRepo}
        disabled={isDisabled}
        onSyncToGitHub={onSyncToGitHub}
      />
    </section>
  );

  const activityTab = (
    <section aria-labelledby="task-tab-activity-heading">
      <h3 id="task-tab-activity-heading" className="sr-only">Activity</h3>

      <div className="mb-4">
        <CommentSection
          comments={comments}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          orgUsers={orgUsers}
          onCreateComment={onCreateComment}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
          disabled={canDo ? !canDo('CREATE_COMMENTS') : false}
        />
      </div>

      <TaskAIHistory taskId={task.taskId} />

      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Activity</p>
        <ActivityFeed activities={activities} />
      </div>
    </section>
  );

  const relationsTab = (
    <section aria-labelledby="task-tab-relations-heading">
      <h3 id="task-tab-relations-heading" className="sr-only">Relations</h3>

      <TaskDependenciesSection
        task={task}
        allTasks={allTasks}
        disabled={isDisabled}
        onAddDependency={onAddDependency}
        onRemoveDependency={onRemoveDependency}
      />

      <TaskSubtasksSection
        task={task}
        subtasks={subtasks}
        statuses={statuses}
        generatingInstructions={generatingInstructions}
        disabled={isDisabled}
        onSubtaskStatusChange={onSubtaskStatusChange}
        onGenerateInstructions={onGenerateInstructions}
        onCreateSubtask={onCreateSubtask}
        onAutoComplete={onAutoComplete}
        autoCompleteLoading={autoCompleteLoading}
      />

      {/* Attachments */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Attachments</p>
        {localAttachments.length > 0 && (
          <ul className="space-y-1 mb-2">
            {localAttachments.map(a => (
              <li key={a.attachmentId} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 rounded px-2 py-1">
                <a
                  href={`/api/uploads/${a.attachmentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline truncate mr-2"
                >
                  {a.fileName}
                </a>
                <span className="flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
                  {a.sizeBytes < 1024 ? `${a.sizeBytes} B` : a.sizeBytes < 1048576 ? `${(a.sizeBytes / 1024).toFixed(1)} KB` : `${(a.sizeBytes / 1048576).toFixed(1)} MB`}
                  <button
                    onClick={() => handleDeleteAttachment(a.attachmentId)}
                    className="text-red-400 hover:text-red-600"
                    disabled={isDisabled}
                    aria-label={`Delete attachment ${a.fileName}`}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <label className={`inline-flex items-center gap-1 text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${isDisabled || uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? 'Uploading…' : '+ Attach file'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={isDisabled || uploading} />
        </label>
      </div>

      {/* Suggested Tools */}
      {tools.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Suggested Tools</p>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool, i) => (
              <Badge key={i} variant={categoryVariant[tool.category] ?? 'neutral'} className="px-2.5 py-1.5 rounded-lg">
                <span className="font-semibold">{tool.name}</span>
                <span className="ml-1 opacity-60">· {tool.category}</span>
                {tool.reason && <p className="mt-0.5 opacity-75 font-normal">{tool.reason}</p>}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );

  const actionsTab = (
    <section aria-labelledby="task-tab-actions-heading">
      <h3 id="task-tab-actions-heading" className="sr-only">Actions</h3>

      {/* AI Review */}
      {onReviewPR && task.pullRequests && task.pullRequests.length > 0 && (
        <div className="mb-4">
          <button
            type="button"
            onClick={() => onReviewPR(task.taskId, task.pullRequests![0].prNumber)}
            disabled={isDisabled || reviewLoading}
            className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 dark:text-slate-200"
          >
            {reviewLoading ? 'Reviewing…' : '✦ AI Review'}
          </button>
        </div>
      )}

      <TaskAIReviewSection review={reviewResult ?? null} loading={reviewLoading ?? false} />

      {/* Auto-Complete for leaf tasks */}
      {subtasks.length === 0 && task.taskType !== 'epic' && task.taskType !== 'story' && task.instructions && onAutoComplete && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAutoComplete(task)}
            disabled={isDisabled || autoCompleteLoading}
            className="px-3 py-1.5 text-sm border border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50"
          >
            {autoCompleteLoading ? 'Planning…' : '⚡ Auto-Complete'}
          </button>
        </div>
      )}

      {actionPlan && onCompleteManualAction && onSkipAction && onRetryAction && onCancelActionPlan && (
        <ActionProgressPanel
          plan={actionPlan}
          onCompleteManual={onCompleteManualAction}
          onSkip={onSkipAction}
          onRetry={onRetryAction}
          onCancel={onCancelActionPlan}
        />
      )}

      {/* Archive / Unarchive */}
      {onArchiveTask && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => onArchiveTask(task.taskId, !task.archived)}
            disabled={isDisabled || (canDo ? !canDo('DELETE_TASKS') : false)}
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

  // Fetch insights for tab badge count + pass to InsightPanel
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

  const insightsTab = showInsightsTab ? (
    <section className="space-y-4">
      <InsightPanel
        projectId={task.projectId}
        taskId={task.taskId}
        initialInsights={fetchedInsights}
        onApplyInsight={onUpdateTask ? handleApplyInsight : undefined}
      />
    </section>
  ) : null;

  const insightsLabel = insightCount > 0
    ? `Insights (${insightCount})`
    : 'Insights';

  const tabs = useMemo(() => {
    const result = [
      { id: 'details', label: 'Details', content: detailsTab },
      { id: 'activity', label: 'Activity', content: activityTab },
      { id: 'relations', label: 'Relations', content: relationsTab },
      { id: 'actions', label: 'Actions', content: actionsTab },
    ];
    if (showInsightsTab && insightsTab) {
      result.push({ id: 'insights', label: insightsLabel, content: insightsTab });
    }
    return result;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    task, subtasks, editingTitle, editTitleValue, generatingInstructions,
    sprints, orgUsers, statuses, allTasks, comments, activities, labels,
    disabled, projectHasRepo, editingDescription, editDescValue,
    editingInstructions, editInstrValue, editingAC, editACValue,
    uploading, localAttachments, reviewResult, reviewLoading,
    autoCompleteLoading, actionPlan, timeSummary, tools.length, ancestors,
    showInsightsTab, insightCount, fetchedInsights, manualSpec, specLoading,
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
