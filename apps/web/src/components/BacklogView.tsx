import { useRef, useState, useCallback } from 'react';
import { List } from 'react-window';
import type { Task, Sprint, OrgUser } from '../types';
import SprintReportPanel from './SprintReportPanel';
import SprintSection, { TaskRow } from './SprintSection';
import { useCan } from '../hooks/PermissionContext';
import { PRIORITY_COLORS } from '../utils/taskHelpers';

const ROW_HEIGHT = 52;
const MAX_LIST_HEIGHT = 600;
const VIRTUALIZE_THRESHOLD = 20;

interface BacklogSectionProps {
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
  onDragOver: (e: React.DragEvent<HTMLDivElement>, sectionId: string | null) => void;
  onDragLeave: (e: React.DragEvent<HTMLDivElement>, sectionId: string | null) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>, sectionId: string | null, tasks: Task[]) => void;
  sprints?: Sprint[];
  onAssignSprint?: (taskId: string, sprintId: string | null) => void;
  epicMap?: Map<string, string>;
}

function BacklogSection({
  tasks: sectionTasks, allTasks, orgUsers, selectedTask, selectedTaskIds,
  showCheckboxes, dragOverInfo, containerRef,
  onSelectTask, onToggleTaskId, onToggleAll, onDragStart,
  onDragOver, onDragLeave, onDrop, sprints, onAssignSprint, epicMap,
}: BacklogSectionProps) {
  const sectionIds = sectionTasks.map((t) => t.taskId);
  const allChecked = sectionIds.length > 0 && sectionIds.every((id) => selectedTaskIds.has(id));

  const renderDropIndicator = (index: number) => {
    if (dragOverInfo?.sectionId === null && dragOverInfo?.index === index) {
      return <div className="h-0.5 bg-blue-400 rounded mx-1 my-0.5" />;
    }
    return null;
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
        <input
          type="checkbox"
          checked={allChecked}
          onChange={() => onToggleAll(sectionIds)}
          className={`w-3.5 h-3.5 rounded border-slate-300 text-slate-600 cursor-pointer ${showCheckboxes ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}
        />
        <span className="font-semibold text-slate-800 dark:text-slate-200 text-sm">Backlog (unassigned)</span>
        <span className="text-xs text-slate-500">({sectionTasks.length} tasks)</span>
      </div>
      <div
        ref={containerRef}
        aria-label="Backlog tasks"
        className="px-3 py-2 space-y-0 min-h-[2.5rem]"
        onDragOver={(e) => onDragOver(e, null)}
        onDragLeave={(e) => onDragLeave(e, null)}
        onDrop={(e) => onDrop(e, null, sectionTasks)}
      >
        {sectionTasks.length === 0 && dragOverInfo?.sectionId !== null ? (
          <p className="text-xs text-slate-500 py-2 px-1">No unassigned tasks.</p>
        ) : sectionTasks.length > VIRTUALIZE_THRESHOLD ? (
          <List
            style={{ height: Math.min(sectionTasks.length * ROW_HEIGHT, MAX_LIST_HEIGHT) }}
            rowCount={sectionTasks.length}
            rowHeight={ROW_HEIGHT}
            rowComponent={({ index, style: rowStyle }) => {
              const task = sectionTasks[index];
              return (
                <div style={rowStyle}>
                  <TaskRow
                    task={task}
                    orgUsers={orgUsers}
                    allTasks={allTasks}
                    selectedTask={selectedTask}
                    onSelectTask={onSelectTask}
                    onDragStart={onDragStart}
                    isChecked={selectedTaskIds.has(task.taskId)}
                    showCheckboxes={showCheckboxes}
                    onToggleTaskId={onToggleTaskId}
                    sprints={sprints}
                    onAssignSprint={onAssignSprint}
                    epicMap={epicMap}
                  />
                </div>
              );
            }}
            rowProps={{}}
          />
        ) : (
          <>
            {renderDropIndicator(0)}
            {sectionTasks.map((task, i) => (
              <div key={task.taskId} className="flex items-center gap-0">
                {task.priority && PRIORITY_COLORS[task.priority] && (
                  <span className={`w-1 self-stretch rounded-l flex-shrink-0 ${PRIORITY_COLORS[task.priority].dot}`} title={task.priority} />
                )}
                <div className="flex-1 min-w-0">
                  <TaskRow
                    task={task}
                    orgUsers={orgUsers}
                    allTasks={allTasks}
                    selectedTask={selectedTask}
                    onSelectTask={onSelectTask}
                    onDragStart={onDragStart}
                    isChecked={selectedTaskIds.has(task.taskId)}
                    showCheckboxes={showCheckboxes}
                    onToggleTaskId={onToggleTaskId}
                    sprints={sprints}
                    onAssignSprint={onAssignSprint}
                    epicMap={epicMap}
                  />
                  {renderDropIndicator(i + 1)}
                </div>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
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
  epicMap?: Map<string, string>;
}

export default function BacklogView({
  projectId, tasks, sprints, orgUsers, selectedTask, selectedTaskIds,
  onSelectTask, onToggleTaskId, onToggleAll,
  onCreateSprint, onEditSprint, onDeleteSprint, onActivateSprint, onCloseSprint,
  onAssignSprint, onPlanSprints, onReorderTask, hasMore, onLoadMore, showArchived, onToggleShowArchived, epicMap,
}: BacklogViewProps) {
  const can = useCan();
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

  const handleDragStart = useCallback((taskId: string) => { draggedId.current = taskId; }, []);

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

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Backlog</h2>
          {onToggleShowArchived && (
            <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer ml-2">
              <input type="checkbox" checked={showArchived ?? false} onChange={onToggleShowArchived} className="w-3 h-3 rounded border-slate-300" />
              Show archived
            </label>
          )}
          <div className="flex items-center gap-2">
            <button type="button" onClick={onPlanSprints} className="text-sm text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 px-3 py-1 border border-indigo-200 dark:border-indigo-700 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50">
              ✦ AI Plan Sprints
            </button>
            <button type="button" onClick={onCreateSprint} disabled={!can('MANAGE_SPRINTS')} title={!can('MANAGE_SPRINTS') ? "You don't have permission to manage sprints" : undefined} className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50">
              + Create Sprint
            </button>
          </div>
        </div>

        {openSprints.length === 0 && (
          <div className="text-sm text-slate-400 bg-slate-50 dark:bg-slate-800 rounded-lg p-4 text-center">
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
            allSprints={openSprints}
            onAssignSprint={onAssignSprint}
            epicMap={epicMap}
          />
        ))}

        {/* Backlog section */}
        <BacklogSection
          tasks={backlog}
          allTasks={tasks}
          orgUsers={orgUsers}
          selectedTask={selectedTask}
          selectedTaskIds={selectedTaskIds}
          showCheckboxes={showCheckboxes}
          dragOverInfo={dragOverInfo}
          containerRef={(el) => { if (el) containerRefs.current.set(null, el); }}
          onSelectTask={onSelectTask}
          onToggleTaskId={onToggleTaskId}
          onToggleAll={onToggleAll}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          sprints={openSprints}
          onAssignSprint={onAssignSprint}
          epicMap={epicMap}
        />

        {/* Load more */}
        {hasMore && (
          <div className="text-center">
            <button type="button" onClick={onLoadMore} className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800">
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
