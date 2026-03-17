import type { Task } from '../../types';
import Badge from '../shared/Badge';

interface TaskTitleEditorProps {
  task: Task;
  editingTitle: boolean;
  editTitleValue: string;
  titleEditRef: React.RefObject<HTMLInputElement>;
  allTasks?: Task[];
  disabled?: boolean;
  onStartEdit: (task: Task) => void;
  onChange: (val: string) => void;
  onSave: () => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

export default function TaskTitleEditor({
  task,
  editingTitle,
  editTitleValue,
  titleEditRef,
  allTasks = [],
  disabled,
  onStartEdit,
  onChange,
  onSave,
  onKeyDown,
}: TaskTitleEditorProps) {
  return (
    <>
      {/* Title */}
      <div className="mb-4">
        {editingTitle ? (
          <input
            ref={titleEditRef}
            type="text"
            value={editTitleValue}
            onChange={(e) => onChange(e.target.value)}
            onBlur={onSave}
            onKeyDown={onKeyDown}
            className="text-xl font-semibold text-slate-800 w-full border-b-2 border-slate-400 focus:outline-none bg-transparent"
            disabled={disabled}
          />
        ) : (
          <h2
            className="text-xl font-semibold text-slate-800 cursor-text hover:underline decoration-dashed"
            onClick={() => !disabled && onStartEdit(task)}
            title="Click to edit"
          >
            {task.title}
          </h2>
        )}
      </div>

      {/* Task Type Badge */}
      {task.taskType && task.taskType !== 'task' && (
        <div className="mb-3">
          <Badge variant={
            task.taskType === 'epic' ? 'purple' :
            task.taskType === 'story' ? 'info' :
            'neutral'
          }>
            {task.taskType.charAt(0).toUpperCase() + task.taskType.slice(1)}
          </Badge>
          {task.parentTaskId && (() => {
            const parentTask = allTasks.find((t) => t.taskId === task.parentTaskId);
            return parentTask ? (
              <span className="ml-2 text-xs text-slate-500">
                Parent: {parentTask.title}
              </span>
            ) : null;
          })()}
        </div>
      )}
    </>
  );
}
