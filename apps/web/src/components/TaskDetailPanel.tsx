import { useState } from 'react';
import type { Task, ToolSuggestion, Sprint, OrgUser, Comment, Activity, Label } from '../types';
import { statusLabel } from '../utils/taskHelpers';
import CommentSection from './CommentSection';
import ActivityFeed from './ActivityFeed';
import MarkdownRenderer from './shared/MarkdownRenderer';
import MarkdownEditor from './shared/MarkdownEditor';

function parseTools(raw?: string | null): ToolSuggestion[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as ToolSuggestion[]; } catch { return []; }
}

function parseDependsOn(raw?: string | null): string[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as string[]; } catch { return []; }
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
  onUpdateDependencies: (taskId: string, dependsOnIds: string[]) => void;
  onCreateComment: (content: string, parentCommentId?: string) => Promise<void>;
  onUpdateComment: (commentId: string, content: string) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
  onUpdateTask?: (taskId: string, updates: { description?: string; instructions?: string }) => Promise<void>;
  onArchiveTask?: (taskId: string, archived: boolean) => Promise<void>;
  labels?: Label[];
  onAddTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onRemoveTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
  onClose?: () => void;
  isDrawer?: boolean;
}

const priorityStyles: Record<string, string> = {
  critical: 'bg-red-100 text-red-700',
  high: 'bg-orange-100 text-orange-700',
  medium: 'bg-blue-100 text-blue-700',
  low: 'bg-slate-100 text-slate-500',
};

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h >= 8) return `${+(h / 8).toFixed(1)}d`;
  return `${h}h`;
}

