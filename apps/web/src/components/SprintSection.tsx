import { useState } from 'react';
import type { Task, Sprint, OrgUser } from '../types';
import BurndownChart from './BurndownChart';
import DependencyBadge from './shared/DependencyBadge';

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

function dueDateColor(dueDate: string): string {
  const now = new Date();
  const due = new Date(dueDate + 'T00:00:00');
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return 'bg-red-100 text-red-700';
  if (diffDays <= 3) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-500';
}

const taskTypeDot: Record<string, string> = {
  epic: 'bg-purple-500',
  story: 'bg-blue-500',
  subtask: 'bg-slate-400',
};

interface TaskRowProps {
  task: Task;
  orgUsers: OrgUser[];
  allTasks: Task[];
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
  onDragStart: (taskId: string) => void;
  isChecked: boolean;
  showCheckboxes: boolean;
  onToggle: () => void;
}

export function TaskRow({
  task, orgUsers, allTasks, selectedTask, onSelectTask, onDragStart,
  isChecked, showCheckboxes, onToggle,
}: TaskRowProps) {
  const isSelected = selectedTask?.taskId === task.taskId;
  const assignee = orgUsers.find((u) => u.userId === task.assigneeId);

  return (
    <div
      role="button"
      tabIndex={0}
      draggable
      data-task-id={task.taskId}
      onClick={() => onSelectTask(task)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTask(task); }
      }}
      onDragStart={(e) => {
        onDragStart(task.taskId);
        e.dataTransfer.effectAllowed = 'move';
      }}
      className={`w-full text-left px-3 py-2 rounded-lg border border-transparent hover:bg-slate-50 hover:border-slate-200 transition-colors flex items-center gap-2 cursor-grab active:cursor-grabbing group ${
        isSelected ? 'bg-blue-50 border-blue-200' : ''
      } ${task.archived ? 'opacity-50' : ''}`}
    >
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => { e.stopPropagation(); onToggle(); }}
        onClick={(e) => e.stopPropagation()}
        className={`w-3.5 h-3.5 rounded border-slate-300 text-slate-600 flex-shrink-0 cursor-pointer ${
          showCheckboxes ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity`}
      />
      {task.taskType && task.taskType !== 'task' && (
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${taskTypeDot[task.taskType] ?? ''}`} title={task.taskType} />
      )}
      <span className={`flex-1 text-sm leading-snug ${task.taskType === 'epic' ? 'font-semibold text-slate-900' : 'text-slate-800'}`}>{task.title}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <DependencyBadge task={task} allTasks={allTasks} onTaskClick={(id) => {
          const t = allTasks.find((at) => at.taskId === id);
          if (t) onSelectTask(t);
        }} />
        {task.dueDate && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${dueDateColor(task.dueDate)}`}>{task.dueDate}</span>
        )}
        {task.priority && task.priority !== 'medium' && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityStyles[task.priority] ?? ''}`}>{task.priority}</span>
        )}
        {task.labels && task.labels.length > 0 && (
          <div className="flex items-center gap-0.5">
            {task.labels.slice(0, 3).map((l) => (
              <span key={l.labelId} className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: l.color }} title={l.name} />
            ))}
            {task.labels.length > 3 && <span className="text-[10px] text-slate-400">+{task.labels.length - 3}</span>}
          </div>
        )}
        {(task.storyPoints != null || task.estimatedHours != null) && (
          <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {[
              task.storyPoints != null ? `${task.storyPoints}pt` : null,
              task.estimatedHours != null ? `~${formatHours(task.estimatedHours)}` : null,
            ].filter(Boolean).join(' · ')}
          </span>
        )}
        {task.sprintColumn && (
          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">{task.sprintColumn}</span>
        )}
        {assignee && (
          <span className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium" title={assignee.email}>
            {assignee.email.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

interface SprintSectionProps {
  sprint: Sprint;
  tasks: Task[];
  allTasks: Task[];
  orgUsers: OrgUser[];
  selectedTask: Task | null;
  selectedTaskIds: Set<string>;
  showCheckboxes: boolean;
  dragOverInfo: { sectionId: string | null; index: number } | null;
  containerRef: (el: HTMLDivElement | null) => void;
  onSelectTask: (task: Task) => void;
  onToggleTaskId: (taskId: string) => void;
  onToggleAll: (taskIds: string[]) => void;
  onDragStart: (taskId: string) => void;
  onDragOver: (e: React.DragEvent<HTMLDivElement>, sectionId: string) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>, sectionId: string) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, sectionId: string, tasks: Task[]) => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (sprintId: string) => void;
  onActivateSprint: (sprintId: string) => void;
  onCloseSprint: (sprintId: string) => void;
  onSprintReport: (sprintId: string) => void;
}

export default function SprintSection({
  sprint, tasks: sprintTasks, allTasks, orgUsers, selectedTask, selectedTaskIds,
  showCheckboxes, dragOverInfo, containerRef,
  onSelectTask, onToggleTaskId, onToggleAll, onDragStart,
  onDragOver, onDragLeave, onDrop,
  onEditSprint, onDeleteSprint, onActivateSprint, onCloseSprint, onSprintReport,
}: SprintSectionProps) {
  const [burndownVisible, setBurndownVisible] = useState(false);

  const dateRange = sprint.startDate && sprint.endDate
    ? `${sprint.startDate} → ${sprint.endDate}`
    : sprint.startDate ? `from ${sprint.startDate}` : null;

  const doneTasks = sprintTasks.filter((t) => t.status === 'done');
  const totalEst = sprintTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
  const doneEst = doneTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
  const velocityLabel = totalEst > 0 ? ` · ${formatHours(doneEst)}/${formatHours(totalEst)}` : '';
  const countLabel = `${doneTasks.length}/${sprintTasks.length} done${velocityLabel}`;

  const sectionIds = sprintTasks.map((t) => t.taskId);
  const allChecked = sectionIds.length > 0 && sectionIds.every((id) => selectedTaskIds.has(id));

  const renderDropIndicator = (index: number) => {
    if (dragOverInfo?.sectionId === sprint.sprintId && dragOverInfo?.index === index) {
      return <div className="h-0.5 bg-blue-400 rounded mx-1 my-0.5" />;
    }
    return null;
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={allChecked}
              onChange={() => onToggleAll(sectionIds)}
              className={`w-3.5 h-3.5 rounded border-slate-300 text-slate-600 cursor-pointer ${
                showCheckboxes ? 'opacity-100' : 'opacity-0 hover:opacity-100'
              } transition-opacity`}
            />
            <span className="font-semibold text-slate-800 text-sm">{sprint.name}</span>
            <span className="text-xs text-slate-400">({countLabel})</span>
            {dateRange && <span className="text-xs text-slate-400">{dateRange}</span>}
            {sprint.isActive && (
              <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Active</span>
            )}
          </div>
          {sprint.goal && <p className="text-xs text-slate-500 mt-0.5 ml-6">{sprint.goal}</p>}
        </div>
        <div className="flex items-center gap-2">
          {sprint.startDate && sprint.endDate && (
            <button
              type="button"
              onClick={() => setBurndownVisible((v) => !v)}
              className={`text-xs px-2 py-1 border rounded ${
                burndownVisible ? 'text-blue-600 border-blue-300 bg-blue-50' : 'text-slate-400 hover:text-slate-600 border-slate-200 hover:bg-white'
              }`}
              title="Toggle burndown chart"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="inline-block">
                <path d="M2 14L14 2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 2" opacity="0.4" />
                <polyline points="2,12 5,10 8,8 11,9 14,4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          <button type="button" onClick={() => onSprintReport(sprint.sprintId)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 border border-slate-200 rounded hover:bg-white" title="Generate sprint report">Report</button>
          <button type="button" onClick={() => onEditSprint(sprint)} className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 border border-slate-200 rounded hover:bg-white" title="Edit sprint">Edit</button>
          {sprint.isActive && (
            <button type="button" onClick={() => onCloseSprint(sprint.sprintId)} className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 border border-slate-300 rounded hover:border-red-300 hover:bg-red-50">Close Sprint</button>
          )}
          {!sprint.isActive && (
            <>
              <button type="button" onClick={() => onActivateSprint(sprint.sprintId)} className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 border border-slate-300 rounded hover:bg-white">Set Active</button>
              <button
                type="button"
                onClick={() => { if (window.confirm(`Delete sprint "${sprint.name}"? Tasks will be moved to the backlog.`)) onDeleteSprint(sprint.sprintId); }}
                className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 border border-slate-200 rounded hover:border-red-300 hover:bg-red-50"
                title="Delete sprint"
              >Delete</button>
            </>
          )}
        </div>
      </div>
      {burndownVisible && (
        <div className="px-4 py-3 border-b border-slate-200 bg-white">
          <BurndownChart sprintId={sprint.sprintId} />
        </div>
      )}
      <div
        ref={containerRef}
        className="px-3 py-2 space-y-0 min-h-[2.5rem]"
        onDragOver={(e) => onDragOver(e, sprint.sprintId)}
        onDragLeave={(e) => onDragLeave(e, sprint.sprintId)}
        onDrop={(e) => onDrop(e, sprint.sprintId, sprintTasks)}
      >
        {sprintTasks.length === 0 && dragOverInfo?.sectionId !== sprint.sprintId ? (
          <p className="text-xs text-slate-400 py-2 px-1">No tasks assigned to this sprint.</p>
        ) : (
          <>
            {renderDropIndicator(0)}
            {sprintTasks.map((task, i) => (
              <div key={task.taskId}>
                <TaskRow
                  task={task}
                  orgUsers={orgUsers}
                  allTasks={allTasks}
                  selectedTask={selectedTask}
                  onSelectTask={onSelectTask}
                  onDragStart={onDragStart}
                  isChecked={selectedTaskIds.has(task.taskId)}
                  showCheckboxes={showCheckboxes}
                  onToggle={() => onToggleTaskId(task.taskId)}
                />
                {renderDropIndicator(i + 1)}
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
