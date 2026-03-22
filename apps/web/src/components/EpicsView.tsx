import { useState } from 'react';
import type { Task, Epic } from '../types';
import Badge from './shared/Badge';
import { statusLabel } from '../utils/taskHelpers';

function priorityVariant(p: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (p === 'critical') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'low') return 'neutral';
  return 'info';
}

const TYPE_COLOR: Record<string, string> = {
  epic: 'bg-purple-500',
  story: 'bg-blue-500',
  task: 'bg-green-500',
  bug: 'bg-red-500',
};

interface TaskTreeNodeProps {
  node: Epic;
  depth: number;
  selectedTaskId: string | null;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
  onSelectTask: (task: Task) => void;
}

function TaskTreeNode({ node, depth, selectedTaskId, expandedIds, onToggle, onSelectTask }: TaskTreeNodeProps) {
  const isSelected = selectedTaskId === node.taskId;
  const isExpanded = expandedIds.has(node.taskId);
  const hasChildren = node.children && node.children.length > 0;
  const progress = node.progress;
  const maxDepth = 4;
  const dotColor = TYPE_COLOR[node.taskType ?? 'epic'] ?? 'bg-slate-400';

  return (
    <div style={{ paddingLeft: depth > 0 ? `${depth * 20}px` : undefined }}>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelectTask(node as unknown as Task)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTask(node as unknown as Task); } }}
        className={`bg-white dark:bg-slate-900 border rounded-lg overflow-hidden cursor-pointer hover:shadow-md transition-shadow mb-1.5 ${
          isSelected ? 'border-purple-400 ring-2 ring-purple-200 dark:ring-purple-800' : 'border-slate-200 dark:border-slate-700'
        }`}
      >
        <div className="px-3 py-2">
          <div className="flex items-center gap-2">
            {hasChildren && depth < maxDepth && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onToggle(node.taskId); }}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xs w-4 h-4 flex items-center justify-center flex-shrink-0"
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▼' : '▶'}
              </button>
            )}
            {(!hasChildren || depth >= maxDepth) && <span className="w-4 flex-shrink-0" />}
            <span className={`w-2 h-2 rounded-full ${dotColor} flex-shrink-0`} />
            <span className="font-medium text-slate-900 dark:text-slate-100 text-sm truncate">{node.title}</span>
            <Badge variant={node.status === 'done' ? 'success' : node.status === 'in_progress' ? 'info' : 'neutral'} size="sm">
              {statusLabel(node.status)}
            </Badge>
            {node.priority && node.priority !== 'medium' && (
              <Badge variant={priorityVariant(node.priority)} size="sm">{node.priority}</Badge>
            )}
          </div>
          {progress && progress.total > 0 && (
            <div className="ml-8 mt-1 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[180px]">
                <div
                  className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${progress.percentage}%` }}
                />
              </div>
              <span className="text-xs text-slate-500 dark:text-slate-400">
                {progress.completed}/{progress.total} ({progress.percentage}%)
              </span>
            </div>
          )}
        </div>
      </div>
      {isExpanded && hasChildren && depth < maxDepth && (
        <div>
          {node.children!.map((child) => (
            <TaskTreeNode
              key={child.taskId}
              node={child}
              depth={depth + 1}
              selectedTaskId={selectedTaskId}
              expandedIds={expandedIds}
              onToggle={onToggle}
              onSelectTask={onSelectTask}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface EpicsViewProps {
  projectId: string;
  epics: Epic[];
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
}

export default function EpicsView({ epics, selectedTask, onSelectTask }: EpicsViewProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggle = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (epics.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center space-y-2">
          <p className="text-slate-500 dark:text-slate-400 text-sm">No epics yet.</p>
          <p className="text-xs text-slate-400">Epics are created when you generate a project plan or PRD breakdown.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-3xl mx-auto space-y-1">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide mb-3">Hierarchy</h2>
        {epics.map((epic) => (
          <TaskTreeNode
            key={epic.taskId}
            node={epic}
            depth={0}
            selectedTaskId={selectedTask?.taskId ?? null}
            expandedIds={expandedIds}
            onToggle={handleToggle}
            onSelectTask={onSelectTask}
          />
        ))}
      </div>
    </div>
  );
}
