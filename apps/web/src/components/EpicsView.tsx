import type { Task, Epic } from '../types';
import Badge from './shared/Badge';
import { statusLabel } from '../utils/taskHelpers';

function priorityVariant(p: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (p === 'critical') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'low') return 'neutral';
  return 'info';
}

interface EpicsViewProps {
  projectId: string;
  epics: Epic[];
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
}

export default function EpicsView({ epics, selectedTask, onSelectTask }: EpicsViewProps) {
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
      <div className="max-w-3xl mx-auto space-y-4">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wide">Epics</h2>
        {epics.map((epic) => {
          const isSelected = selectedTask?.taskId === epic.taskId;
          const progress = epic.progress;
          return (
            <div
              key={epic.taskId}
              role="button"
              tabIndex={0}
              onClick={() => onSelectTask(epic as unknown as Task)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectTask(epic as unknown as Task); } }}
              className={`bg-white dark:bg-slate-900 border rounded-xl overflow-hidden cursor-pointer hover:shadow-md transition-shadow ${
                isSelected ? 'border-purple-400 ring-2 ring-purple-200 dark:ring-purple-800' : 'border-slate-200 dark:border-slate-700'
              }`}
            >
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-2.5 h-2.5 rounded-full bg-purple-500 flex-shrink-0" />
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{epic.title}</span>
                  <Badge variant={epic.status === 'done' ? 'success' : epic.status === 'in_progress' ? 'info' : 'neutral'} size="sm">
                    {statusLabel(epic.status)}
                  </Badge>
                  {epic.priority && epic.priority !== 'medium' && (
                    <Badge variant={priorityVariant(epic.priority)} size="sm">{epic.priority}</Badge>
                  )}
                </div>
                {epic.description && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 ml-4.5 line-clamp-2 mb-2">{epic.description}</p>
                )}
                {progress && progress.total > 0 && (
                  <div className="ml-4.5 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden max-w-[200px]">
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
          );
        })}
      </div>
    </div>
  );
}
