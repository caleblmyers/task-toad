import { useRef, useMemo, useState, useCallback } from 'react';
import type { Task } from '../types';
import DependencyBadge from './shared/DependencyBadge';
import Badge from './shared/Badge';
import Card from './shared/Card';
import type { ComponentProps } from 'react';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

const COLUMN_ACCENTS = [
  { accent: 'border-t-slate-400',  barColor: 'border-l-slate-300',  pillVariant: 'neutral' as BadgeVariant },
  { accent: 'border-t-blue-500',   barColor: 'border-l-blue-400',   pillVariant: 'info' as BadgeVariant },
  { accent: 'border-t-purple-500', barColor: 'border-l-purple-400', pillVariant: 'purple' as BadgeVariant },
  { accent: 'border-t-green-500',  barColor: 'border-l-green-400',  pillVariant: 'success' as BadgeVariant },
  { accent: 'border-t-orange-500', barColor: 'border-l-orange-400', pillVariant: 'accent' as BadgeVariant },
];

function sortByPosition(a: Task, b: Task): number {
  if (a.position != null && b.position != null) return a.position - b.position;
  if (a.position != null) return -1;
  if (b.position != null) return 1;
  return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
}

function computePosition(sorted: Task[], targetIndex: number): number {
  const before = targetIndex > 0 ? sorted[targetIndex - 1] : null;
  const after = targetIndex < sorted.length ? sorted[targetIndex] : null;
  const getPos = (t: Task, fallbackIdx: number) => t.position ?? fallbackIdx * 1000;

  if (before && after) {
    return (getPos(before, targetIndex - 1) + getPos(after, targetIndex)) / 2;
  } else if (before) {
    return getPos(before, targetIndex - 1) + 1000;
  } else if (after) {
    return getPos(after, targetIndex) - 1000;
  }
  return 0;
}

const MIN_POSITION_GAP = 0.001;

function needsRebalance(sorted: Task[]): boolean {
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].position ?? (i - 1) * 1000;
    const curr = sorted[i].position ?? i * 1000;
    if (Math.abs(curr - prev) < MIN_POSITION_GAP) return true;
  }
  return false;
}

type GroupBy = 'assignee' | 'priority' | 'epic' | null;

interface OrgUser {
  userId: string;
  email: string;
}

interface KanbanBoardProps {
  columns: string[];
  tasks: Task[];
  subtasks: Record<string, Task[]>;
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
  onColumnChange: (taskId: string, columnName: string) => void;
  onReorderTask?: (taskId: string, position: number) => Promise<void>;
  epicMap?: Map<string, string>;
  groupBy?: GroupBy;
  orgUsers?: OrgUser[];
}

const SPECIAL_LAST_KEYS = new Set(['Unassigned', 'No Epic', 'none']);

function getGroupKey(task: Task, groupBy: NonNullable<GroupBy>, epicMap?: Map<string, string>): string {
  switch (groupBy) {
    case 'assignee': return task.assigneeId || 'Unassigned';
    case 'priority': return task.priority || 'none';
    case 'epic': return epicMap?.get(task.parentTaskId || '') || 'No Epic';
    default: return 'all';
  }
}

function sortGroupKeys(keys: string[]): string[] {
  return keys.sort((a, b) => {
    const aSpecial = SPECIAL_LAST_KEYS.has(a);
    const bSpecial = SPECIAL_LAST_KEYS.has(b);
    if (aSpecial && !bSpecial) return 1;
    if (!aSpecial && bSpecial) return -1;
    return a.localeCompare(b);
  });
}

function getGroupLabel(key: string, groupBy: NonNullable<GroupBy>, orgUsers?: OrgUser[]): string {
  if (groupBy === 'assignee' && key !== 'Unassigned') {
    const user = orgUsers?.find(u => u.userId === key);
    return user?.email ?? key.slice(0, 8);
  }
  if (groupBy === 'priority') {
    return key.charAt(0).toUpperCase() + key.slice(1);
  }
  return key;
}

