import { useState } from 'react';
import { List } from 'react-window';
import type { Task, Sprint, OrgUser } from '../types';
import { statusLabel } from '../utils/taskHelpers';
import Badge from './shared/Badge';

function priorityVariant(p: string): 'danger' | 'warning' | 'info' | 'neutral' {
  if (p === 'critical') return 'danger';
  if (p === 'high') return 'warning';
  if (p === 'low') return 'neutral';
  return 'info';
}

const TABLE_ROW_HEIGHT = 40;
const MAX_TABLE_HEIGHT = 600;
const VIRTUALIZE_TABLE_THRESHOLD = 50;

type SortField = 'title' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'estimatedHours' | 'sprint';
type SortDir = 'asc' | 'desc';

const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };

interface TableViewProps {
  tasks: Task[];
  sprints: Sprint[];
  orgUsers: OrgUser[];
  selectedTask: Task | null;
  selectedTaskIds: Set<string>;
  statuses: string[];
  onSelectTask: (task: Task) => void;
  onToggleTaskId: (taskId: string) => void;
  onToggleAll: (taskIds: string[]) => void;
  onStatusChange: (taskId: string, status: string) => void;
  onAssignUser: (taskId: string, assigneeId: string | null) => void;
  onDueDateChange: (taskId: string, dueDate: string | null) => void;
  onAssignSprint: (taskId: string, sprintId: string | null) => void;
}

