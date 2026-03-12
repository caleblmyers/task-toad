import type { Task, ToolSuggestion, Sprint, OrgUser } from '../types';

function parseTools(raw?: string | null): ToolSuggestion[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as ToolSuggestion[]; } catch { return []; }
}

const categoryColors: Record<string, string> = {
  'ai-model': 'bg-purple-100 text-purple-700',
  'code-editor': 'bg-blue-100 text-blue-700',
  'design-tool': 'bg-pink-100 text-pink-700',
  'database': 'bg-yellow-100 text-yellow-700',
  'cloud-service': 'bg-sky-100 text-sky-700',
  'communication': 'bg-green-100 text-green-700',
  'testing': 'bg-orange-100 text-orange-700',
  'other': 'bg-slate-100 text-slate-600',
};

export interface TaskDetailPanelProps {
  task: Task;
  subtasks: Task[];
  editingTitle: boolean;
  editTitleValue: string;
  titleEditRef: React.RefObject<HTMLInputElement>;
  generatingInstructions: string | null;
  sprints: Sprint[];
  orgUsers: OrgUser[];
  disabled?: boolean;
  onStartEditTitle: (task: Task) => void;
  onTitleChange: (val: string) => void;
  onTitleSave: () => void;
  onTitleKeyDown: (e: React.KeyboardEvent) => void;
  onStatusChange: (taskId: string, status: Task['status']) => void;
  onSubtaskStatusChange: (parentId: string, taskId: string, status: Task['status']) => void;
  onGenerateInstructions: (task: Task) => void;
  onAssignSprint: (taskId: string, sprintId: string | null) => void;
  onAssignUser: (taskId: string, assigneeId: string | null) => void;
  onDueDateChange: (taskId: string, dueDate: string | null) => void;
  onClose?: () => void;
  isDrawer?: boolean;
}

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

function PanelContent({ task, subtasks, editingTitle, editTitleValue, titleEditRef, generatingInstructions, sprints, orgUsers, disabled, onStartEditTitle, onTitleChange, onTitleSave, onTitleKeyDown, onStatusChange, onSubtaskStatusChange, onGenerateInstructions, onAssignSprint, onAssignUser, onDueDateChange }: Omit<TaskDetailPanelProps, 'onClose' | 'isDrawer'>) {
  const tools = parseTools(task.suggestedTools);

  return (
    <div className="p-6 max-w-2xl">
      {/* Title */}
      <div className="mb-4">
        {editingTitle ? (
          <input
            ref={titleEditRef}
            type="text"
            value={editTitleValue}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleSave}
            onKeyDown={onTitleKeyDown}
            className="text-xl font-semibold text-slate-800 w-full border-b-2 border-slate-400 focus:outline-none bg-transparent"
            disabled={disabled}
          />
        ) : (
          <h2
            className="text-xl font-semibold text-slate-800 cursor-text hover:underline decoration-dashed"
            onClick={() => !disabled && onStartEditTitle(task)}
            title="Click to edit"
          >
            {task.title}
          </h2>
        )}
      </div>

      {/* Status */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Status</label>
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.taskId, e.target.value as Task['status'])}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm"
          disabled={disabled}
        >
          <option value="todo">To do</option>
          <option value="in_progress">In progress</option>
          <option value="done">Done</option>
        </select>
      </div>

      {/* Sprint */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sprint</label>
        <select
          value={task.sprintId ?? ''}
          onChange={(e) => onAssignSprint(task.taskId, e.target.value || null)}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm"
          disabled={disabled}
        >
          <option value="">Backlog (unassigned)</option>
          {sprints.map((s) => (
            <option key={s.sprintId} value={s.sprintId}>
              {s.name}{s.isActive ? ' ★' : ''}
            </option>
          ))}
        </select>
      </div>

      {/* Assignee */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Assignee</label>
        <select
          value={task.assigneeId ?? ''}
          onChange={(e) => onAssignUser(task.taskId, e.target.value || null)}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm"
          disabled={disabled}
        >
          <option value="">Unassigned</option>
          {orgUsers.map((u) => (
            <option key={u.userId} value={u.userId}>{u.email}</option>
          ))}
        </select>
      </div>

      {/* Due Date */}
      <div className="mb-4">
        <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Due Date</label>
        <input
          type="date"
          value={task.dueDate ?? ''}
          onChange={(e) => onDueDateChange(task.taskId, e.target.value || null)}
          className="block mt-1 border border-slate-300 rounded px-2 py-1 text-sm w-full"
          disabled={disabled}
        />
      </div>

      {/* Metadata: priority + estimate */}
      {(task.priority !== 'medium' || task.estimatedHours != null) && (
        <div className="mb-4 flex items-center gap-2">
          <span className={`text-xs px-2 py-0.5 rounded font-medium ${priorityStyles[task.priority] ?? priorityStyles.medium}`}>
            {task.priority}
          </span>
          {task.estimatedHours != null && (
            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
              ~{formatHours(task.estimatedHours)}
            </span>
          )}
        </div>
      )}

      {/* Description */}
      {task.description && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Description</p>
          <p className="text-slate-700 text-sm leading-relaxed">{task.description}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Instructions</p>
        {task.instructions ? (
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
            {task.instructions}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onGenerateInstructions(task)}
            disabled={disabled || generatingInstructions === task.taskId}
            className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
          >
            {generatingInstructions === task.taskId ? 'Generating…' : '✦ Generate instructions'}
          </button>
        )}
      </div>

      {/* Suggested Tools */}
      {tools.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Suggested Tools</p>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool, i) => (
              <div key={i} className={`px-2.5 py-1.5 rounded-lg text-xs ${categoryColors[tool.category] ?? categoryColors.other}`}>
                <span className="font-semibold">{tool.name}</span>
                <span className="ml-1 opacity-60">· {tool.category}</span>
                {tool.reason && (
                  <p className="mt-0.5 opacity-75 font-normal">{tool.reason}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Subtasks */}
      {subtasks.length > 0 && (
        <div>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Subtasks</p>
          <ul className="space-y-2">
            {subtasks.map((st) => (
              <li key={st.taskId} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">{st.title}</p>
                  <select
                    value={st.status}
                    onChange={(e) =>
                      onSubtaskStatusChange(task.taskId, st.taskId, e.target.value as Task['status'])
                    }
                    className="text-xs border border-slate-300 rounded px-1.5 py-0.5 flex-shrink-0"
                    disabled={disabled}
                  >
                    <option value="todo">To do</option>
                    <option value="in_progress">In progress</option>
                    <option value="done">Done</option>
                  </select>
                </div>
                {st.description && (
                  <p className="text-xs text-slate-500 mt-1">{st.description}</p>
                )}
                {st.instructions && (
                  <details className="mt-2">
                    <summary className="text-xs text-slate-500 cursor-pointer">Instructions</summary>
                    <p className="mt-1 text-xs text-slate-600 leading-relaxed whitespace-pre-wrap">{st.instructions}</p>
                  </details>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function TaskDetailPanel(props: TaskDetailPanelProps) {
  const { onClose, isDrawer: _isDrawer = false, ...contentProps } = props;

  return (
    <>
      {onClose && (
        <div className="flex items-center justify-end px-4 pt-4 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
      )}
      <PanelContent {...contentProps} />
    </>
  );
}