export default function KanbanBoard({ columns, tasks, subtasks, selectedTask, onSelectTask, onColumnChange, onReorderTask, epicMap, groupBy, orgUsers }: KanbanBoardProps) {
  const draggedId = useRef<string | null>(null);
  const [movingTaskId, setMovingTaskId] = useState<string | null>(null);
  const [moveAnnouncement, setMoveAnnouncement] = useState('');
  const [columnOrder, setColumnOrder] = useState<Map<string, string[]>>(new Map());

  // Memoize column grouping — O(n) map instead of O(n*columns) inline filter per render
  const tasksByColumn = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const col of columns) map.set(col, []);
    for (const task of tasks) {
      const col = task.sprintColumn && map.has(task.sprintColumn) ? task.sprintColumn : columns[0];
      map.get(col)!.push(task);
    }
    // Sort each column by position
    for (const [col, colTasks] of map) {
      map.set(col, colTasks.sort(sortByPosition));
    }
    // Apply local reorder overrides
    for (const [col, orderedIds] of columnOrder) {
      const colTasks = map.get(col);
      if (!colTasks) continue;
      const taskMap = new Map(colTasks.map((t) => [t.taskId, t]));
      // Only apply if the ids still match the current column contents
      if (orderedIds.length === colTasks.length && orderedIds.every((id) => taskMap.has(id))) {
        map.set(col, orderedIds.map((id) => taskMap.get(id)!));
      }
    }
    return map;
  }, [tasks, columns, columnOrder]);

  // Memoize blocked task set — O(n) instead of O(n^2) per-card check
  const blockedTasks = useMemo(() => {
    const blocked = new Set<string>();
    for (const task of tasks) {
      // Check dependents (tasks that block this one via 'blocks' link type)
      const blockers = task.dependents?.filter(d => d.linkType === 'blocks') ?? [];
      if (blockers.length === 0) continue;
      const isBlocked = blockers.some(d => d.sourceTask && d.sourceTask.status !== 'done');
      if (isBlocked) blocked.add(task.taskId);
    }
    return blocked;
  }, [tasks]);

  // Swimlane grouping: group tasks within each column by groupBy key
  const swimlaneData = useMemo(() => {
    if (!groupBy) return null;
    const result = new Map<string, Map<string, Task[]>>();
    const allGroupKeys = new Set<string>();
    for (const [col, colTasks] of tasksByColumn) {
      const groups = new Map<string, Task[]>();
      for (const task of colTasks) {
        const key = getGroupKey(task, groupBy, epicMap);
        allGroupKeys.add(key);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(task);
      }
      result.set(col, groups);
    }
    return { grouped: result, sortedKeys: sortGroupKeys([...allGroupKeys]) };
  }, [tasksByColumn, groupBy, epicMap]);

  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Set<string>>(new Set());
  const toggleSwimlane = useCallback((key: string) => {
    setCollapsedSwimlanes(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const handleCardKeyDown = useCallback((e: React.KeyboardEvent, task: Task) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (movingTaskId === task.taskId) {
        // Exit move mode
        setMovingTaskId(null);
        setMoveAnnouncement('');
      } else {
        // Enter move mode
        setMovingTaskId(task.taskId);
        const col = task.sprintColumn ?? columns[0];
        setMoveAnnouncement(`Moving "${task.title}". Use Left/Right arrows to change column, Up/Down arrows to reorder within column. Currently in ${col}. Press Enter or Escape to finish.`);
      }
      return;
    }

    if (e.key === 'Escape' && movingTaskId === task.taskId) {
      e.preventDefault();
      setMovingTaskId(null);
      setMoveAnnouncement('');
      return;
    }

    if (movingTaskId === task.taskId && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const currentCol = task.sprintColumn ?? columns[0];
      const currentIdx = columns.indexOf(currentCol);
      let newIdx: number;
      if (e.key === 'ArrowLeft') {
        newIdx = Math.max(0, currentIdx - 1);
      } else {
        newIdx = Math.min(columns.length - 1, currentIdx + 1);
      }
      if (newIdx !== currentIdx) {
        const newCol = columns[newIdx];
        onColumnChange(task.taskId, newCol);
        setMoveAnnouncement(`Moved "${task.title}" to ${newCol}`);
      }
    }

    if (movingTaskId === task.taskId && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
      e.preventDefault();
      const currentCol = task.sprintColumn ?? columns[0];
      const colTasks = tasksByColumn.get(currentCol) ?? [];
      const taskIdx = colTasks.findIndex((t) => t.taskId === task.taskId);
      if (taskIdx < 0) return;
      const swapIdx = e.key === 'ArrowUp' ? taskIdx - 1 : taskIdx + 1;
      if (swapIdx < 0 || swapIdx >= colTasks.length) return;

      // Swap in local order
      const newOrder = colTasks.map((t) => t.taskId);
      [newOrder[taskIdx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[taskIdx]];
      setColumnOrder((prev) => new Map(prev).set(currentCol, newOrder));

      // Compute fractional position and persist
      if (onReorderTask) {
        const reordered = newOrder.map((id) => colTasks.find((t) => t.taskId === id)!);
        const newTaskIdx = reordered.findIndex((t) => t.taskId === task.taskId);
        // Remove the moved task to compute position between neighbors
        const others = reordered.filter((t) => t.taskId !== task.taskId);
        const position = computePosition(others, newTaskIdx);
        onReorderTask(task.taskId, position);

        // Rebalance positions if convergence detected
        if (needsRebalance(reordered)) {
          for (let ri = 0; ri < reordered.length; ri++) {
            const newPos = (ri + 1) * 1000;
            if (reordered[ri].taskId !== task.taskId) {
              onReorderTask(reordered[ri].taskId, newPos);
            }
          }
          // Also set the moved task's rebalanced position
          const movedNewPos = (newTaskIdx + 1) * 1000;
          onReorderTask(task.taskId, movedNewPos);
        }
      }

      const direction = e.key === 'ArrowUp' ? 'up' : 'down';
      setMoveAnnouncement(`Moved "${task.title}" ${direction} to position ${swapIdx + 1} of ${colTasks.length} in ${currentCol}`);
    }
  }, [movingTaskId, columns, onColumnChange, tasksByColumn, onReorderTask]);

  const renderCard = useCallback((task: Task, style: typeof COLUMN_ACCENTS[number], col: string) => {
    const isSelected = selectedTask?.taskId === task.taskId;
    const subtaskCount = subtasks[task.taskId]?.length ?? 0;
    const isBlocked = blockedTasks.has(task.taskId);
    const isMoving = movingTaskId === task.taskId;
    return (
      <Card
        key={task.taskId}
        padding="none"
        className={`p-3 shadow-sm border-l-4 ${
          task.taskType === 'epic' ? 'border-l-purple-500' :
          task.taskType === 'story' ? 'border-l-blue-500' :
          style.barColor
        }
          cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow duration-150
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1
          ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}
          ${isBlocked ? 'opacity-75' : ''}
          ${isMoving ? 'border-dashed border-2 border-blue-400 shadow-lg' : ''}`}
      >
        <div
          draggable
          tabIndex={0}
          role="option"
          aria-selected={isSelected}
          aria-description="Press Enter to move this task. Use Left/Right arrows to change column, Up/Down arrows to reorder within column."
          onDragStart={() => { draggedId.current = task.taskId; }}
          onClick={() => onSelectTask(task)}
          onKeyDown={(e) => handleCardKeyDown(e, task)}
        >
          <div className="flex items-center gap-1.5 mb-0.5">
            {task.taskType !== 'task' && (
              <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                task.taskType === 'epic' ? 'bg-purple-500' :
                task.taskType === 'story' ? 'bg-blue-500' :
                'bg-slate-400'
              }`} title={task.taskType} />
            )}
            <p className="text-sm font-medium text-slate-800 dark:text-slate-200 leading-snug line-clamp-2">{task.title}</p>
          </div>
          {task.parentTaskId && epicMap?.get(task.parentTaskId) && (
            <span className="text-[10px] text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/30 px-1.5 py-0.5 rounded-full truncate max-w-[120px] inline-block mt-0.5">
              {epicMap.get(task.parentTaskId)}
            </span>
          )}
          {task.description && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">{task.description}</p>
          )}
          {task.labels && task.labels.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5">
              {task.labels.slice(0, 4).map((l) => (
                <span
                  key={l.labelId}
                  className="text-[10px] px-1.5 py-0 rounded-full"
                  style={{ backgroundColor: l.color + '20', color: l.color }}
                >
                  {l.name}
                </span>
              ))}
            </div>
          )}
          <DependencyBadge task={task} allTasks={tasks} onTaskClick={(id) => {
            const t = tasks.find((at) => at.taskId === id);
            if (t) onSelectTask(t);
          }} />
          <div className="flex items-center justify-between mt-2">
            <Badge variant={style.pillVariant}>{col}</Badge>
            {subtaskCount > 0 && (
              <span className="text-xs text-slate-500">{subtaskCount} tasks</span>
            )}
          </div>
        </div>
      </Card>
    );
  }, [selectedTask, subtasks, blockedTasks, movingTaskId, epicMap, tasks, onSelectTask, handleCardKeyDown]);

  const renderTaskList = useCallback((taskList: Task[], style: typeof COLUMN_ACCENTS[number], col: string) => (
    taskList.length === 0 ? (
      <div className="flex items-center justify-center h-16 text-xs text-slate-500">
        No tasks
      </div>
    ) : (
      taskList.map((task) => renderCard(task, style, col))
    )
  ), [renderCard]);

  return (
    <div className="flex gap-4 h-full">
      {/* Live region for keyboard move announcements */}
      <div className="sr-only" aria-live="assertive" role="status">
        {moveAnnouncement}
      </div>

      {columns.map((col, idx) => {
        const style = COLUMN_ACCENTS[idx % COLUMN_ACCENTS.length];
        const colTasks = tasksByColumn.get(col) ?? [];
        return (
          <div
            key={col}
            className={`flex flex-col w-72 min-w-[18rem] flex-shrink-0 bg-slate-100 dark:bg-slate-800 rounded-xl border-t-4 ${style.accent}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = draggedId.current;
              if (!id) return;
              const task = tasks.find((t) => t.taskId === id);
              if (!task) { draggedId.current = null; return; }

              // Persist column change if moving to a different column
              if (task.sprintColumn !== col) {
                onColumnChange(id, col);
              }

              // Compute drop position (drop at end of column)
              if (onReorderTask) {
                const targetColTasks = (tasksByColumn.get(col) ?? []).filter((t) => t.taskId !== id);
                const position = computePosition(targetColTasks, targetColTasks.length);
                onReorderTask(id, position);
              }

              draggedId.current = null;
            }}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{col}</span>
              <span className="text-xs font-medium bg-white dark:bg-slate-700 text-slate-500 dark:text-slate-300 rounded-full px-2 py-0.5 shadow-sm">
                {colTasks.length}
              </span>
            </div>

            <div className="flex-1 px-2 pb-2 space-y-2 min-h-[4rem]" role="listbox" aria-label={`${col} column`}>
              {swimlaneData ? (
                // Swimlane mode: group tasks by the groupBy key
                swimlaneData.sortedKeys.map((groupKey) => {
                  const groupTasks = swimlaneData.grouped.get(col)?.get(groupKey) ?? [];
                  const isCollapsed = collapsedSwimlanes.has(groupKey);
                  const label = getGroupLabel(groupKey, groupBy!, orgUsers);
                  return (
                    <div key={groupKey}>
                      <button
                        type="button"
                        onClick={() => toggleSwimlane(groupKey)}
                        className="w-full flex items-center gap-1.5 px-1 py-1 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 rounded hover:bg-slate-200/50 dark:hover:bg-slate-700/50"
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 10 10"
                          className={`transition-transform ${isCollapsed ? '' : 'rotate-90'}`}
                          fill="currentColor"
                        >
                          <path d="M3 1l4 4-4 4z" />
                        </svg>
                        <span className="truncate">{label}</span>
                        <span className="ml-auto text-slate-400 flex-shrink-0">{groupTasks.length}</span>
                      </button>
                      {!isCollapsed && (
                        <div className="space-y-2 mt-1">
                          {renderTaskList(groupTasks, style, col)}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                // Flat mode: no swimlanes
                renderTaskList(colTasks, style, col)
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
