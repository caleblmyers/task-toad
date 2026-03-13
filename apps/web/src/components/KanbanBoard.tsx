import { useRef } from 'react';
import type { Task } from '../types';

const COLUMN_ACCENTS = [
  { accent: 'border-t-slate-400', barColor: 'border-l-slate-300', pillClass: 'bg-slate-100 text-slate-500' },
  { accent: 'border-t-blue-500',  barColor: 'border-l-blue-400',  pillClass: 'bg-blue-100 text-blue-700' },
  { accent: 'border-t-green-500', barColor: 'border-l-green-400', pillClass: 'bg-green-100 text-green-700' },
  { accent: 'border-t-purple-500',barColor: 'border-l-purple-400',pillClass: 'bg-purple-100 text-purple-700' },
  { accent: 'border-t-orange-500',barColor: 'border-l-orange-400',pillClass: 'bg-orange-100 text-orange-700' },
];

interface KanbanBoardProps {
  columns: string[];
  tasks: Task[];
  subtasks: Record<string, Task[]>;
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
  onColumnChange: (taskId: string, columnName: string) => void;
}

export default function KanbanBoard({ columns, tasks, subtasks, selectedTask, onSelectTask, onColumnChange }: KanbanBoardProps) {
  const draggedId = useRef<string | null>(null);

  return (
    <div className="flex gap-4 h-full">
      {columns.map((col, idx) => {
        const style = COLUMN_ACCENTS[idx % COLUMN_ACCENTS.length];
        const colTasks = tasks.filter((t) =>
          idx === 0 ? (t.sprintColumn === col || t.sprintColumn == null) : t.sprintColumn === col
        );
        return (
          <div
            key={col}
            className={`flex flex-col w-72 min-w-[18rem] flex-shrink-0 bg-slate-100 rounded-xl border-t-4 ${style.accent}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = draggedId.current;
              if (!id) return;
              const task = tasks.find((t) => t.taskId === id);
              if (task && task.sprintColumn !== col) {
                onColumnChange(id, col);
              }
              draggedId.current = null;
            }}
          >
            <div className="flex items-center justify-between px-3 py-2.5">
              <span className="text-sm font-semibold text-slate-700">{col}</span>
              <span className="text-xs font-medium bg-white text-slate-500 rounded-full px-2 py-0.5 shadow-sm">
                {colTasks.length}
              </span>
            </div>

            <div className="flex-1 px-2 pb-2 space-y-2 min-h-[4rem]">
              {colTasks.length === 0 ? (
                <div className="flex items-center justify-center h-16 text-xs text-slate-400">
                  No tasks
                </div>
              ) : (
                colTasks.map((task) => {
                  const isSelected = selectedTask?.taskId === task.taskId;
                  const subtaskCount = subtasks[task.taskId]?.length ?? 0;
                  return (
                    <div
                      key={task.taskId}
                      draggable
                      onDragStart={() => { draggedId.current = task.taskId; }}
                      onClick={() => onSelectTask(task)}
                      className={`bg-white rounded-lg p-3 shadow-sm border border-slate-200 border-l-4 ${style.barColor}
                        cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow duration-150
                        ${isSelected ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                    >
                      <p className="text-sm font-medium text-slate-800 leading-snug line-clamp-2">{task.title}</p>
                      {task.description && (
                        <p className="text-xs text-slate-500 mt-1 line-clamp-2">{task.description}</p>
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
                      <div className="flex items-center justify-between mt-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${style.pillClass}`}>{col}</span>
                        {subtaskCount > 0 && (
                          <span className="text-xs text-slate-400">{subtaskCount} subtasks</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
