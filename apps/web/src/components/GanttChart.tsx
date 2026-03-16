import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import type { Task } from '../types';
import { parseDependsOn } from '../utils/taskHelpers';

interface GanttChartProps {
  tasks: Task[];
  onSelectTask: (task: Task) => void;
}

type Granularity = 'day' | 'week' | 'month';

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  in_review: '#8b5cf6',
  done: '#22c55e',
  blocked: '#ef4444',
};

const TASK_TYPE_BADGES: Record<string, { label: string; color: string }> = {
  epic: { label: 'E', color: '#8b5cf6' },
  story: { label: 'S', color: '#3b82f6' },
  task: { label: 'T', color: '#64748b' },
  bug: { label: 'B', color: '#ef4444' },
};

const SIDEBAR_W = 200;
const ROW_H = 36;
const HEADER_H = 40;
const BAR_H = 22;
const BAR_Y_OFFSET = (ROW_H - BAR_H) / 2;

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function startOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d;
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDateLabel(date: Date, granularity: Granularity): string {
  if (granularity === 'day') return `${date.getMonth() + 1}/${date.getDate()}`;
  if (granularity === 'week') return `${date.getMonth() + 1}/${date.getDate()}`;
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
}

function getColumnWidth(granularity: Granularity): number {
  if (granularity === 'day') return 40;
  if (granularity === 'week') return 100;
  return 160;
}

