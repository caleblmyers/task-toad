import { useRef, useState } from 'react';
import type { Task, Sprint, OrgUser } from '../types';

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

function sortTasks(taskList: Task[]): Task[] {
  return taskList.slice().sort((a, b) => {
    if (a.position != null && b.position != null) return a.position - b.position;
    if (a.position != null) return -1;
    if (b.position != null) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

function computeDropIndex(clientY: number, container: HTMLElement): number {
  const rows = Array.from(container.querySelectorAll('[data-task-id]')) as HTMLElement[];
  for (let i = 0; i < rows.length; i++) {
    const rect = rows[i].getBoundingClientRect();
    if (clientY < rect.top + rect.height / 2) return i;
  }
  return rows.length;
}

function parseDepsCount(raw?: string | null): number {
  if (!raw) return 0;
  try { return (JSON.parse(raw) as string[]).length; } catch { return 0; }
}

interface BacklogViewProps {
  tasks: Task[];
  sprints: Sprint[];
  orgUsers: OrgUser[];
  selectedTask: Task | null;
  selectedTaskIds: Set<string>;
  onSelectTask: (task: Task) => void;
  onToggleTaskId: (taskId: string) => void;
  onToggleAll: (taskIds: string[]) => void;
  onCreateSprint: () => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (sprintId: string) => void;
  onActivateSprint: (sprintId: string) => void;
  onCloseSprint: (sprintId: string) => void;
  onAssignSprint: (taskId: string, sprintId: string | null) => void;
  onPlanSprints: () => void;
  onReorderTask: (taskId: string, beforeId: string | null, afterId: string | null, targetSprintId: string | null) => void;
  hasMore: boolean;
  onLoadMore: () => void;
  showArchived?: boolean;
  onToggleShowArchived?: () => void;
}

function TaskRow({
  task,
  orgUsers,
  selectedTask,
  onSelectTask,
  onDragStart,
  isChecked,
  showCheckboxes,
  onToggle,
}: {
  task: Task;
  orgUsers: OrgUser[];
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
  onDragStart: (taskId: string) => void;
  isChecked: boolean;
  showCheckboxes: boolean;
  onToggle: () => void;
}) {
  const isSelected = selectedTask?.taskId === task.taskId;
  const assignee = orgUsers.find((u) => u.userId === task.assigneeId);
  const depCount = parseDepsCount(task.dependsOn);

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
      {/* Checkbox */}
      <input
        type="checkbox"
        checked={isChecked}
        onChange={(e) => { e.stopPropagation(); onToggle(); }}
        onClick={(e) => e.stopPropagation()}
        className={`w-3.5 h-3.5 rounded border-slate-300 text-slate-600 flex-shrink-0 cursor-pointer ${
          showCheckboxes ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
        } transition-opacity`}
      />
      <span className="flex-1 text-sm text-slate-800 leading-snug">{task.title}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {depCount > 0 && (
          <span className="text-xs text-slate-400" title={`${depCount} dependenc${depCount === 1 ? 'y' : 'ies'}`}>
            🔗{depCount}
          </span>
        )}
        {task.dueDate && (
          <span className={`text-xs px-1.5 py-0.5 rounded ${dueDateColor(task.dueDate)}`}>
            {task.dueDate}
          </span>
        )}
        {task.priority && task.priority !== 'medium' && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityStyles[task.priority] ?? ''}`}>
            {task.priority}
          </span>
        )}
        {task.labels && task.labels.length > 0 && (
          <div className="flex items-center gap-0.5">
            {task.labels.slice(0, 3).map((l) => (
              <span
                key={l.labelId}
                className="w-2 h-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: l.color }}
                title={l.name}
              />
            ))}
            {task.labels.length > 3 && (
              <span className="text-[10px] text-slate-400">+{task.labels.length - 3}</span>
            )}
          </div>
        )}
        {task.estimatedHours != null && (
          <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            ~{formatHours(task.estimatedHours)}
          </span>
        )}
        {task.sprintColumn && (
          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
            {task.sprintColumn}
          </span>
        )}
        {assignee && (
          <span
            className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium"
            title={assignee.email}
          >
            {assignee.email.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  );
}

export default function BacklogView({
  tasks,
  sprints,
  orgUsers,
  selectedTask,
  selectedTaskIds,
  onSelectTask,
  onToggleTaskId,
  onToggleAll,
  onCreateSprint,
  onEditSprint,
  onDeleteSprint,
  onActivateSprint,
  onCloseSprint,
  onPlanSprints,
  onReorderTask,
  hasMore,
  onLoadMore,
  showArchived,
  onToggleShowArchived,
}: BacklogViewProps) {
  const openSprints = sprints.filter((s) => !s.closedAt);
  const bySprint: Record<string, Task[]> = Object.fromEntries(
    openSprints.map((s) => [s.sprintId, sortTasks(tasks.filter((t) => t.sprintId === s.sprintId))])
  );
  const backlog = sortTasks(tasks.filter((t) => !t.sprintId));
  const showCheckboxes = selectedTaskIds.size > 0;

  // DnD state
  const draggedId = useRef<string | null>(null);
  const dragOverInfoRef = useRef<{ sectionId: string | null; index: number } | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{ sectionId: string | null; index: number } | null>(null);

  const containerRefs = useRef<Map<string | null, HTMLDivElement>>(new Map());

  const handleDragStart = (taskId: string) => {
    draggedId.current = taskId;
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, sectionId: string | null) => {
    e.preventDefault();
    const container = containerRefs.current.get(sectionId);
    if (!container) return;
    const idx = computeDropIndex(e.clientY, container);
    const info = { sectionId, index: idx };
    if (
      dragOverInfoRef.current?.sectionId !== info.sectionId ||
      dragOverInfoRef.current?.index !== info.index
    ) {
      dragOverInfoRef.current = info;
      setDragOverInfo(info);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>, sectionId: string | null) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      if (dragOverInfoRef.current?.sectionId === sectionId) {
        dragOverInfoRef.current = null;
        setDragOverInfo(null);
      }
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, sectionId: string | null, sectionTasks: Task[]) => {
    e.preventDefault();
    const taskId = draggedId.current;
    const info = dragOverInfoRef.current;
    draggedId.current = null;
    dragOverInfoRef.current = null;
    setDragOverInfo(null);

    if (!taskId || !info || info.sectionId !== sectionId) return;

    const withoutDragged = sectionTasks.filter((t) => t.taskId !== taskId);
    const beforeTask = withoutDragged[info.index - 1] ?? null;
    const afterTask = withoutDragged[info.index] ?? null;

    onReorderTask(taskId, beforeTask?.taskId ?? null, afterTask?.taskId ?? null, sectionId);
  };

  const renderDropIndicator = (sectionId: string | null, index: number) => {
    if (dragOverInfo?.sectionId === sectionId && dragOverInfo?.index === index) {
      return <div className="h-0.5 bg-blue-400 rounded mx-1 my-0.5" />;
    }
    return null;
  };

  const renderTaskList = (sectionTasks: Task[], sectionId: string | null) => (
    <>
      {renderDropIndicator(sectionId, 0)}
      {sectionTasks.map((task, i) => (
        <div key={task.taskId}>
          <TaskRow
            task={task}
            orgUsers={orgUsers}
            selectedTask={selectedTask}
            onSelectTask={onSelectTask}
            onDragStart={handleDragStart}
            isChecked={selectedTaskIds.has(task.taskId)}
            showCheckboxes={showCheckboxes}
            onToggle={() => onToggleTaskId(task.taskId)}
          />
          {renderDropIndicator(sectionId, i + 1)}
        </div>
      ))}
    </>
  );

  const renderSectionCheckbox = (sectionTasks: Task[]) => {
    const ids = sectionTasks.map((t) => t.taskId);
    const allChecked = ids.length > 0 && ids.every((id) => selectedTaskIds.has(id));
    return (
      <input
        type="checkbox"
        checked={allChecked}
        onChange={() => onToggleAll(ids)}
        className={`w-3.5 h-3.5 rounded border-slate-300 text-slate-600 cursor-pointer ${
          showCheckboxes ? 'opacity-100' : 'opacity-0 hover:opacity-100'
        } transition-opacity`}
      />
    );
  };

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Backlog</h2>
          {onToggleShowArchived && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-2">
              <input
                type="checkbox"
                checked={showArchived ?? false}
                onChange={onToggleShowArchived}
                className="w-3 h-3 rounded border-slate-300"
              />
              Show archived
            </label>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPlanSprints}
              className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1 border border-indigo-200 bg-indigo-50 rounded-lg hover:bg-indigo-100"
            >
              ✦ AI Plan Sprints
            </button>
            <button
              type="button"
              onClick={onCreateSprint}
              className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              + Create Sprint
            </button>
          </div>
        </div>

        {openSprints.length === 0 && (
          <div className="text-sm text-slate-400 bg-slate-50 rounded-lg p-4 text-center">
            No sprints yet. Create a sprint to organize your work into time-boxed periods.
          </div>
        )}

        {/* Sprint sections */}
        {openSprints.map((sprint) => {
          const sprintTasks = bySprint[sprint.sprintId] ?? [];
          const dateRange = sprint.startDate && sprint.endDate
            ? `${sprint.startDate} → ${sprint.endDate}`
            : sprint.startDate ? `from ${sprint.startDate}` : null;

          const doneTasks = sprintTasks.filter((t) => t.status === 'done');
          const totalEst = sprintTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
          const doneEst = doneTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0);
          const velocityLabel = totalEst > 0
            ? ` · ${formatHours(doneEst)}/${formatHours(totalEst)}`
            : '';
          const countLabel = `${doneTasks.length}/${sprintTasks.length} done${velocityLabel}`;

          return (
            <div key={sprint.sprintId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  {renderSectionCheckbox(sprintTasks)}
                  <span className="font-semibold text-slate-800 text-sm">{sprint.name}</span>
                  <span className="text-xs text-slate-400">({countLabel})</span>
                  {dateRange && <span className="text-xs text-slate-400">{dateRange}</span>}
                  {sprint.isActive && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEditSprint(sprint)}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 border border-slate-200 rounded hover:bg-white"
                    title="Edit sprint"
                  >
                    Edit
                  </button>
                  {sprint.isActive && (
                    <button
                      type="button"
                      onClick={() => onCloseSprint(sprint.sprintId)}
                      className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 border border-slate-300 rounded hover:border-red-300 hover:bg-red-50"
                    >
                      Close Sprint
                    </button>
                  )}
                  {!sprint.isActive && (
                    <>
                      <button
                        type="button"
                        onClick={() => onActivateSprint(sprint.sprintId)}
                        className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 border border-slate-300 rounded hover:bg-white"
                      >
                        Set Active
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete sprint "${sprint.name}"? Tasks will be moved to the backlog.`)) {
                            onDeleteSprint(sprint.sprintId);
                          }
                        }}
                        className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 border border-slate-200 rounded hover:border-red-300 hover:bg-red-50"
                        title="Delete sprint"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div
                ref={(el) => { if (el) containerRefs.current.set(sprint.sprintId, el); }}
                className="px-3 py-2 space-y-0 min-h-[2.5rem]"
                onDragOver={(e) => handleDragOver(e, sprint.sprintId)}
                onDragLeave={(e) => handleDragLeave(e, sprint.sprintId)}
                onDrop={(e) => handleDrop(e, sprint.sprintId, sprintTasks)}
              >
                {sprintTasks.length === 0 && dragOverInfo?.sectionId !== sprint.sprintId ? (
                  <p className="text-xs text-slate-400 py-2 px-1">No tasks assigned to this sprint.</p>
                ) : (
                  renderTaskList(sprintTasks, sprint.sprintId)
                )}
              </div>
            </div>
          );
        })}

        {/* Backlog section */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            {renderSectionCheckbox(backlog)}
            <span className="font-semibold text-slate-800 text-sm">Backlog (unassigned)</span>
            <span className="text-xs text-slate-400">({backlog.length} tasks)</span>
          </div>
          <div
            ref={(el) => { if (el) containerRefs.current.set(null, el); }}
            className="px-3 py-2 space-y-0 min-h-[2.5rem]"
            onDragOver={(e) => handleDragOver(e, null)}
            onDragLeave={(e) => handleDragLeave(e, null)}
            onDrop={(e) => handleDrop(e, null, backlog)}
          >
            {backlog.length === 0 && dragOverInfo?.sectionId !== null ? (
              <p className="text-xs text-slate-400 py-2 px-1">No unassigned tasks.</p>
            ) : (
              renderTaskList(backlog, null)
            )}
          </div>
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="text-center">
            <button
              type="button"
              onClick={onLoadMore}
              className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              Load more tasks
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
