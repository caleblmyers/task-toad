import { useState } from 'react';
import type { Task, Sprint, OrgUser, Label } from '../../types';
import type { TaskTimeSummary } from '@tasktoad/shared-types';
import { statusLabel } from '../../utils/taskHelpers';
import TaskCustomFieldsSection from './TaskCustomFieldsSection';
import TimeEntryList from './TimeEntryList';

interface TaskFieldsPanelProps {
  task: Task;
  sprints: Sprint[];
  orgUsers: OrgUser[];
  statuses: string[];
  labels?: Label[];
  disabled?: boolean;
  currentUserId?: string;
  onStatusChange: (taskId: string, status: string) => void;
  onAssignSprint: (taskId: string, sprintId: string | null) => void;
  onAssignUser: (taskId: string, assigneeId: string | null) => void;
  onDueDateChange: (taskId: string, dueDate: string | null) => void;
  onUpdateTask?: (taskId: string, updates: { storyPoints?: number | null; priority?: string }) => Promise<void>;
  onAddTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onRemoveTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
  onAddAssignee?: (taskId: string, userId: string) => Promise<void>;
  onRemoveAssignee?: (taskId: string, userId: string) => Promise<void>;
  onAddWatcher?: (taskId: string, userId: string) => Promise<void>;
  onRemoveWatcher?: (taskId: string, userId: string) => Promise<void>;
  timeSummary?: TaskTimeSummary | null;
  onLogTime?: (taskId: string, durationMinutes: number, loggedDate: string, description?: string, billable?: boolean) => Promise<unknown>;
  onDeleteTimeEntry?: (timeEntryId: string, taskId: string) => Promise<void>;
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h >= 8) return `${+(h / 8).toFixed(1)}d`;
  return `${h}h`;
}

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function TaskFieldsPanel({
  task,
  sprints,
  orgUsers,
  statuses,
  labels,
  disabled,
  currentUserId,
  onStatusChange,
  onAssignSprint,
  onAssignUser,
  onDueDateChange,
  onUpdateTask,
  onAddTaskLabel,
  onRemoveTaskLabel,
  onCreateLabel,
  onAddAssignee,
  onRemoveAssignee,
  onAddWatcher,
  onRemoveWatcher,
  timeSummary,
  onLogTime,
  onDeleteTimeEntry,
}: TaskFieldsPanelProps) {
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showWatcherPicker, setShowWatcherPicker] = useState(false);
  const [showLabelPicker, setShowLabelPicker] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#6b7280');
  const [showLogTime, setShowLogTime] = useState(false);
  const [logHours, setLogHours] = useState('');
  const [logMinutes, setLogMinutes] = useState('');
  const [logDate, setLogDate] = useState(new Date().toISOString().slice(0, 10));
  const [logDescription, setLogDescription] = useState('');
  const [logBillable, setLogBillable] = useState(false);
  const [logSubmitting, setLogSubmitting] = useState(false);

  return (
    <>
      {/* Status */}
      <div className="mb-4">
        <label htmlFor="task-status-select" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
        <select
          id="task-status-select"
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
        <label htmlFor="task-sprint-select" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sprint</label>
        <select
          id="task-sprint-select"
          value={task.sprintId ?? ''}
          onChange={(e) => onAssignSprint(task.taskId, e.target.value || null)}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm"
          disabled={disabled}
        >
          <option value="">Backlog (unassigned)</option>
          {sprints
            .filter((s) => !s.closedAt || s.sprintId === task.sprintId)
            .map((s) => (
              <option key={s.sprintId} value={s.sprintId}>
                {s.name}{s.isActive ? ' ★' : ''}{s.closedAt ? ' (closed)' : ''}
              </option>
            ))}
        </select>
      </div>

      {/* Assignees */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Assignees</p>
        {onAddAssignee && onRemoveAssignee ? (
          <>
            <div className="flex flex-wrap gap-1.5 mb-1">
              {(task.assignees ?? []).map((a) => (
                <span
                  key={a.id}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {a.user.email}
                  <button
                    onClick={() => onRemoveAssignee(task.taskId, a.user.userId)}
                    className="ml-0.5 hover:opacity-70"
                    disabled={disabled}
                    aria-label={`Remove ${a.user.email}`}
                  >
                    ✕
                  </button>
                </span>
              ))}
              {(task.assignees ?? []).length === 0 && (
                <span className="text-xs text-slate-400">No assignees</span>
              )}
            </div>
            {showAssigneePicker ? (
              <div className="mt-1">
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded mb-1">
                  {orgUsers
                    .filter((u) => !(task.assignees ?? []).some((a) => a.user.userId === u.userId))
                    .map((u) => (
                      <button
                        key={u.userId}
                        onClick={() => {
                          onAddAssignee(task.taskId, u.userId);
                          setShowAssigneePicker(false);
                        }}
                        className="w-full text-left px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                        disabled={disabled}
                      >
                        {u.email}
                      </button>
                    ))}
                  {orgUsers.filter((u) => !(task.assignees ?? []).some((a) => a.user.userId === u.userId)).length === 0 && (
                    <p className="text-xs text-slate-400 px-2 py-1">All users assigned</p>
                  )}
                </div>
                <button onClick={() => setShowAssigneePicker(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
              </div>
            ) : (
              <button
                onClick={() => setShowAssigneePicker(true)}
                className="text-xs text-slate-500 hover:text-slate-700"
                disabled={disabled}
              >
                + Add assignee
              </button>
            )}
          </>
        ) : (
          <select
            id="task-assignee-select"
            value={task.assigneeId ?? ''}
            onChange={(e) => onAssignUser(task.taskId, e.target.value || null)}
            className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm"
            disabled={disabled}
            aria-label="Assignee"
          >
            <option value="">Unassigned</option>
            {orgUsers.map((u) => (
              <option key={u.userId} value={u.userId}>{u.email}</option>
            ))}
          </select>
        )}
      </div>

      {/* Watchers */}
      {onAddWatcher && onRemoveWatcher && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">
            Watchers {(task.watchers ?? []).length > 0 && <span className="text-slate-400">({(task.watchers ?? []).length})</span>}
          </p>
          <div className="flex flex-wrap gap-1.5 mb-1">
            {(task.watchers ?? []).map((w) => (
              <span
                key={w.id}
                className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-50 text-slate-700 border border-slate-200"
              >
                {w.user.email}
                <button
                  onClick={() => onRemoveWatcher(task.taskId, w.user.userId)}
                  className="ml-0.5 hover:opacity-70"
                  disabled={disabled}
                  aria-label={`Remove watcher ${w.user.email}`}
                >
                  ✕
                </button>
              </span>
            ))}
            {(task.watchers ?? []).length === 0 && (
              <span className="text-xs text-slate-400">No watchers</span>
            )}
          </div>
          {/* Watch/Unwatch toggle for current user */}
          {currentUserId && (
            (task.watchers ?? []).some((w) => w.user.userId === currentUserId) ? (
              <button
                onClick={() => onRemoveWatcher(task.taskId, currentUserId)}
                className="text-xs text-slate-500 hover:text-slate-700 mr-2"
                disabled={disabled}
              >
                Unwatch
              </button>
            ) : (
              <button
                onClick={() => onAddWatcher(task.taskId, currentUserId)}
                className="text-xs text-slate-500 hover:text-slate-700 mr-2"
                disabled={disabled}
              >
                Watch
              </button>
            )
          )}
          {showWatcherPicker ? (
            <div className="mt-1">
              <div className="max-h-32 overflow-y-auto border border-slate-200 rounded mb-1">
                {orgUsers
                  .filter((u) => !(task.watchers ?? []).some((w) => w.user.userId === u.userId))
                  .map((u) => (
                    <button
                      key={u.userId}
                      onClick={() => {
                        onAddWatcher(task.taskId, u.userId);
                        setShowWatcherPicker(false);
                      }}
                      className="w-full text-left px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
                      disabled={disabled}
                    >
                      {u.email}
                    </button>
                  ))}
                {orgUsers.filter((u) => !(task.watchers ?? []).some((w) => w.user.userId === u.userId)).length === 0 && (
                  <p className="text-xs text-slate-400 px-2 py-1">All users watching</p>
                )}
              </div>
              <button onClick={() => setShowWatcherPicker(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancel</button>
            </div>
          ) : (
            <button
              onClick={() => setShowWatcherPicker(true)}
              className="text-xs text-slate-500 hover:text-slate-700"
              disabled={disabled}
            >
              + Add watcher
            </button>
          )}
        </div>
      )}

      {/* Due Date */}
      <div className="mb-4">
        <label htmlFor="task-due-date" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Due Date</label>
        <input
          id="task-due-date"
          type="date"
          value={task.dueDate ?? ''}
          onChange={(e) => onDueDateChange(task.taskId, e.target.value || null)}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm w-full"
          disabled={disabled}
        />
      </div>

      {/* Priority */}
      <div className="mb-4">
        <label htmlFor="task-priority-select" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Priority</label>
        <select
          id="task-priority-select"
          value={task.priority}
          onChange={(e) => {
            if (onUpdateTask) {
              onUpdateTask(task.taskId, { priority: e.target.value });
            }
          }}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm"
          disabled={disabled}
        >
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      {/* Estimate */}
      {task.estimatedHours != null && (
        <div className="mb-4">
          <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
            ~{formatHours(task.estimatedHours)}
          </span>
        </div>
      )}

      {/* Story Points */}
      <div className="mb-4">
        <label htmlFor="task-story-points" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Story Points</label>
        <input
          id="task-story-points"
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

      {/* Time Tracking */}
      {onLogTime && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Time Tracking</p>
          {timeSummary && (
            <p className="text-sm text-slate-700 mb-2">
              <span className="font-medium">{formatDuration(timeSummary.totalMinutes)}</span>
              {timeSummary.estimatedHours != null && (
                <span className="text-slate-400"> / {formatHours(timeSummary.estimatedHours)} estimated</span>
              )}
            </p>
          )}
          {showLogTime ? (
            <div className="space-y-2 p-2 bg-slate-50 rounded border border-slate-200">
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  max={23}
                  value={logHours}
                  onChange={(e) => setLogHours(e.target.value)}
                  placeholder="0h"
                  className="w-14 text-xs border border-slate-300 rounded px-2 py-1"
                  aria-label="Hours"
                />
                <input
                  type="number"
                  min={0}
                  max={59}
                  value={logMinutes}
                  onChange={(e) => setLogMinutes(e.target.value)}
                  placeholder="0m"
                  className="w-14 text-xs border border-slate-300 rounded px-2 py-1"
                  aria-label="Minutes"
                />
                <input
                  type="date"
                  value={logDate}
                  onChange={(e) => setLogDate(e.target.value)}
                  className="flex-1 text-xs border border-slate-300 rounded px-2 py-1"
                  aria-label="Date"
                />
              </div>
              <input
                type="text"
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                placeholder="Description (optional)"
                className="w-full text-xs border border-slate-300 rounded px-2 py-1"
                aria-label="Description"
              />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={logBillable}
                    onChange={(e) => setLogBillable(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  Billable
                </label>
                <div className="flex gap-1">
                  <button
                    onClick={() => setShowLogTime(false)}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2 py-0.5"
                  >
                    Cancel
                  </button>
                  <button
                    disabled={logSubmitting || ((!logHours || logHours === '0') && (!logMinutes || logMinutes === '0'))}
                    onClick={async () => {
                      const totalMin = (parseInt(logHours || '0', 10) * 60) + parseInt(logMinutes || '0', 10);
                      if (totalMin <= 0) return;
                      setLogSubmitting(true);
                      try {
                        await onLogTime(task.taskId, totalMin, logDate, logDescription || undefined, logBillable);
                        setLogHours('');
                        setLogMinutes('');
                        setLogDescription('');
                        setLogBillable(false);
                        setShowLogTime(false);
                      } finally {
                        setLogSubmitting(false);
                      }
                    }}
                    className="text-xs bg-brand-green text-white px-3 py-0.5 rounded hover:bg-emerald-600 disabled:opacity-50"
                  >
                    {logSubmitting ? 'Saving…' : 'Log'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowLogTime(true)}
              className="text-xs text-slate-500 hover:text-slate-700"
              disabled={disabled}
            >
              + Log Time
            </button>
          )}
          {timeSummary && timeSummary.entries.length > 0 && (
            <div className="mt-2">
              <TimeEntryList
                entries={timeSummary.entries}
                currentUserId={currentUserId}
                onDelete={(id) => onDeleteTimeEntry?.(id, task.taskId)}
              />
            </div>
          )}
        </div>
      )}

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
                    aria-label={`Remove label ${label.name}`}
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
                      aria-label="Label color"
                    />
                    <input
                      type="text"
                      value={newLabelName}
                      onChange={(e) => setNewLabelName(e.target.value)}
                      placeholder="New label…"
                      aria-label="New label name"
                      className="flex-1 text-xs border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-green"
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
