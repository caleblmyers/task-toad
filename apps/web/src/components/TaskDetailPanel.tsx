import { useState } from 'react';
import type { Task, Sprint, OrgUser, Comment, Activity, Label } from '../types';
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

function parseTools(raw?: string | null): Array<{ name: string; category: string; reason?: string }> {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

const categoryColors: Record<string, string> = {
  'ai-model': 'bg-purple-100 text-purple-700',
  'code-editor': 'bg-blue-100 text-blue-700',
  'design-tool': 'bg-pink-100 text-pink-700',
  'database': 'bg-yellow-100 text-yellow-700',
  'cloud-service': 'bg-sky-100 text-sky-700',
  'communication': 'bg-green-100 text-green-700',
  'testing': 'bg-orange-100 text-orange-700',
  'other': 'bg-slate-100 text-slate-600',
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
  onGenerateCode?: (task: Task) => void;
  generatingCode?: string | null;
  onAssignSprint: (taskId: string, sprintId: string | null) => void;
  onAssignUser: (taskId: string, assigneeId: string | null) => void;
  onDueDateChange: (taskId: string, dueDate: string | null) => void;
  onUpdateDependencies: (taskId: string, dependsOnIds: string[]) => void;
  onCreateComment: (content: string, parentCommentId?: string) => Promise<void>;
  onUpdateComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onUpdateTask?: (taskId: string, updates: { description?: string; instructions?: string; acceptanceCriteria?: string; storyPoints?: number | null }) => Promise<void>;
  onArchiveTask?: (taskId: string, archived: boolean) => Promise<void>;
  labels?: Label[];
  onAddTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onRemoveTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
  onCreateSubtask?: (parentTaskId: string, title: string) => Promise<void>;
  onClose?: () => void;
  isDrawer?: boolean;
}

function PanelContent({
  task, subtasks, editingTitle, editTitleValue, titleEditRef, generatingInstructions,
  sprints, orgUsers, statuses, allTasks, comments, activities, currentUserId, isAdmin,
  labels, onAddTaskLabel, onRemoveTaskLabel, onCreateLabel,
  disabled, projectHasRepo, onSyncToGitHub,
  onStartEditTitle, onTitleChange, onTitleSave, onTitleKeyDown,
  onStatusChange, onSubtaskStatusChange, onGenerateInstructions, onGenerateCode, generatingCode,
  onAssignSprint, onAssignUser, onDueDateChange, onUpdateDependencies,
  onCreateComment, onUpdateComment, onDeleteComment, onUpdateTask, onArchiveTask,
  onCreateSubtask,
}: Omit<TaskDetailPanelProps, 'onClose' | 'isDrawer'>) {
  const tools = parseTools(task.suggestedTools);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [editInstrValue, setEditInstrValue] = useState('');
  const [editingAC, setEditingAC] = useState(false);
  const [editACValue, setEditACValue] = useState('');

  return (
    <div className="p-6 max-w-2xl">
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
        onStatusChange={onStatusChange}
        onAssignSprint={onAssignSprint}
        onAssignUser={onAssignUser}
        onDueDateChange={onDueDateChange}
        onUpdateTask={onUpdateTask}
        onAddTaskLabel={onAddTaskLabel}
        onRemoveTaskLabel={onRemoveTaskLabel}
        onCreateLabel={onCreateLabel}
      />

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
        onUpdateDependencies={onUpdateDependencies}
      />

      {/* Description */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Description</p>
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
            className="cursor-pointer hover:bg-slate-50 rounded p-1 -m-1"
            onClick={() => { if (!disabled) { setEditDescValue(task.description ?? ''); setEditingDescription(true); } }}
            title="Click to edit"
          >
            <MarkdownRenderer content={task.description} />
          </div>
        ) : (
          <button
            onClick={() => { setEditDescValue(''); setEditingDescription(true); }}
            className="text-xs text-slate-400 hover:text-slate-600"
            disabled={disabled}
          >
            + Add description
          </button>
        )}
      </div>

      {/* Acceptance Criteria */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
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
            className="cursor-pointer hover:bg-slate-50 rounded p-1 -m-1"
            onClick={() => { if (!disabled) { setEditACValue(task.acceptanceCriteria ?? ''); setEditingAC(true); } }}
            title="Click to edit"
          >
            <MarkdownRenderer content={task.acceptanceCriteria} />
          </div>
        ) : (
          <button
            onClick={() => { setEditACValue(''); setEditingAC(true); }}
            className="text-xs text-slate-400 hover:text-slate-600"
            disabled={disabled}
          >
            + Add acceptance criteria
          </button>
        )}
      </div>

      {/* Instructions */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Instructions</p>
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
            className="bg-slate-50 rounded-lg p-3 cursor-pointer hover:bg-slate-100"
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
              className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
            >
              {generatingInstructions === task.taskId ? 'Generating…' : '✦ Generate instructions'}
            </button>
            <button
              onClick={() => { setEditInstrValue(''); setEditingInstructions(true); }}
              className="text-xs text-slate-400 hover:text-slate-600 px-2"
              disabled={disabled}
            >
              Write manually
            </button>
          </div>
        )}
      </div>

      <TaskSubtasksSection
        task={task}
        subtasks={subtasks}
        statuses={statuses}
        generatingInstructions={generatingInstructions}
        generatingCode={generatingCode}
        disabled={disabled}
        onSubtaskStatusChange={onSubtaskStatusChange}
        onGenerateInstructions={onGenerateInstructions}
        onGenerateCode={onGenerateCode}
        onCreateSubtask={onCreateSubtask}
      />

      {/* Suggested Tools */}
      {tools.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Suggested Tools</p>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool, i) => (
              <div key={i} className={`px-2.5 py-1.5 rounded-lg text-xs ${categoryColors[tool.category] ?? categoryColors.other}`}>
                <span className="font-semibold">{tool.name}</span>
                <span className="ml-1 opacity-60">· {tool.category}</span>
                {tool.reason && <p className="mt-0.5 opacity-75 font-normal">{tool.reason}</p>}
              </div>
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
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Activity</p>
        <ActivityFeed activities={activities} />
      </div>

      {/* Archive / Unarchive */}
      {onArchiveTask && (
        <div className="mt-6 pt-4 border-t border-slate-200">
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
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
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
