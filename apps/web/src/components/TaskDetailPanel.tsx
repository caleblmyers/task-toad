import { useState, useCallback, useEffect } from 'react';
import type { Task, Sprint, OrgUser, Comment, Activity, Label, CodeReview, Attachment, TaskActionPlan } from '../types';
import type { TaskTimeSummary } from '@tasktoad/shared-types';
import ActionProgressPanel from './ActionProgressPanel';
import { gql, TOKEN_KEY } from '../api/client';
import { TASK_ANCESTORS_QUERY } from '../api/queries';
import CommentSection from './CommentSection';
import ActivityFeed from './ActivityFeed';
import MarkdownRenderer from './shared/MarkdownRenderer';
import MarkdownEditor from './shared/MarkdownEditor';
import TaskTitleEditor from './taskdetail/TaskTitleEditor';
import TaskFieldsPanel from './taskdetail/TaskFieldsPanel';
import TaskGitHubSection from './taskdetail/TaskGitHubSection';
import TaskDependenciesSection from './taskdetail/TaskDependenciesSection';
import TaskSubtasksSection from './taskdetail/TaskSubtasksSection';
import TaskAIHistory from './taskdetail/TaskAIHistory';
import TaskAIReviewSection from './taskdetail/TaskAIReviewSection';
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

  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [editInstrValue, setEditInstrValue] = useState('');
  const [editingAC, setEditingAC] = useState(false);
  const [editACValue, setEditACValue] = useState('');
  const [uploading, setUploading] = useState(false);
  const [localAttachments, setLocalAttachments] = useState<Attachment[]>(task.attachments ?? []);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem(TOKEN_KEY);
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/uploads/${task.taskId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
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

  return (
    <div className="p-6 max-w-2xl">
      {ancestors.length > 0 && onSelectTask && (
        <nav className="mb-2 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
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
        disabled={disabled}
        onStartEdit={onStartEditTitle}
        onChange={onTitleChange}
        onSave={onTitleSave}
        onKeyDown={onTitleKeyDown}
        allTasks={allTasks}
      />

      <TaskFieldsPanel
        task={task}
        sprints={sprints}
        orgUsers={orgUsers}
        statuses={statuses}
        labels={labels}
        disabled={disabled}
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
        onLogTime={onLogTime}
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
              // The mutation builder in useTaskCRUD dynamically constructs from object keys
              (onUpdateTask as (taskId: string, updates: Record<string, unknown>) => Promise<void>)(
                task.taskId,
                { recurrenceRule: rule },
              );
            }
          }}
          disabled={disabled}
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

      <TaskGitHubSection
        task={task}
        projectHasRepo={projectHasRepo}
        disabled={disabled}
        onSyncToGitHub={onSyncToGitHub}
      />

      <TaskDependenciesSection
        task={task}
        allTasks={allTasks}
        disabled={disabled}
        onAddDependency={onAddDependency}
        onRemoveDependency={onRemoveDependency}
      />

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
          <div
            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded p-1 -m-1"
            onClick={() => { if (!disabled) { setEditDescValue(task.description ?? ''); setEditingDescription(true); } }}
            title="Click to edit"
          >
            <MarkdownRenderer content={task.description} />
          </div>
        ) : (
          <button
            onClick={() => { setEditDescValue(''); setEditingDescription(true); }}
            className="text-xs text-slate-500 hover:text-slate-600"
            disabled={disabled}
          >
            + Add description
          </button>
        )}
      </div>

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
                    disabled={disabled}
                    title="Delete attachment"
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <label className={`inline-flex items-center gap-1 text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${disabled || uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? 'Uploading…' : '+ Attach file'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={disabled || uploading} />
        </label>
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
          <div
            className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded p-1 -m-1"
            onClick={() => { if (!disabled) { setEditACValue(task.acceptanceCriteria ?? ''); setEditingAC(true); } }}
            title="Click to edit"
          >
            <MarkdownRenderer content={task.acceptanceCriteria} />
          </div>
        ) : (
          <button
            onClick={() => { setEditACValue(''); setEditingAC(true); }}
            className="text-xs text-slate-500 hover:text-slate-600"
            disabled={disabled}
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
          <div
            className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => { if (!disabled) { setEditInstrValue(task.instructions ?? ''); setEditingInstructions(true); } }}
            title="Click to edit"
          >
            <MarkdownRenderer content={task.instructions} />
          </div>
        ) : (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onGenerateInstructions(task)}
              disabled={disabled || generatingInstructions === task.taskId}
              className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 dark:text-slate-200"
            >
              {generatingInstructions === task.taskId ? 'Generating…' : '✦ Generate instructions'}
            </button>
            <button
              onClick={() => { setEditInstrValue(''); setEditingInstructions(true); }}
              className="text-xs text-slate-500 hover:text-slate-600 px-2"
              disabled={disabled}
            >
              Write manually
            </button>
          </div>
        )}
      </div>

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

      {/* Action button for leaf tasks (no subtasks, not epic/story) */}
      {subtasks.length === 0 && task.taskType !== 'epic' && task.taskType !== 'story' && task.instructions && onAutoComplete && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onAutoComplete(task)}
            disabled={disabled || autoCompleteLoading}
            className="px-3 py-1.5 text-sm border border-indigo-300 dark:border-indigo-600 text-indigo-700 dark:text-indigo-300 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/30 disabled:opacity-50"
          >
            {autoCompleteLoading ? 'Planning…' : '⚡ Auto-Complete'}
          </button>
        </div>
      )}

      <TaskSubtasksSection
        task={task}
        subtasks={subtasks}
        statuses={statuses}
        generatingInstructions={generatingInstructions}
        disabled={disabled}
        onSubtaskStatusChange={onSubtaskStatusChange}
        onGenerateInstructions={onGenerateInstructions}
        onCreateSubtask={onCreateSubtask}
        onAutoComplete={onAutoComplete}
        autoCompleteLoading={autoCompleteLoading}
      />

      {actionPlan && onCompleteManualAction && onSkipAction && onRetryAction && onCancelActionPlan && (
        <ActionProgressPanel
          plan={actionPlan}
          onCompleteManual={onCompleteManualAction}
          onSkip={onSkipAction}
          onRetry={onRetryAction}
          onCancel={onCancelActionPlan}
        />
      )}

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

      {/* Comments */}
      <div className="mb-4">
        <CommentSection
          comments={comments}
          currentUserId={currentUserId}
          isAdmin={isAdmin}
          orgUsers={orgUsers}
          onCreateComment={onCreateComment}
          onUpdateComment={onUpdateComment}
          onDeleteComment={onDeleteComment}
        />
      </div>

      {/* AI History */}
      <TaskAIHistory taskId={task.taskId} />

      {/* Activity */}
      <div>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Activity</p>
        <ActivityFeed activities={activities} />
      </div>

      {/* Archive / Unarchive */}
      {onArchiveTask && (
        <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            type="button"
            onClick={() => onArchiveTask(task.taskId, !task.archived)}
            disabled={disabled}
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