export default function TableView({
  tasks, sprints, orgUsers, selectedTask, selectedTaskIds, statuses,
  onSelectTask, onToggleTaskId, onToggleAll,
  onStatusChange, onAssignUser, onDueDateChange, onAssignSprint,
}: TableViewProps) {
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const showCheckboxes = selectedTaskIds.size > 0;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortField(null); setSortDir('asc'); }
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDir === 'asc' ? ' \u2191' : ' \u2193';
  };

  const sorted = [...tasks].sort((a, b) => {
    if (!sortField) return 0;
    const dir = sortDir === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'title': return a.title.localeCompare(b.title) * dir;
      case 'status': return a.status.localeCompare(b.status) * dir;
      case 'priority': return ((priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2)) * dir;
      case 'assignee': return ((a.assigneeId ?? '') .localeCompare(b.assigneeId ?? '')) * dir;
      case 'dueDate': return ((a.dueDate ?? '').localeCompare(b.dueDate ?? '')) * dir;
      case 'estimatedHours': return ((a.estimatedHours ?? 0) - (b.estimatedHours ?? 0)) * dir;
      case 'sprint': return ((a.sprintId ?? '').localeCompare(b.sprintId ?? '')) * dir;
      default: return 0;
    }
  });

  const allIds = tasks.map((t) => t.taskId);
  const allChecked = allIds.length > 0 && allIds.every((id) => selectedTaskIds.has(id));

  const thClass = 'px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide cursor-pointer hover:text-slate-700 dark:hover:text-slate-200 select-none whitespace-nowrap';
  const tdClass = 'px-3 py-2 text-sm text-slate-700 dark:text-slate-300 whitespace-nowrap';
  const selectClass = 'text-xs border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-700 dark:text-slate-200';

  return (
    <div className="flex-1 overflow-auto px-6 py-4">
      <div className="max-w-6xl mx-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <th className="px-3 py-2 w-8">
                <input
                  type="checkbox"
                  checked={allChecked}
                  onChange={() => onToggleAll(allIds)}
                  className={`w-3.5 h-3.5 rounded border-slate-300 text-slate-600 cursor-pointer ${showCheckboxes ? 'opacity-100' : 'opacity-0 hover:opacity-100'} transition-opacity`}
                />
              </th>
              <th className={thClass} onClick={() => handleSort('title')}>Title{sortIndicator('title')}</th>
              <th className={thClass} onClick={() => handleSort('status')}>Status{sortIndicator('status')}</th>
              <th className={thClass} onClick={() => handleSort('priority')}>Priority{sortIndicator('priority')}</th>
              <th className={thClass} onClick={() => handleSort('assignee')}>Assignee{sortIndicator('assignee')}</th>
              <th className={thClass} onClick={() => handleSort('dueDate')}>Due Date{sortIndicator('dueDate')}</th>
              <th className={thClass} onClick={() => handleSort('estimatedHours')}>Estimate{sortIndicator('estimatedHours')}</th>
              <th className={thClass} onClick={() => handleSort('sprint')}>Sprint{sortIndicator('sprint')}</th>
              <th className={thClass}>Labels</th>
            </tr>
          </thead>
          {sorted.length > VIRTUALIZE_TABLE_THRESHOLD ? (
            <tbody>
              <tr>
                <td colSpan={9} className="p-0">
                  <List
                    style={{ height: Math.min(sorted.length * TABLE_ROW_HEIGHT, MAX_TABLE_HEIGHT) }}
                    rowCount={sorted.length}
                    rowHeight={TABLE_ROW_HEIGHT}
                    rowComponent={({ index, style: rowStyle }) => {
                      const task = sorted[index];
                      const isSelected = selectedTask?.taskId === task.taskId;
                      return (
                        <div
                          style={rowStyle}
                          className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''} ${task.archived ? 'opacity-50' : ''}`}
                          onClick={() => onSelectTask(task)}
                        >
                          <div className="grid items-center" style={{ gridTemplateColumns: '2rem 1fr 6rem 5rem 8rem 7rem 5rem 8rem 4rem', height: TABLE_ROW_HEIGHT }}>
                            <div className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={selectedTaskIds.has(task.taskId)}
                                onChange={(e) => { e.stopPropagation(); onToggleTaskId(task.taskId); }}
                                onClick={(e) => e.stopPropagation()}
                                className={`w-3.5 h-3.5 rounded border-slate-300 text-slate-600 cursor-pointer ${showCheckboxes ? 'opacity-100' : 'opacity-0'} transition-opacity`}
                              />
                            </div>
                            <div className={`${tdClass} font-medium truncate`}>{task.title}</div>
                            <div className={tdClass} onClick={(e) => e.stopPropagation()}>
                              <select value={task.status} onChange={(e) => onStatusChange(task.taskId, e.target.value)} className={selectClass}>
                                {statuses.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
                              </select>
                            </div>
                            <div className={tdClass}>
                              <Badge variant={priorityVariant(task.priority)} size="sm">{task.priority}</Badge>
                            </div>
                            <div className={tdClass} onClick={(e) => e.stopPropagation()}>
                              <select value={task.assigneeId ?? ''} onChange={(e) => onAssignUser(task.taskId, e.target.value || null)} className={`${selectClass} max-w-[120px]`}>
                                <option value="">—</option>
                                {orgUsers.map((u) => <option key={u.userId} value={u.userId}>{u.email}</option>)}
                              </select>
                            </div>
                            <div className={tdClass} onClick={(e) => e.stopPropagation()}>
                              <input type="date" value={task.dueDate ?? ''} onChange={(e) => onDueDateChange(task.taskId, e.target.value || null)} className={selectClass} />
                            </div>
                            <div className={tdClass}>{task.estimatedHours != null ? `${task.estimatedHours}h` : '—'}</div>
                            <div className={tdClass} onClick={(e) => e.stopPropagation()}>
                              <select value={task.sprintId ?? ''} onChange={(e) => onAssignSprint(task.taskId, e.target.value || null)} className={`${selectClass} max-w-[120px]`}>
                                <option value="">Backlog</option>
                                {sprints.filter((s) => !s.closedAt).map((s) => <option key={s.sprintId} value={s.sprintId}>{s.name}</option>)}
                              </select>
                            </div>
                            <div className={tdClass}>
                              <div className="flex items-center gap-0.5">
                                {(task.labels ?? []).slice(0, 3).map((l) => <span key={l.labelId} className="w-2 h-2 rounded-full" style={{ backgroundColor: l.color }} title={l.name} />)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }}
                    rowProps={{}}
                  />
                </td>
              </tr>
            </tbody>
          ) : (
            <tbody>
              {sorted.map((task) => {
                const isSelected = selectedTask?.taskId === task.taskId;
                return (
                  <tr
                    key={task.taskId}
                    className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/30' : ''} ${task.archived ? 'opacity-50' : ''}`}
                    onClick={() => onSelectTask(task)}
                  >
                    <td className="px-3 py-2">
                      <input
                        type="checkbox"
                        checked={selectedTaskIds.has(task.taskId)}
                        onChange={(e) => { e.stopPropagation(); onToggleTaskId(task.taskId); }}
                        onClick={(e) => e.stopPropagation()}
                        className={`w-3.5 h-3.5 rounded border-slate-300 text-slate-600 cursor-pointer ${showCheckboxes ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
                      />
                    </td>
                    <td className={`${tdClass} font-medium max-w-xs truncate`}>{task.title}</td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={task.status}
                        onChange={(e) => onStatusChange(task.taskId, e.target.value)}
                        className={selectClass}
                      >
                        {statuses.map((s) => (
                          <option key={s} value={s}>{statusLabel(s)}</option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <Badge variant={priorityVariant(task.priority)} size="sm">{task.priority}</Badge>
                    </td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={task.assigneeId ?? ''}
                        onChange={(e) => onAssignUser(task.taskId, e.target.value || null)}
                        className={`${selectClass} max-w-[120px]`}
                      >
                        <option value="">—</option>
                        {orgUsers.map((u) => (
                          <option key={u.userId} value={u.userId}>{u.email}</option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="date"
                        value={task.dueDate ?? ''}
                        onChange={(e) => onDueDateChange(task.taskId, e.target.value || null)}
                        className={selectClass}
                      />
                    </td>
                    <td className={tdClass}>
                      {task.estimatedHours != null ? `${task.estimatedHours}h` : '—'}
                    </td>
                    <td className={tdClass} onClick={(e) => e.stopPropagation()}>
                      <select
                        value={task.sprintId ?? ''}
                        onChange={(e) => onAssignSprint(task.taskId, e.target.value || null)}
                        className={`${selectClass} max-w-[120px]`}
                      >
                        <option value="">Backlog</option>
                        {sprints.filter((s) => !s.closedAt).map((s) => (
                          <option key={s.sprintId} value={s.sprintId}>{s.name}</option>
                        ))}
                      </select>
                    </td>
                    <td className={tdClass}>
                      <div className="flex items-center gap-0.5">
                        {(task.labels ?? []).slice(0, 3).map((l) => (
                          <span
                            key={l.labelId}
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: l.color }}
                            title={l.name}
                          />
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-slate-400">No tasks to display</td>
                </tr>
              )}
            </tbody>
          )}
        </table>
      </div>
    </div>
  );
}
