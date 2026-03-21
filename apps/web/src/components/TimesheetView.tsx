import { useState, useEffect, useCallback, useRef } from 'react';
import { gql } from '../api/client';
import { TIMESHEET_DATA_QUERY, LOG_TIME_MUTATION, UPDATE_TIME_ENTRY_MUTATION, DELETE_TIME_ENTRY_MUTATION } from '../api/queries';
import { useAuth } from '../auth/context';
import type { OrgUser } from '../types';

interface TimesheetEntry {
  date: string;
  minutes: number;
  timeEntryId: string | null;
}

interface TimesheetRow {
  taskId: string;
  taskTitle: string;
  taskStatus: string;
  entries: TimesheetEntry[];
  weekTotal: number;
}

interface TimesheetData {
  rows: TimesheetRow[];
  dailyTotals: number[];
  weekTotal: number;
}

interface TimesheetViewProps {
  projectId: string;
  orgUsers: OrgUser[];
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getMonday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function formatHours(minutes: number): string {
  if (minutes === 0) return '—';
  const h = minutes / 60;
  return h % 1 === 0 ? `${h}h` : `${h.toFixed(1)}h`;
}

function toDateStr(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const statusColors: Record<string, string> = {
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  todo: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  done: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
};

export default function TimesheetView({ projectId, orgUsers }: TimesheetViewProps) {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [filterUserId, setFilterUserId] = useState<string | undefined>(user?.userId);
  const [data, setData] = useState<TimesheetData | null>(null);
  const [loading, setLoading] = useState(false);
  const [editingCell, setEditingCell] = useState<{ taskId: string; dateIndex: number } | null>(null);
  const [editValue, setEditValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const weekStartStr = toDateStr(weekStart);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const result = await gql<{ timesheetData: TimesheetData }>(TIMESHEET_DATA_QUERY, {
        projectId,
        userId: filterUserId || null,
        weekStart: weekStartStr,
      });
      setData(result.timesheetData);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [projectId, filterUserId, weekStartStr]);

  useEffect(() => { loadData(); }, [loadData]);

  useEffect(() => {
    if (editingCell && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editingCell]);

  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return toDateStr(d);
  });

  const today = toDateStr(new Date());

  const handleCellClick = (taskId: string, dateIndex: number, currentMinutes: number) => {
    setEditingCell({ taskId, dateIndex });
    setEditValue(currentMinutes > 0 ? (currentMinutes / 60).toString() : '');
  };

  const getRowIndex = useCallback((taskId: string): number => {
    if (!data) return -1;
    return data.rows.findIndex((r) => r.taskId === taskId);
  }, [data]);

  const focusCell = useCallback((rowIndex: number, colIndex: number) => {
    if (!data) return;
    const clampedRow = Math.max(0, Math.min(rowIndex, data.rows.length - 1));
    const clampedCol = Math.max(0, Math.min(colIndex, 6));
    const row = data.rows[clampedRow];
    if (row) {
      const entry = row.entries[clampedCol];
      setEditingCell({ taskId: row.taskId, dateIndex: clampedCol });
      setEditValue(entry && entry.minutes > 0 ? (entry.minutes / 60).toString() : '');
    }
  }, [data]);

  const handleCellSave = async (nextCell?: { rowIndex: number; colIndex: number }) => {
    if (!editingCell || !data) return;

    const { taskId, dateIndex } = editingCell;
    const hours = parseFloat(editValue);
    const minutes = isNaN(hours) || hours < 0 ? 0 : Math.round(hours * 60);
    const date = weekDates[dateIndex];

    // Find the existing entry
    const row = data.rows.find((r) => r.taskId === taskId);
    const entry = row?.entries[dateIndex];

    // Move to next cell if specified, otherwise clear editing
    if (nextCell) {
      focusCell(nextCell.rowIndex, nextCell.colIndex);
    } else {
      setEditingCell(null);
    }

    if (entry?.timeEntryId && minutes > 0) {
      // Update existing entry
      await gql<unknown>(UPDATE_TIME_ENTRY_MUTATION, {
        timeEntryId: entry.timeEntryId,
        durationMinutes: minutes,
      });
      await loadData();
    } else if (!entry?.timeEntryId && minutes > 0) {
      // Create new entry
      await gql<unknown>(LOG_TIME_MUTATION, {
        taskId,
        durationMinutes: minutes,
        loggedDate: date,
      });
      await loadData();
    } else if (entry?.timeEntryId && minutes === 0) {
      // Delete entry when set to 0 or cleared
      await gql<{ deleteTimeEntry: boolean }>(DELETE_TIME_ENTRY_MUTATION, {
        timeEntryId: entry.timeEntryId,
      });
      await loadData();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!editingCell || !data) return;
    const rowIndex = getRowIndex(editingCell.taskId);
    const colIndex = editingCell.dateIndex;

    if (e.key === 'Enter') {
      e.preventDefault();
      // Save and move down
      handleCellSave({ rowIndex: rowIndex + 1, colIndex });
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setEditingCell(null);
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        // Previous cell
        if (colIndex > 0) {
          handleCellSave({ rowIndex, colIndex: colIndex - 1 });
        } else if (rowIndex > 0) {
          handleCellSave({ rowIndex: rowIndex - 1, colIndex: 6 });
        }
      } else {
        // Next cell
        if (colIndex < 6) {
          handleCellSave({ rowIndex, colIndex: colIndex + 1 });
        } else if (rowIndex < data.rows.length - 1) {
          handleCellSave({ rowIndex: rowIndex + 1, colIndex: 0 });
        }
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      handleCellSave({ rowIndex: rowIndex - 1, colIndex });
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      handleCellSave({ rowIndex: rowIndex + 1, colIndex });
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      handleCellSave({ rowIndex, colIndex: colIndex - 1 });
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      handleCellSave({ rowIndex, colIndex: colIndex + 1 });
    }
  };

  const prevWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() - 7);
    setWeekStart(d);
  };

  const nextWeek = () => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + 7);
    setWeekStart(d);
  };

  const goToCurrentWeek = () => {
    setWeekStart(getMonday(new Date()));
  };

  const isCurrentWeek = toDateStr(getMonday(new Date())) === weekStartStr;

  return (
    <div className="flex-1 overflow-auto px-6 py-4">
      {/* Header controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <button
            onClick={prevWeek}
            className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            ← Prev
          </button>
          <button
            onClick={goToCurrentWeek}
            disabled={isCurrentWeek}
            className={`px-3 py-1 text-sm rounded border ${
              isCurrentWeek
                ? 'border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 cursor-default'
                : 'border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300'
            }`}
          >
            This Week
          </button>
          <button
            onClick={nextWeek}
            className="px-2 py-1 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            Next →
          </button>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200 ml-2">
            {formatDate(weekDates[0])} — {formatDate(weekDates[6])}
          </span>
        </div>
        <div>
          <select
            value={filterUserId ?? ''}
            onChange={(e) => setFilterUserId(e.target.value || undefined)}
            className="text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          >
            <option value="">All Users</option>
            {orgUsers.map((u) => (
              <option key={u.userId} value={u.userId}>
                {u.email}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Timesheet grid */}
      {loading && !data ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 py-8 text-center">Loading timesheet...</div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-3 py-2 font-medium text-slate-600 dark:text-slate-300 w-[280px] min-w-[200px]">
                  Task
                </th>
                {weekDates.map((date, i) => (
                  <th
                    key={date}
                    className={`text-center px-2 py-2 font-medium text-slate-600 dark:text-slate-300 w-[90px] ${
                      date === today ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                    }`}
                  >
                    <div>{DAY_LABELS[i]}</div>
                    <div className="text-xs font-normal text-slate-400">{formatDate(date)}</div>
                  </th>
                ))}
                <th className="text-center px-2 py-2 font-medium text-slate-600 dark:text-slate-300 w-[80px]">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {data && data.rows.length > 0 ? (
                data.rows.map((row) => (
                  <tr key={row.taskId} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-1.5 py-0.5 rounded ${statusColors[row.taskStatus] ?? statusColors.todo}`}>
                          {row.taskStatus.replace('_', ' ')}
                        </span>
                        <span className="text-slate-700 dark:text-slate-200 truncate" title={row.taskTitle}>
                          {row.taskTitle}
                        </span>
                      </div>
                    </td>
                    {row.entries.map((entry, i) => {
                      const isEditing = editingCell?.taskId === row.taskId && editingCell.dateIndex === i;
                      const isToday = weekDates[i] === today;
                      return (
                        <td
                          key={entry.date}
                          className={`text-center px-1 py-1 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                        >
                          {isEditing ? (
                            <input
                              ref={inputRef}
                              type="number"
                              step="0.25"
                              min="0"
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              onBlur={() => handleCellSave()}
                              onKeyDown={handleKeyDown}
                              className="w-16 text-center text-sm border border-blue-400 rounded px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400"
                            />
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCellClick(row.taskId, i, entry.minutes)}
                              className="w-full py-1 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded cursor-text"
                              title="Click to edit"
                            >
                              {formatHours(entry.minutes)}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="text-center px-2 py-2 font-medium text-slate-700 dark:text-slate-200">
                      {row.weekTotal > 0 ? `${row.weekTotal}h` : '—'}
                    </td>
                  </tr>
                ))
              ) : !loading ? (
                <tr>
                  <td colSpan={9} className="text-center py-8 text-slate-400 dark:text-slate-500">
                    No time entries for this week
                  </td>
                </tr>
              ) : null}
              {/* Totals row */}
              {data && data.rows.length > 0 && (
                <tr className="bg-slate-50 dark:bg-slate-800 font-medium">
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">Total</td>
                  {data.dailyTotals.map((total, i) => (
                    <td
                      key={i}
                      className={`text-center px-2 py-2 text-slate-700 dark:text-slate-200 ${
                        weekDates[i] === today ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                      }`}
                    >
                      {total > 0 ? `${total}h` : '—'}
                    </td>
                  ))}
                  <td className="text-center px-2 py-2 text-slate-800 dark:text-slate-100 font-semibold">
                    {data.weekTotal > 0 ? `${data.weekTotal}h` : '—'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
