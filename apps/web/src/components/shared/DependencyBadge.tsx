import { useState, useRef, useEffect } from 'react';
import type { Task } from '../../types';
import Badge from './Badge';

interface DependencyBadgeProps {
  task: Task;
  allTasks: Task[];
  onTaskClick?: (taskId: string) => void;
}

const statusDot: Record<string, string> = {
  done: 'bg-green-500',
  in_progress: 'bg-blue-500',
  in_review: 'bg-amber-500',
  todo: 'bg-slate-400',
};

export default function DependencyBadge({ task, allTasks, onTaskClick }: DependencyBadgeProps) {
  // Use TaskDependency join table: dependents = tasks that block this one (linkType='blocks')
  const blockerDeps = task.dependents?.filter(d => d.linkType === 'blocks') ?? [];
  const [showTooltip, setShowTooltip] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTooltip) return;
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowTooltip(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showTooltip]);

  if (blockerDeps.length === 0) return null;

  const deps = blockerDeps.map((dep) => {
    const t = dep.sourceTask ?? allTasks.find((at) => at.taskId === dep.sourceTaskId) ?? null;
    return { id: dep.sourceTaskId, task: t };
  });

  const blockedCount = deps.filter((d) => d.task?.status !== 'done').length;
  const isBlocked = blockedCount > 0;

  return (
    <div ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        onClick={(e) => { e.stopPropagation(); setShowTooltip((v) => !v); }}
      >
        <Badge variant={isBlocked ? 'warning' : 'success'} size="sm" className="inline-flex items-center gap-1">
          {isBlocked ? (
            <>Blocked ({blockedCount})</>
          ) : (
            <>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3,8 7,12 13,4" />
              </svg>
              {blockerDeps.length}
            </>
          )}
        </Badge>
      </button>

      {showTooltip && (
        <div className="absolute z-50 bottom-full left-0 mb-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1.5 min-w-[200px] max-w-[280px]">
          <p className="text-[10px] font-medium text-slate-400 uppercase px-2.5 mb-1">Dependencies</p>
          {deps.map((dep) => (
            <div
              key={dep.id}
              role={onTaskClick ? 'button' : undefined}
              tabIndex={onTaskClick ? 0 : undefined}
              onClick={(e) => {
                e.stopPropagation();
                if (onTaskClick && dep.task) onTaskClick(dep.task.taskId);
              }}
              onKeyDown={(e) => {
                if ((e.key === 'Enter' || e.key === ' ') && onTaskClick && dep.task) {
                  e.preventDefault();
                  e.stopPropagation();
                  onTaskClick(dep.task.taskId);
                }
              }}
              className={`flex items-center gap-2 px-2.5 py-1 text-xs ${
                onTaskClick && dep.task ? 'hover:bg-slate-50 dark:hover:bg-slate-700 cursor-pointer' : ''
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                  dep.task ? (statusDot[dep.task.status] ?? 'bg-slate-400') : 'bg-slate-300'
                }`}
              />
              <span className="truncate text-slate-700 dark:text-slate-300">
                {dep.task
                  ? dep.task.title.length > 40
                    ? dep.task.title.slice(0, 40) + '...'
                    : dep.task.title
                  : <span className="font-mono text-slate-400">{dep.id.slice(0, 8)} (unknown)</span>
                }
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