/** Build a list of column boundaries (date, label) for the timeline header */
function buildColumns(start: Date, end: Date, granularity: Granularity): { date: Date; label: string }[] {
  const cols: { date: Date; label: string }[] = [];
  let cursor: Date;

  if (granularity === 'day') {
    cursor = new Date(start);
    while (cursor <= end) {
      cols.push({ date: new Date(cursor), label: formatDateLabel(cursor, granularity) });
      cursor = addDays(cursor, 1);
    }
  } else if (granularity === 'week') {
    cursor = startOfWeek(new Date(start));
    while (cursor <= end) {
      cols.push({ date: new Date(cursor), label: formatDateLabel(cursor, granularity) });
      cursor = addDays(cursor, 7);
    }
  } else {
    cursor = startOfMonth(new Date(start));
    while (cursor <= end) {
      cols.push({ date: new Date(cursor), label: formatDateLabel(cursor, granularity) });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  }

  return cols;
}

export default function GanttChart({ tasks, onSelectTask }: GanttChartProps) {
  const [granularity, setGranularity] = useState<Granularity>('week');
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  // Sync vertical scroll between sidebar and timeline
  const handleTimelineScroll = useCallback(() => {
    if (timelineRef.current && sidebarRef.current) {
      sidebarRef.current.scrollTop = timelineRef.current.scrollTop;
    }
  }, []);

  // Force re-render on container resize
  const [, setResizeTick] = useState(0);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setResizeTick((n) => n + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Separate tasks with dates and without
  const { datedTasks, noDateTasks } = useMemo(() => {
    const dated: Task[] = [];
    const noDate: Task[] = [];
    for (const t of tasks) {
      if (t.dueDate) dated.push(t);
      else noDate.push(t);
    }
    // Sort dated tasks by due date
    dated.sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1));
    return { datedTasks: dated, noDateTasks: noDate };
  }, [tasks]);

  // Compute timeline range
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (datedTasks.length === 0) {
      const today = new Date();
      return { rangeStart: addDays(today, -7), rangeEnd: addDays(today, 30) };
    }

    const dates = datedTasks.map((t) => new Date(t.dueDate!));
    const min = new Date(Math.min(...dates.map((d) => d.getTime())));
    const max = new Date(Math.max(...dates.map((d) => d.getTime())));

    // Add padding
    return { rangeStart: addDays(min, -7), rangeEnd: addDays(max, 14) };
  }, [datedTasks]);

  const columns = useMemo(() => buildColumns(rangeStart, rangeEnd, granularity), [rangeStart, rangeEnd, granularity]);
  const colWidth = getColumnWidth(granularity);
  const timelineWidth = columns.length * colWidth;
  const allTasks = [...datedTasks, ...noDateTasks];
  const contentHeight = allTasks.length * ROW_H;

  // Build task index for dependency arrows
  const taskIndex = useMemo(() => {
    const map = new Map<string, number>();
    allTasks.forEach((t, i) => map.set(t.taskId, i));
    return map;
  }, [allTasks]);

  /** Convert a date to an X pixel position in the timeline */
  const dateToX = useCallback((dateStr: string): number => {
    const date = new Date(dateStr);
    const totalDays = daysBetween(rangeStart, rangeEnd);
    if (totalDays <= 0) return 0;
    const dayOffset = daysBetween(rangeStart, date);
    return (dayOffset / totalDays) * timelineWidth;
  }, [rangeStart, rangeEnd, timelineWidth]);

  /** Get bar start and width for a task */
  const getTaskBar = useCallback((task: Task): { x: number; w: number } | null => {
    if (!task.dueDate) return null;
    const dueX = dateToX(task.dueDate);
    const hours = task.estimatedHours ?? 4;
    // Estimate start: estimatedHours converted to days (8h = 1 day)
    const durationDays = Math.max(1, Math.ceil(hours / 8));
    const startDate = addDays(new Date(task.dueDate), -durationDays);
    const startX = dateToX(startDate.toISOString().slice(0, 10));
    const w = Math.max(dueX - startX, 20);
    return { x: startX, w };
  }, [dateToX]);

  /** Draw dependency arrow path (quadratic bezier) */
  const getDependencyPaths = useMemo(() => {
    const paths: { d: string; key: string }[] = [];

    for (const task of allTasks) {
      if (!task.dependsOn) continue;
      const depIds = parseDependsOn(task.dependsOn);
      if (depIds.length === 0) continue;

      const toIdx = taskIndex.get(task.taskId);
      if (toIdx === undefined) continue;
      const toBar = getTaskBar(task);
      if (!toBar) continue;

      for (const depId of depIds) {
        const fromIdx = taskIndex.get(depId);
        if (fromIdx === undefined) continue;
        const fromTask = allTasks[fromIdx];
        const fromBar = getTaskBar(fromTask);
        if (!fromBar) continue;

        const x1 = fromBar.x + fromBar.w;
        const y1 = fromIdx * ROW_H + ROW_H / 2;
        const x2 = toBar.x;
        const y2 = toIdx * ROW_H + ROW_H / 2;
        const cpx = (x1 + x2) / 2;

        paths.push({
          key: `${depId}-${task.taskId}`,
          d: `M ${x1} ${y1} Q ${cpx} ${y1}, ${cpx} ${(y1 + y2) / 2} Q ${cpx} ${y2}, ${x2} ${y2}`,
        });
      }
    }

    return paths;
  }, [allTasks, taskIndex, getTaskBar]);

  // Today marker position
  const todayX = dateToX(new Date().toISOString().slice(0, 10));

  return (
    <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
      {/* Controls */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-shrink-0">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Zoom:</span>
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
          {(['day', 'week', 'month'] as Granularity[]).map((g) => (
            <button
              key={g}
              onClick={() => setGranularity(g)}
              className={`px-3 py-1 text-xs rounded-md capitalize ${
                granularity === g
                  ? 'bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {g}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-2">
          {datedTasks.length} tasks with dates, {noDateTasks.length} without
        </span>
      </div>

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Fixed sidebar */}
        <div
          ref={sidebarRef}
          className="flex-shrink-0 overflow-hidden border-r border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
          style={{ width: SIDEBAR_W }}
        >
          {/* Header spacer */}
          <div
            className="border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 flex items-center px-3"
            style={{ height: HEADER_H }}
          >
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Task</span>
          </div>
          {/* Task names */}
          <div className="overflow-hidden">
            {allTasks.map((task, i) => {
              const badge = TASK_TYPE_BADGES[task.taskType] ?? TASK_TYPE_BADGES.task;
              const isNoDate = !task.dueDate;
              return (
                <div
                  key={task.taskId}
                  className={`flex items-center gap-2 px-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 border-b border-slate-100 dark:border-slate-800 ${
                    hoveredTaskId === task.taskId ? 'bg-slate-50' : ''
                  } ${isNoDate && i === datedTasks.length ? 'border-t-2 border-t-slate-300' : ''}`}
                  style={{ height: ROW_H }}
                  onMouseEnter={() => setHoveredTaskId(task.taskId)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  onClick={() => onSelectTask(task)}
                  title={task.title}
                >
                  <span
                    className="flex-shrink-0 w-4 h-4 rounded text-[9px] font-bold flex items-center justify-center text-white"
                    style={{ backgroundColor: badge.color }}
                  >
                    {badge.label}
                  </span>
                  <span className="text-xs text-slate-700 dark:text-slate-300 truncate">{task.title}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Scrollable timeline */}
        <div
          ref={timelineRef}
          className="flex-1 overflow-auto"
          onScroll={handleTimelineScroll}
        >
          {/* Timeline header */}
          <div
            className="sticky top-0 z-10 bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex"
            style={{ width: timelineWidth, height: HEADER_H }}
          >
            {columns.map((col, i) => (
              <div
                key={i}
                className="flex-shrink-0 flex items-center justify-center text-xs text-slate-500 dark:text-slate-400 border-r border-slate-200 dark:border-slate-700"
                style={{ width: colWidth }}
              >
                {col.label}
              </div>
            ))}
          </div>

          {/* Timeline body */}
          <div className="relative" style={{ width: timelineWidth, height: contentHeight }}>
            {/* Column grid lines */}
            {columns.map((_, i) => (
              <div
                key={i}
                className="absolute top-0 bottom-0 border-r border-slate-100"
                style={{ left: i * colWidth, width: colWidth }}
              />
            ))}

            {/* Row backgrounds */}
            {allTasks.map((task, i) => (
              <div
                key={task.taskId}
                className={`absolute left-0 right-0 border-b border-slate-100 ${
                  hoveredTaskId === task.taskId ? 'bg-blue-50/30' : i % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'
                } ${!task.dueDate && i === datedTasks.length ? 'border-t-2 border-t-slate-300' : ''}`}
                style={{ top: i * ROW_H, height: ROW_H }}
                onMouseEnter={() => setHoveredTaskId(task.taskId)}
                onMouseLeave={() => setHoveredTaskId(null)}
              />
            ))}

            {/* Today marker */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-red-400 z-20 pointer-events-none"
              style={{ left: todayX }}
            >
              <div className="absolute -top-0 -left-2.5 bg-red-400 text-white text-[9px] px-1 rounded-b">
                Today
              </div>
            </div>

            {/* "No date" separator label */}
            {noDateTasks.length > 0 && (
              <div
                className="absolute left-2 text-[10px] text-slate-400 font-medium uppercase tracking-wide z-10"
                style={{ top: datedTasks.length * ROW_H + 2 }}
              >
                No date
              </div>
            )}

            {/* SVG layer for arrows and bars */}
            <svg
              className="absolute inset-0 pointer-events-none"
              width={timelineWidth}
              height={contentHeight}
              style={{ zIndex: 5 }}
            >
              {/* Dependency arrows */}
              {getDependencyPaths.map(({ d, key }) => (
                <path
                  key={key}
                  d={d}
                  fill="none"
                  stroke="#94a3b8"
                  strokeWidth="1.5"
                  strokeDasharray="4 2"
                  markerEnd="url(#arrowhead)"
                />
              ))}

              {/* Arrow marker definition */}
              <defs>
                <marker
                  id="arrowhead"
                  markerWidth="8"
                  markerHeight="6"
                  refX="8"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
              </defs>
            </svg>

            {/* Task bars */}
            {allTasks.map((task, i) => {
              const bar = getTaskBar(task);
              if (!bar) return null;
              const color = STATUS_COLORS[task.status] ?? STATUS_COLORS.todo;

              return (
                <div
                  key={task.taskId}
                  className="absolute rounded cursor-pointer hover:opacity-90 transition-opacity flex items-center px-2 overflow-hidden"
                  style={{
                    left: bar.x,
                    top: i * ROW_H + BAR_Y_OFFSET,
                    width: bar.w,
                    height: BAR_H,
                    backgroundColor: color,
                    zIndex: 10,
                  }}
                  onClick={() => onSelectTask(task)}
                  onMouseEnter={() => setHoveredTaskId(task.taskId)}
                  onMouseLeave={() => setHoveredTaskId(null)}
                  title={`${task.title}\nStatus: ${task.status}\nDue: ${task.dueDate ?? 'none'}\nEstimated: ${task.estimatedHours ?? 4}h`}
                >
                  <span className="text-[10px] text-white font-medium truncate">
                    {task.title}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* No tasks message */}
      {tasks.length === 0 && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-slate-500">No tasks to display on the timeline.</p>
        </div>
      )}
    </div>
  );
}
