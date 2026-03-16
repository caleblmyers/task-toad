import { useRef, useState } from 'react';
import type { Task, Sprint, OrgUser } from '../types';
import SprintReportPanel from './SprintReportPanel';
import SprintSection, { TaskRow } from './SprintSection';

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

interface BacklogViewProps {
  projectId: string;
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

export default function BacklogView({
  projectId, tasks, sprints, orgUsers, selectedTask, selectedTaskIds,
  onSelectTask, onToggleTaskId, onToggleAll,
  onCreateSprint, onEditSprint, onDeleteSprint, onActivateSprint, onCloseSprint,
  onPlanSprints, onReorderTask, hasMore, onLoadMore, showArchived, onToggleShowArchived,
}: BacklogViewProps) {
  const openSprints = sprints.filter((s) => !s.closedAt);
  const bySprint: Record<string, Task[]> = Object.fromEntries(
    openSprints.map((s) => [s.sprintId, sortTasks(tasks.filter((t) => t.sprintId === s.sprintId))])
  );
  const backlog = sortTasks(tasks.filter((t) => !t.sprintId));
  const showCheckboxes = selectedTaskIds.size > 0;

  const [sprintReportId, setSprintReportId] = useState<string | null>(null);

  // DnD state
  const draggedId = useRef<string | null>(null);
  const dragOverInfoRef = useRef<{ sectionId: string | null; index: number } | null>(null);
  const [dragOverInfo, setDragOverInfo] = useState<{ sectionId: string | null; index: number } | null>(null);
  const containerRefs = useRef<Map<string | null, HTMLDivElement>>(new Map());

  const handleDragStart = (taskId: string) => { draggedId.current = taskId; };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, sectionId: string | null) => {
    e.preventDefault();
    const container = containerRefs.current.get(sectionId);
    if (!container) return;
    const idx = computeDropIndex(e.clientY, container);
    const info = { sectionId, index: idx };
    if (dragOverInfoRef.current?.sectionId !== info.sectionId || dragOverInfoRef.current?.index !== info.index) {
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

  const renderBacklogDropIndicator = (index: number) => {
    if (dragOverInfo?.sectionId === null && dragOverInfo?.index === index) {
      return <div className="h-0.5 bg-blue-400 rounded mx-1 my-0.5" />;
    }
    return null;
  };

  const backlogIds = backlog.map((t) => t.taskId);
  const allBacklogChecked = backlogIds.length > 0 && backlogIds.every((id) => selectedTaskIds.has(id));

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Backlog</h2>
          {onToggleShowArchived && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-2">
              <input type="checkbox" checked={showArchived ?? false} onChange={onToggleShowArchived} className="w-3 h-3 rounded border-slate-300" />
              Show archived
            </label>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onPlanSprints} className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1 border border-indigo-200 bg-indigo-50 rounded-lg hover:bg-indigo-100">
              ✦ AI Plan Sprints
            </button>
            <button type="button" onClick={onCreateSprint} className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50">
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
        {openSprints.map((sprint) => (
          <SprintSection
            key={sprint.sprintId}
            sprint={sprint}
            tasks={bySprint[sprint.sprintId] ?? []}
            allTasks={tasks}
            orgUsers={orgUsers}
            selectedTask={selectedTask}
            selectedTaskIds={selectedTaskIds}
            showCheckboxes={showCheckboxes}
            dragOverInfo={dragOverInfo}
            containerRef={(el) => { if (el) containerRefs.current.set(sprint.sprintId, el); }}
            onSelectTask={onSelectTask}
            onToggleTaskId={onToggleTaskId}
            onToggleAll={onToggleAll}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onEditSprint={onEditSprint}
            onDeleteSprint={onDeleteSprint}
            onActivateSprint={onActivateSprint}
            onCloseSprint={onCloseSprint}
            onSprintReport={setSprintReportId}
          />
        ))}

        {/* Backlog section */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2">
            <input
              type="checkbox"
              checked={allBacklogChecked}
              onChange={() => onToggleAll(backlogIds)}
              className={`w-3.5 h-3.5 rounded border-slate-300 text-slate-600 cursor-pointer ${showCheckboxes ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}
            />
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
              <>
                {renderBacklogDropIndicator(0)}
                {backlog.map((task, i) => (
                  <div key={task.taskId}>
                    <TaskRow
                      task={task}
                      orgUsers={orgUsers}
                      allTasks={tasks}
                      selectedTask={selectedTask}
                      onSelectTask={onSelectTask}
                      onDragStart={handleDragStart}
                      isChecked={selectedTaskIds.has(task.taskId)}
                      showCheckboxes={showCheckboxes}
                      onToggle={() => onToggleTaskId(task.taskId)}
                    />
                    {renderBacklogDropIndicator(i + 1)}
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="text-center">
            <button type="button" onClick={onLoadMore} className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50">
              Load more tasks
            </button>
          </div>
        )}
      </div>

      {sprintReportId && (() => {
        const s = sprints.find((sp) => sp.sprintId === sprintReportId);
        if (!s) return null;
        return (
          <SprintReportPanel
            projectId={projectId}
            sprintId={s.sprintId}
            sprintName={s.name}
            onClose={() => setSprintReportId(null)}
          />
        );
      })()}
    </div>
  );
}
