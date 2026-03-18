import { useState } from 'react';
import type { Task, TaskDependency } from '../../types';

type LinkType = TaskDependency['linkType'];

interface TaskDependenciesSectionProps {
  task: Task;
  allTasks: Task[];
  disabled?: boolean;
  onAddDependency: (sourceTaskId: string, targetTaskId: string, linkType: LinkType) => Promise<void>;
  onRemoveDependency: (taskDependencyId: string) => Promise<void>;
}

const LINK_TYPE_LABELS: Record<LinkType, string> = {
  blocks: 'Blocks',
  is_blocked_by: 'Blocked by',
  relates_to: 'Relates to',
  duplicates: 'Duplicates',
};

function statusDotColor(status: string): string {
  if (status === 'done') return 'bg-green-500';
  if (status === 'in_progress') return 'bg-blue-500';
  if (status === 'in_review') return 'bg-amber-500';
  return 'bg-slate-400';
}

export default function TaskDependenciesSection({
  task,
  allTasks,
  disabled,
  onAddDependency,
  onRemoveDependency,
}: TaskDependenciesSectionProps) {
  const [showDepPicker, setShowDepPicker] = useState(false);
  const [depSearch, setDepSearch] = useState('');
  const [linkType, setLinkType] = useState<LinkType>('blocks');

  const dependencies = task.dependencies ?? [];
  const dependents = task.dependents ?? [];

  // Tasks already linked (as source or target)
  const linkedTaskIds = new Set([
    ...dependencies.map(d => d.targetTaskId),
    ...dependents.map(d => d.sourceTaskId),
    task.taskId,
  ]);

  const availableTasks = allTasks.filter(t => !linkedTaskIds.has(t.taskId));
  const filteredAvailable = depSearch
    ? availableTasks.filter(t => t.title.toLowerCase().includes(depSearch.toLowerCase()))
    : availableTasks;

  // Group dependencies by linkType
  const depsByType = dependencies.reduce<Record<string, typeof dependencies>>((acc, d) => {
    (acc[d.linkType] ??= []).push(d);
    return acc;
  }, {});

  // Group dependents (incoming) — only show "blocked by" and "relates_to" incoming
  const depsByTypeIncoming = dependents.reduce<Record<string, typeof dependents>>((acc, d) => {
    (acc[d.linkType] ??= []).push(d);
    return acc;
  }, {});

  const hasAny = dependencies.length > 0 || dependents.length > 0;

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Dependencies</p>
      <div className="space-y-2 mb-1">
        {/* Outgoing dependencies (this task → other) */}
        {Object.entries(depsByType).map(([type, deps]) => (
          <div key={type}>
            <span className="text-[10px] font-semibold text-slate-400 uppercase">{LINK_TYPE_LABELS[type as LinkType] ?? type}</span>
            {deps.map(dep => {
              const target = dep.targetTask;
              const dotColor = target ? statusDotColor(target.status) : 'bg-slate-300';
              return (
                <div key={dep.taskDependencyId} className="flex items-center gap-2 group ml-1">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                  <span className="text-xs text-slate-700 truncate">
                    {target?.title ?? dep.targetTaskId.slice(0, 8)}
                  </span>
                  <button
                    onClick={() => onRemoveDependency(dep.taskDependencyId)}
                    className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                    disabled={disabled}
                  >
                    <span className="text-xs">✕</span>
                  </button>
                </div>
              );
            })}
          </div>
        ))}

        {/* Incoming dependencies (other → this task) */}
        {Object.entries(depsByTypeIncoming).map(([type, deps]) => {
          const incomingLabel = type === 'blocks' ? 'Blocked by' : type === 'is_blocked_by' ? 'Blocks' : LINK_TYPE_LABELS[type as LinkType] ?? type;
          return (
            <div key={`incoming-${type}`}>
              <span className="text-[10px] font-semibold text-slate-400 uppercase">{incomingLabel} (incoming)</span>
              {deps.map(dep => {
                const source = dep.sourceTask;
                const dotColor = source ? statusDotColor(source.status) : 'bg-slate-300';
                return (
                  <div key={dep.taskDependencyId} className="flex items-center gap-2 group ml-1">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor}`} />
                    <span className="text-xs text-slate-700 truncate">
                      {source?.title ?? dep.sourceTaskId.slice(0, 8)}
                    </span>
                    <button
                      onClick={() => onRemoveDependency(dep.taskDependencyId)}
                      className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity ml-auto"
                      disabled={disabled}
                    >
                      <span className="text-xs">✕</span>
                    </button>
                  </div>
                );
              })}
            </div>
          );
        })}

        {!hasAny && !showDepPicker && (
          <span className="text-xs text-slate-400">None</span>
        )}
      </div>
      {showDepPicker ? (
        <div>
          <div className="flex gap-1 mb-1">
            <select
              value={linkType}
              onChange={e => setLinkType(e.target.value as LinkType)}
              className="text-xs border border-slate-300 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-brand-green"
            >
              <option value="blocks">Blocks</option>
              <option value="is_blocked_by">Blocked by</option>
              <option value="relates_to">Relates to</option>
              <option value="duplicates">Duplicates</option>
            </select>
            <input
              type="text"
              value={depSearch}
              onChange={e => setDepSearch(e.target.value)}
              placeholder="Search tasks…"
              className="flex-1 text-sm border border-slate-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-green"
              autoFocus
            />
          </div>
          <div className="max-h-32 overflow-y-auto border border-slate-200 rounded">
            {filteredAvailable.slice(0, 10).map(t => (
              <button
                key={t.taskId}
                onClick={() => {
                  onAddDependency(task.taskId, t.taskId, linkType);
                  setDepSearch('');
                  setShowDepPicker(false);
                }}
                className="w-full text-left px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              >
                {t.title}
              </button>
            ))}
            {filteredAvailable.length === 0 && (
              <p className="text-xs text-slate-400 px-2 py-1">No tasks available</p>
            )}
          </div>
          <button onClick={() => setShowDepPicker(false)} className="text-xs text-slate-400 hover:text-slate-600 mt-1">Cancel</button>
        </div>
      ) : (
        <button
          onClick={() => setShowDepPicker(true)}
          className="text-xs text-slate-500 hover:text-slate-700"
          disabled={disabled}
        >
          + Add dependency
        </button>
      )}
    </div>
  );
}
