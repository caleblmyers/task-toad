import type { Task, Sprint, OrgUser } from '../types';

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

interface BacklogViewProps {
  tasks: Task[];
  sprints: Sprint[];
  orgUsers: OrgUser[];
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
  onCreateSprint: () => void;
  onEditSprint: (sprint: Sprint) => void;
  onDeleteSprint: (sprintId: string) => void;
  onActivateSprint: (sprintId: string) => void;
  onCloseSprint: (sprintId: string) => void;
  onAssignSprint: (taskId: string, sprintId: string | null) => void;
  onPlanSprints: () => void;
}

function TaskRow({ task, orgUsers, selectedTask, onSelectTask }: {
  task: Task;
  orgUsers: OrgUser[];
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
}) {
  const isSelected = selectedTask?.taskId === task.taskId;
  const assignee = orgUsers.find((u) => u.userId === task.assigneeId);

  return (
    <button
      type="button"
      onClick={() => onSelectTask(task)}
      className={`w-full text-left px-3 py-2 rounded-lg border border-transparent hover:bg-slate-50 hover:border-slate-200 transition-colors flex items-center gap-2 ${
        isSelected ? 'bg-blue-50 border-blue-200' : ''
      }`}
    >
      <span className="flex-1 text-sm text-slate-800 leading-snug">{task.title}</span>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {task.priority && task.priority !== 'medium' && (
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityStyles[task.priority] ?? ''}`}>
            {task.priority}
          </span>
        )}
        {task.estimatedHours != null && (
          <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            ~{formatHours(task.estimatedHours)}
          </span>
        )}
        {task.sprintColumn && (
          <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded">
            {task.sprintColumn}
          </span>
        )}
        {assignee && (
          <span
            className="text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full font-medium"
            title={assignee.email}
          >
            {assignee.email.charAt(0).toUpperCase()}
          </span>
        )}
      </div>
    </button>
  );
}

export default function BacklogView({
  tasks,
  sprints,
  orgUsers,
  selectedTask,
  onSelectTask,
  onCreateSprint,
  onEditSprint,
  onDeleteSprint,
  onActivateSprint,
  onCloseSprint,
  onPlanSprints,
}: BacklogViewProps) {
  const openSprints = sprints.filter((s) => !s.closedAt);
  const bySprint: Record<string, Task[]> = Object.fromEntries(
    openSprints.map((s) => [s.sprintId, tasks.filter((t) => t.sprintId === s.sprintId)])
  );
  const backlog = tasks.filter((t) => !t.sprintId);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide">Backlog</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onPlanSprints}
              className="text-sm text-indigo-600 hover:text-indigo-800 px-3 py-1 border border-indigo-200 bg-indigo-50 rounded-lg hover:bg-indigo-100"
            >
              ✦ AI Plan Sprints
            </button>
            <button
              type="button"
              onClick={onCreateSprint}
              className="text-sm text-slate-600 hover:text-slate-800 px-3 py-1 border border-slate-300 rounded-lg hover:bg-slate-50"
            >
              + Create Sprint
            </button>
          </div>
        </div>

        {openSprints.length === 0 && (
          <div className="text-sm text-slate-400 bg-slate-50 rounded-lg p-4 text-center">
            No sprints yet. Create a sprint to organize your work into time-boxed periods.
          </div>
        )}

        {/* Sprint sections */}
        {openSprints.map((sprint) => {
          const sprintTasks = bySprint[sprint.sprintId] ?? [];
          const dateRange = sprint.startDate && sprint.endDate
            ? `${sprint.startDate} → ${sprint.endDate}`
            : sprint.startDate ? `from ${sprint.startDate}` : null;
          return (
            <div key={sprint.sprintId} className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-800 text-sm">{sprint.name}</span>
                  <span className="text-xs text-slate-400">({sprintTasks.length} tasks)</span>
                  {dateRange && <span className="text-xs text-slate-400">{dateRange}</span>}
                  {sprint.isActive && (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">
                      Active
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEditSprint(sprint)}
                    className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1 border border-slate-200 rounded hover:bg-white"
                    title="Edit sprint"
                  >
                    Edit
                  </button>
                  {sprint.isActive && (
                    <button
                      type="button"
                      onClick={() => onCloseSprint(sprint.sprintId)}
                      className="text-xs text-slate-500 hover:text-red-600 px-2 py-1 border border-slate-300 rounded hover:border-red-300 hover:bg-red-50"
                    >
                      Close Sprint
                    </button>
                  )}
                  {!sprint.isActive && (
                    <>
                      <button
                        type="button"
                        onClick={() => onActivateSprint(sprint.sprintId)}
                        className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 border border-slate-300 rounded hover:bg-white"
                      >
                        Set Active
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(`Delete sprint "${sprint.name}"? Tasks will be moved to the backlog.`)) {
                            onDeleteSprint(sprint.sprintId);
                          }
                        }}
                        className="text-xs text-slate-400 hover:text-red-600 px-2 py-1 border border-slate-200 rounded hover:border-red-300 hover:bg-red-50"
                        title="Delete sprint"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
              <div className="px-3 py-2 space-y-1">
                {sprintTasks.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 px-1">No tasks assigned to this sprint.</p>
                ) : (
                  sprintTasks.map((task) => (
                    <TaskRow
                      key={task.taskId}
                      task={task}
                      orgUsers={orgUsers}
                      selectedTask={selectedTask}
                      onSelectTask={onSelectTask}
                    />
                  ))
                )}
              </div>
            </div>
          );
        })}

        {/* Backlog section */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200">
            <span className="font-semibold text-slate-800 text-sm">Backlog (unassigned)</span>
            <span className="text-xs text-slate-400 ml-2">({backlog.length} tasks)</span>
          </div>
          <div className="px-3 py-2 space-y-1">
            {backlog.length === 0 ? (
              <p className="text-xs text-slate-400 py-2 px-1">No unassigned tasks.</p>
            ) : (
              backlog.map((task) => (
                <TaskRow
                  key={task.taskId}
                  task={task}
                  orgUsers={orgUsers}
                  selectedTask={selectedTask}
                  onSelectTask={onSelectTask}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
