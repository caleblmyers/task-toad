import { useState } from 'react';
import type { Task, Sprint, OrgUser, Label } from '../../types';
import { statusLabel } from '../../utils/taskHelpers';
import TaskCustomFieldsSection from './TaskCustomFieldsSection';

interface TaskFieldsPanelProps {
  task: Task;
  sprints: Sprint[];
  orgUsers: OrgUser[];
  statuses: string[];
  labels?: Label[];
  disabled?: boolean;
  onStatusChange: (taskId: string, status: string) => void;
  onAssignSprint: (taskId: string, sprintId: string | null) => void;
  onAssignUser: (taskId: string, assigneeId: string | null) => void;
  onDueDateChange: (taskId: string, dueDate: string | null) => void;
  onUpdateTask?: (taskId: string, updates: { storyPoints?: number | null }) => Promise<void>;
  onAddTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onRemoveTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
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

export default function TaskFieldsPanel({
  task,
  sprints,
  orgUsers,
  statuses,
  labels,
  disabled,
  onStatusChange,
  onAssignSprint,
  onAssignUser,
  onDueDateChange,
  onUpdateTask,
  onAddTaskLabel,
  onRemoveTaskLabel,
  onCreateLabel,
}: TaskFieldsPanelProps) {
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6b7280');

  return (
    <>
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

      {/* Story Points */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Story Points</label>
        <input
          type="number"
          min={0}
          max={100}
          value={task.storyPoints ?? ''}
          onChange={(e) => {
            const val = e.target.value === '' ? null : parseInt(e.target.value, 10);
            if (onUpdateTask && (val === null || !isNaN(val))) {
              onUpdateTask(task.taskId, { storyPoints: val });
            }
          }}
          placeholder="—"
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm w-24"
          disabled={disabled}
        />
      </div>

      {/* Custom Fields */}
      <TaskCustomFieldsSection
        taskId={task.taskId}
        projectId={task.projectId}
        customFieldValues={(task as Task & { customFieldValues?: Array<{ customFieldValueId: string; field: { customFieldId: string; name: string; fieldType: string; options: string | null; required: boolean; position: number }; value: string }> }).customFieldValues}
        disabled={disabled}
      />

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
    </>
  );
}
