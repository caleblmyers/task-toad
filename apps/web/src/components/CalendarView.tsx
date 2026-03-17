import { useState } from 'react';
import type { Task } from '../types';

const priorityColors: Record<string, string> = {
  critical: 'bg-red-200 text-red-800 border-red-300',
  high: 'bg-orange-200 text-orange-800 border-orange-300',
  medium: 'bg-blue-200 text-blue-800 border-blue-300',
  low: 'bg-slate-200 text-slate-700 border-slate-300',
};

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface CalendarViewProps {
  tasks: Task[];
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
}

function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfWeek(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function toDateStr(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export default function CalendarView({ tasks, selectedTask, onSelectTask }: CalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfWeek(year, month);
  const today = new Date();
  const todayStr = toDateStr(today.getFullYear(), today.getMonth(), today.getDate());

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));
  const goToday = () => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));

  // Group tasks by due date
  const tasksByDate: Record<string, Task[]> = {};
  const noDateTasks: Task[] = [];
  for (const task of tasks) {
    if (task.dueDate) {
      (tasksByDate[task.dueDate] ??= []).push(task);
    } else {
      noDateTasks.push(task);
    }
  }

  // Build calendar grid cells
  const cells: Array<{ day: number | null; dateStr: string }> = [];
  for (let i = 0; i < firstDay; i++) cells.push({ day: null, dateStr: '' });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, dateStr: toDateStr(year, month, d) });
  // Fill remaining cells to complete the last row
  while (cells.length % 7 !== 0) cells.push({ day: null, dateStr: '' });

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{formatMonthYear(currentMonth)}</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={prevMonth}
                className="px-2 py-1 text-sm text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                &#8249;
              </button>
              <button
                onClick={goToday}
                className="px-2 py-1 text-sm text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="px-2 py-1 text-sm text-slate-500 dark:text-slate-300 hover:text-slate-700 dark:hover:text-slate-200 border border-slate-200 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                &#8250;
              </button>
            </div>
          </div>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-700">
          {DAY_NAMES.map((d) => (
            <div key={d} className="px-2 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-300 text-center uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 border-l border-slate-200 dark:border-slate-700">
          {cells.map((cell, i) => {
            const dayTasks = cell.dateStr ? (tasksByDate[cell.dateStr] ?? []) : [];
            const isToday = cell.dateStr === todayStr;

            return (
              <div
                key={i}
                className={`min-h-[100px] border-r border-b border-slate-200 dark:border-slate-700 p-1 ${
                  cell.day ? 'bg-white dark:bg-slate-900' : 'bg-slate-50 dark:bg-slate-800'
                }`}
              >
                {cell.day && (
                  <>
                    <div className={`text-xs font-medium mb-1 ${
                      isToday
                        ? 'bg-blue-600 text-white w-5 h-5 rounded-full flex items-center justify-center'
                        : 'text-slate-500 px-0.5'
                    }`}>
                      {cell.day}
                    </div>
                    <div className="space-y-0.5">
                      {dayTasks.slice(0, 3).map((task) => (
                        <button
                          key={task.taskId}
                          onClick={() => onSelectTask(task)}
                          className={`w-full text-left px-1.5 py-0.5 rounded text-xs truncate border ${
                            priorityColors[task.priority] ?? priorityColors.medium
                          } ${selectedTask?.taskId === task.taskId ? 'ring-2 ring-blue-500 ring-offset-1' : ''}`}
                          title={task.title}
                        >
                          {task.title}
                        </button>
                      ))}
                      {dayTasks.length > 3 && (
                        <p className="text-xs text-slate-400 px-1">+{dayTasks.length - 3} more</p>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* No date section */}
        {noDateTasks.length > 0 && (
          <div className="mt-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">No due date ({noDateTasks.length})</p>
            <div className="flex flex-wrap gap-1.5">
              {noDateTasks.slice(0, 20).map((task) => (
                <button
                  key={task.taskId}
                  onClick={() => onSelectTask(task)}
                  className={`text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 truncate max-w-[200px] ${
                    selectedTask?.taskId === task.taskId ? 'ring-2 ring-blue-500' : ''
                  }`}
                >
                  {task.title}
                </button>
              ))}
              {noDateTasks.length > 20 && (
                <span className="text-xs text-slate-400 px-2 py-1">+{noDateTasks.length - 20} more</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
