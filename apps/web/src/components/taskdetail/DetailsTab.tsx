import { useState } from 'react';
import type { Task, Sprint, OrgUser, Label } from '../../types';
import type { TaskTimeSummary } from '@tasktoad/shared-types';
import { gql } from '../../api/client';
import { GENERATE_MANUAL_TASK_SPEC_MUTATION } from '../../api/queries';
import ManualTaskSpecView from './ManualTaskSpecView';
import type { ManualTaskSpec } from './ManualTaskSpecView';
import { useEditableField } from '../../hooks/useEditableField';
import MarkdownRenderer from '../shared/MarkdownRenderer';
import MarkdownEditor from '../shared/MarkdownEditor';
import TaskFieldsPanel from './TaskFieldsPanel';
import TaskGitHubSection from './TaskGitHubSection';

export interface DetailsTabProps {
  task: Task;
  sprints: Sprint[];
  orgUsers: OrgUser[];
  statuses: string[];
  labels?: Label[];
  disabled: boolean;
  currentUserId: string;
  generatingInstructions: string | null;
  projectHasRepo?: boolean;
  can?: (permission: string) => boolean;
  onStatusChange: (taskId: string, status: string) => void;
  onAssignSprint: (taskId: string, sprintId: string | null) => void;
  onAssignUser: (taskId: string, assigneeId: string | null) => void;
  onDueDateChange: (taskId: string, dueDate: string | null) => void;
  onUpdateTask?: (taskId: string, updates: { description?: string; instructions?: string; acceptanceCriteria?: string; storyPoints?: number | null; priority?: string }) => Promise<void>;
  onAddTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onRemoveTaskLabel?: (taskId: string, labelId: string) => Promise<void>;
  onCreateLabel?: (name: string, color: string) => Promise<Label | null>;
  onAddWatcher?: (taskId: string, userId: string) => Promise<void>;
  onRemoveWatcher?: (taskId: string, userId: string) => Promise<void>;
  onGenerateInstructions: (task: Task) => void;
  onSyncToGitHub?: (taskId: string) => Promise<void>;
  timeSummary?: TaskTimeSummary | null;
  onLogTime?: (taskId: string, durationMinutes: number, loggedDate: string, description?: string, billable?: boolean) => Promise<unknown>;
  onDeleteTimeEntry?: (timeEntryId: string, taskId: string) => Promise<void>;
}

export default function DetailsTab({
  task, sprints, orgUsers, statuses, labels, disabled, currentUserId,
  generatingInstructions, projectHasRepo, can: canDo,
  onStatusChange, onAssignSprint, onAssignUser, onDueDateChange,
  onUpdateTask, onAddTaskLabel, onRemoveTaskLabel, onCreateLabel,
  onAddWatcher, onRemoveWatcher, onGenerateInstructions, onSyncToGitHub,
  timeSummary, onLogTime, onDeleteTimeEntry,
}: DetailsTabProps) {
  const descField = useEditableField(
    task.description ?? '',
    async (val) => { if (onUpdateTask) await onUpdateTask(task.taskId, { description: val }); },
  );
  const instrField = useEditableField(
    task.instructions ?? '',
    async (val) => { if (onUpdateTask) await onUpdateTask(task.taskId, { instructions: val }); },
  );
  const acField = useEditableField(
    task.acceptanceCriteria ?? '',
    async (val) => { if (onUpdateTask) await onUpdateTask(task.taskId, { acceptanceCriteria: val }); },
  );
  const [manualSpec, setManualSpec] = useState<ManualTaskSpec | null>(null);
  const [specLoading, setSpecLoading] = useState(false);

  return (
    <section aria-labelledby="task-tab-details-heading">
      <h3 id="task-tab-details-heading" className="sr-only">Task Details</h3>

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

      {/* Description */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Description</p>
        {descField.isEditing ? (
          <MarkdownEditor
            value={descField.value}
            onChange={descField.setValue}
            onSave={descField.save}
            onCancel={descField.cancel}
            placeholder="Add a description…"
            rows={4}
          />
        ) : task.description ? (
          <button
            type="button"
            className="w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded p-1 -m-1"
            onClick={() => { if (!disabled) descField.startEdit(); }}
            disabled={disabled}
            aria-label="Edit description"
          >
            <MarkdownRenderer content={task.description} />
          </button>
        ) : (
          <button
            onClick={() => { if (!disabled) descField.startEdit(); }}
            className="text-xs text-slate-500 hover:text-slate-600"
            disabled={disabled}
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
        {acField.isEditing ? (
          <MarkdownEditor
            value={acField.value}
            onChange={acField.setValue}
            onSave={acField.save}
            onCancel={acField.cancel}
            placeholder="Add acceptance criteria…"
            rows={4}
          />
        ) : task.acceptanceCriteria ? (
          <button
            type="button"
            className="w-full text-left cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 rounded p-1 -m-1"
            onClick={() => { if (!disabled) acField.startEdit(); }}
            disabled={disabled}
            aria-label="Edit acceptance criteria"
          >
            <MarkdownRenderer content={task.acceptanceCriteria} />
          </button>
        ) : (
          <button
            onClick={() => { if (!disabled) acField.startEdit(); }}
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
        {instrField.isEditing ? (
          <MarkdownEditor
            value={instrField.value}
            onChange={instrField.setValue}
            onSave={instrField.save}
            onCancel={instrField.cancel}
            placeholder="Add instructions…"
            rows={6}
          />
        ) : task.instructions ? (
          <button
            type="button"
            className="w-full text-left bg-slate-50 dark:bg-slate-800 rounded-lg p-3 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700"
            onClick={() => { if (!disabled) instrField.startEdit(); }}
            disabled={disabled}
            aria-label="Edit instructions"
          >
            <MarkdownRenderer content={task.instructions} />
          </button>
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
              onClick={() => { if (!disabled) instrField.startEdit(); }}
              className="text-xs text-slate-500 hover:text-slate-600 px-2"
              disabled={disabled}
            >
              Write manually
            </button>
          </div>
        )}
        {task.instructions && !instrField.isEditing && (
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
        disabled={disabled}
        onSyncToGitHub={onSyncToGitHub}
      />
    </section>
  );
}