function PanelContent({
  task, subtasks, editingTitle, editTitleValue, titleEditRef, generatingInstructions,
  sprints, orgUsers, statuses, allTasks, comments, activities, currentUserId, isAdmin,
  labels, onAddTaskLabel, onRemoveTaskLabel, onCreateLabel,
  disabled, onStartEditTitle, onTitleChange, onTitleSave, onTitleKeyDown,
  onStatusChange, onSubtaskStatusChange, onGenerateInstructions,
  onAssignSprint, onAssignUser, onDueDateChange, onUpdateDependencies,
  onCreateComment, onUpdateComment, onDeleteComment, onUpdateTask, onArchiveTask,
}: Omit<TaskDetailPanelProps, 'onClose' | 'isDrawer'>) {
  const tools = parseTools(task.suggestedTools);
  const depIds = parseDependsOn(task.dependsOn);
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [depSearch, setDepSearch] = useState('');
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6b7280');
  const [editingDescription, setEditingDescription] = useState(false);
  const [editDescValue, setEditDescValue] = useState('');
  const [editingInstructions, setEditingInstructions] = useState(false);
  const [editInstrValue, setEditInstrValue] = useState('');

  const availableTasks = allTasks.filter(
    (t) => t.taskId !== task.taskId && !t.parentTaskId && !depIds.includes(t.taskId)
  );
  const filteredAvailable = depSearch
    ? availableTasks.filter((t) => t.title.toLowerCase().includes(depSearch.toLowerCase()))
    : availableTasks;

  return (
    <div className="p-6 max-w-2xl">
      {/* Title */}
      <div className="mb-4">
        {editingTitle ? (
          <input
            ref={titleEditRef}
            type="text"
            value={editTitleValue}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleSave}
            onKeyDown={onTitleKeyDown}
            className="text-xl font-semibold text-slate-800 w-full border-b-2 border-slate-400 focus:outline-none bg-transparent"
            disabled={disabled}
          />
        ) : (
          <h2
            className="text-xl font-semibold text-slate-800 cursor-text hover:underline decoration-dashed"
            onClick={() => !disabled && onStartEditTitle(task)}
            title="Click to edit"
          >
            {task.title}
          </h2>
        )}
      </div>

      {/* Status */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.taskId, e.target.value)}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm"
          disabled={disabled}
        >
          {statuses.map((s) => (
            <option key={s} value={s}>{statusLabel(s)}</option>
          ))}
        </select>
      </div>

      {/* Sprint */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sprint</label>
        <select
          value={task.sprintId ?? ''}
          onChange={(e) => onAssignSprint(task.taskId, e.target.value || null)}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm"
          disabled={disabled}
        >
          <option value="">Backlog (unassigned)</option>
          {sprints.map((s) => (
            <option key={s.sprintId} value={s.sprintId}>
              {s.name}{s.isActive ? ' ★' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Assignee */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Assignee</label>
        <select
          value={task.assigneeId ?? ''}
          onChange={(e) => onAssignUser(task.taskId, e.target.value || null)}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm"
          disabled={disabled}
        >
          <option value="">Unassigned</option>
          {orgUsers.map((u) => (
            <option key={u.userId} value={u.userId}>{u.email}</option>
          ))}
        </select>
      </div>

      {/* Due Date */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Due Date</label>
        <input
          type="date"
          value={task.dueDate ?? ''}
          onChange={(e) => onDueDateChange(task.taskId, e.target.value || null)}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm w-full"
          disabled={disabled}
        />
      </div>

      {/* Metadata: priority + estimate */}
      {(task.priority !== 'medium' || task.estimatedHours != null) && (
        <div className="mb-4 flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${priorityStyles[task.priority] ?? priorityStyles.medium}`}>
            {task.priority}
          </span>
          {task.estimatedHours != null && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              ~{formatHours(task.estimatedHours)}
            </span>
          )}
        </div>
      )}

      {/* Labels */}
      {(onAddTaskLabel || (task.labels && task.labels.length > 0)) && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Labels</p>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {(task.labels ?? []).map((label) => (
              <span
                key={label.labelId}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                style={{ backgroundColor: label.color + '20', color: label.color, border: `1px solid ${label.color}40` }}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color }} />
                {label.name}
                {onRemoveTaskLabel && (
                  <button
                    onClick={() => onRemoveTaskLabel(task.taskId, label.labelId)}
                    className="ml-0.5 hover:opacity-70"
                    disabled={disabled}
                  >
                    ✕
                  </button>
                )}
              </span>
            ))}
          </div>
          {onAddTaskLabel && (
            showLabelPicker ? (
              <div className="mt-1">
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded mb-1">
                  {(labels ?? [])
                    .filter((l) => !(task.labels ?? []).some((tl) => tl.labelId === l.labelId))
                    .map((l) => (
                      <button
                        key={l.labelId}
                        onClick={() => {
                          onAddTaskLabel(task.taskId, l.labelId);
                          setShowLabelPicker(false);
                        }}
                        className="w-full text-left px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                      >
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                        {l.name}
                      </button>
                    ))}
                  {(labels ?? []).filter((l) => !(task.labels ?? []).some((tl) => tl.labelId === l.labelId)).length === 0 && (
                    <p className="text-xs text-slate-400 px-2 py-1">No more labels</p>
                  )}
                </div>
                {onCreateLabel && (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="color"
                      value={newLabelColor}
                      onChange={(e) => setNewLabelColor(e.target.value)}
                      className="w-6 h-6 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="New label…"
                      className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
                      onKeyDown={async (e) => {
                        if (e.key === 'Enter' && newLabelName.trim()) {
                          const label = await onCreateLabel(newLabelName.trim(), newLabelColor);
                          if (label) {
                            onAddTaskLabel(task.taskId, label.labelId);
                            setNewLabelName('');
                            setShowLabelPicker(false);
                          }
                        }
                      }}
                    />
                  </div>
                )}
                <button onClick={() => setShowLabelPicker(false)} className="text-xs text-slate-400 hover:text-slate-600 mt-1">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setShowLabelPicker(true)}
                className="text-xs text-slate-500 hover:text-slate-700"
                disabled={disabled}
              >
                + Add label
              </button>
            )
          )}
        </div>
      )}

      {/* Dependencies */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Dependencies</p>
        <div className="flex flex-wrap gap-1.5 mb-1">
          {depIds.map((id) => {
            const depTask = allTasks.find((t) => t.taskId === id);
            return (
              <span key={id} className="inline-flex items-center gap-1 text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                {depTask?.title ?? id.slice(0, 8)}
                <button
                  onClick={() => onUpdateDependencies(task.taskId, depIds.filter((d) => d !== id))}
                  className="text-slate-400 hover:text-red-500 ml-0.5"
                  disabled={disabled}
                >
                  ✕
                </button>
              </span>
            );
          })}
          {depIds.length === 0 && !showDepPicker && (
            <span className="text-xs text-slate-400">None</span>
          )}
        </div>
        {showDepPicker ? (
          <div>
            <input
              type="text"
              value={depSearch}
              onChange={(e) => setDepSearch(e.target.value)}
              placeholder="Search tasks…"
              className="w-full text-sm border border-slate-300 rounded px-2 py-1 mb-1 focus:outline-none focus:ring-1 focus:ring-slate-400"
              autoFocus
            />
            <div className="max-h-32 overflow-y-auto border border-slate-200 rounded">
              {filteredAvailable.slice(0, 10).map((t) => (
                <button
                  key={t.taskId}
                  onClick={() => {
                    onUpdateDependencies(task.taskId, [...depIds, t.taskId]);
                    setDepSearch('');
                    setShowDepPicker(false);
                  }}
                  className="w-full text-left px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                >
                  {t.title}
                </button>
              ))}
              {filteredAvailable.length === 0 && (
                <p className="text-xs text-slate-400 px-2 py-1">No tasks available</p>
              )}
            </div>
            <button onClick={() => setShowDepPicker(false)} className="text-xs text-slate-400 hover:text-slate-600 mt-1">Cancel</button>
          </div>
        ) : (
          <button
            onClick={() => setShowDepPicker(true)}
            className="text-xs text-slate-500 hover:text-slate-700"
            disabled={disabled}
          >
            + Add dependency
          </button>
        )}
      </div>

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

      {/* Suggested Tools */}
      {tools.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Suggested Tools</p>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool, i) => (
              <div key={i} className={`px-2.5 py-1.5 rounded-lg text-xs ${categoryColors[tool.category] ?? categoryColors.other}`}>
                <span className="font-semibold">{tool.name}</span>
                <span className="ml-1 opacity-60">· {tool.category}</span>
                {tool.reason && (
                  <p className="mt-0.5 opacity-75 font-normal">{tool.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtasks */}
      {subtasks.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Subtasks</p>
          <ul className="space-y-2">
            {subtasks.map((st) => (
              <li key={st.taskId} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{st.title}</p>
                  <select
                    value={st.status}
                    onChange={(e) =>
                      onSubtaskStatusChange(task.taskId, st.taskId, e.target.value)
                    }
                    className="text-xs border border-slate-300 rounded px-1.5 py-0.5 flex-shrink-0"
                    disabled={disabled}
                  >
                    {statuses.map((s) => (
                      <option key={s} value={s}>{statusLabel(s)}</option>
                    ))}
                  </select>
                </div>
                {st.description && (
                  <p className="text-xs text-slate-500 mt-1">{st.description}</p>
                )}
                {st.instructions && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer">Instructions</summary>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{st.instructions}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
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
