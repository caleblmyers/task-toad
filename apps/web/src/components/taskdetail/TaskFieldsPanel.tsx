import { useState, useEffect, useRef, useCallback } from 'react';
import type { Task, Sprint, OrgUser, Label } from '../../types';
import type { TaskTimeSummary } from '@tasktoad/shared-types';
import { statusLabel, PRIORITY_COLORS } from '../../utils/taskHelpers';
import TaskCustomFieldsSection from './TaskCustomFieldsSection';
import TimeEntryList from './TimeEntryList';
import MultiPicker from '../shared/MultiPicker';

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

const PRIORITY_OPTIONS = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
] as const;

function PriorityDropdown({ value, disabled, onChange }: { value: string; disabled?: boolean; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const colors = PRIORITY_COLORS[value];

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open]);

  // Focus the selected option when dropdown opens
  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => {
        const items = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
        const idx = PRIORITY_OPTIONS.findIndex((o) => o.value === value);
        items?.[idx >= 0 ? idx : 0]?.focus();
      });
    }
  }, [open, value]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = (focusedIndex + 1) % PRIORITY_OPTIONS.length;
      setFocusedIndex(next);
      const items = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
      items?.[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = (focusedIndex - 1 + PRIORITY_OPTIONS.length) % PRIORITY_OPTIONS.length;
      setFocusedIndex(prev);
      const items = listRef.current?.querySelectorAll<HTMLElement>('[role="option"]');
      items?.[prev]?.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const opt = PRIORITY_OPTIONS[focusedIndex];
      if (opt) {
        onChange(opt.value);
        setOpen(false);
        triggerRef.current?.focus();
      }
    }
  }, [open, focusedIndex, onChange]);

  return (
    <div className="mb-4" ref={containerRef} onKeyDown={handleKeyDown}>
      <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Priority</span>
      <div className="relative mt-1">
        <button
          ref={triggerRef}
          type="button"
          disabled={disabled}
          onClick={() => {
            setOpen((o) => {
              if (!o) {
                const idx = PRIORITY_OPTIONS.findIndex((opt) => opt.value === value);
                setFocusedIndex(idx >= 0 ? idx : 0);
              }
              return !o;
            });
          }}
          aria-haspopup="listbox"
          aria-expanded={open}
          className={`flex items-center gap-2 w-full border border-slate-300 dark:border-slate-600 rounded px-2 py-1 text-sm text-left ${colors?.bg ?? ''} ${colors?.text ?? ''} disabled:opacity-50`}
        >
          <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${colors?.dot ?? 'bg-slate-400'}`} />
          {PRIORITY_OPTIONS.find((o) => o.value === value)?.label ?? value}
          <svg className="ml-auto w-3 h-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
        </button>
        {open && (
          <div ref={listRef} role="listbox" aria-label="Priority" className="absolute z-50 mt-1 w-full rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg">
            {PRIORITY_OPTIONS.map((opt, idx) => {
              const optColors = PRIORITY_COLORS[opt.value];
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="option"
                  aria-selected={opt.value === value}
                  tabIndex={idx === focusedIndex ? 0 : -1}
                  onClick={() => { onChange(opt.value); setOpen(false); triggerRef.current?.focus(); }}
                  className={`flex items-center gap-2 w-full px-2 py-1.5 text-sm text-left hover:brightness-95 dark:hover:brightness-110 ${optColors?.bg ?? ''} ${optColors?.text ?? ''} first:rounded-t-md last:rounded-b-md ${idx === focusedIndex ? 'ring-2 ring-inset ring-brand-green' : ''}`}
                >
                  <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${optColors?.dot ?? 'bg-slate-400'}`} />
                  {opt.label}
                  {opt.value === value && <svg className="ml-auto w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
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
        <label htmlFor="task-session-select" className="text-xs font-medium text-slate-500 uppercase tracking-wide">Session</label>
        <select
          id="task-session-select"
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
          <MultiPicker
            items={orgUsers}
            selectedIds={(task.assignees ?? []).map((a) => a.user.userId)}
            getId={(u) => u.userId}
            getLabel={(u) => u.email}
            onAdd={(id) => onAddAssignee(task.taskId, id)}
            onRemove={(id) => onRemoveAssignee(task.taskId, id)}
            placeholder="+ Add assignee"
            disabled={disabled}
            emptyText="No assignees"
            allSelectedText="All users assigned"
            tagClassName="bg-blue-50 text-blue-700 border border-blue-200"
          />
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
          <MultiPicker
            items={orgUsers}
            selectedIds={(task.watchers ?? []).map((w) => w.user.userId)}
            getId={(u) => u.userId}
            getLabel={(u) => u.email}
            onAdd={(id) => onAddWatcher(task.taskId, id)}
            onRemove={(id) => onRemoveWatcher(task.taskId, id)}
            placeholder="+ Add watcher"
            disabled={disabled}
            emptyText="No watchers"
            allSelectedText="All users watching"
            tagClassName="bg-slate-50 text-slate-700 border border-slate-200"
          >
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
          </MultiPicker>
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
      <PriorityDropdown
        value={task.priority}
        disabled={disabled}
        onChange={(value) => {
          if (onUpdateTask) {
            onUpdateTask(task.taskId, { priority: value });
          }
        }}
      />

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
          {onAddTaskLabel && onRemoveTaskLabel ? (
            <MultiPicker
              items={labels ?? []}
              selectedIds={(task.labels ?? []).map((l) => l.labelId)}
              getId={(l) => l.labelId}
              getLabel={(l) => l.name}
              onAdd={(id) => onAddTaskLabel(task.taskId, id)}
              onRemove={(id) => onRemoveTaskLabel(task.taskId, id)}
              placeholder="+ Add label"
              disabled={disabled}
              allSelectedText="No more labels"
              renderTag={(label, onRemove) => (
                <span
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: label.color + '20', color: label.color, border: `1px solid ${label.color}40` }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color }} />
                  {label.name}
                  <button
                    onClick={onRemove}
                    className="ml-0.5 hover:opacity-70"
                    disabled={disabled}
                    aria-label={`Remove label ${label.name}`}
                  >
                    ✕
                  </button>
                </span>
              )}
              renderItem={(l) => (
                <span className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} />
                  {l.name}
                </span>
              )}
              extraContent={onCreateLabel ? (
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
                        const created = await onCreateLabel(newLabelName.trim(), newLabelColor);
                        if (created) {
                          onAddTaskLabel(task.taskId, created.labelId);
                          setNewLabelName('');
                        }
                      }
                    }}
                  />
                </div>
              ) : undefined}
            />
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(task.labels ?? []).map((label) => (
                <span
                  key={label.labelId}
                  className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                  style={{ backgroundColor: label.color + '20', color: label.color, border: `1px solid ${label.color}40` }}
                >
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: label.color }} />
                  {label.name}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  );
}
