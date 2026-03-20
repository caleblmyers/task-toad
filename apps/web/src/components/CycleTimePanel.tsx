import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import { CYCLE_TIME_METRICS_QUERY } from '../api/queries';
import { IconClose } from './shared/Icons';

interface TaskCycleMetrics {
  taskId: string;
  title: string;
  status: string;
  leadTimeHours: number | null;
  cycleTimeHours: number | null;
  startedAt: string | null;
  completedAt: string | null;
}

interface ProjectCycleMetrics {
  tasks: TaskCycleMetrics[];
  avgLeadTimeHours: number;
  avgCycleTimeHours: number;
  p50LeadTimeHours: number;
  p85LeadTimeHours: number;
  p50CycleTimeHours: number;
  p85CycleTimeHours: number;
  totalCompleted: number;
}

interface Sprint {
  sprintId: string;
  name: string;
  isActive?: boolean;
  startDate?: string | null;
  endDate?: string | null;
}

interface Props {
  projectId: string;
  sprints?: Sprint[];
  disabled?: boolean;
  onClose: () => void;
}

type SortField = 'title' | 'leadTimeHours' | 'cycleTimeHours';

function formatHours(hours: number | null): string {
  if (hours === null) return '-';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${hours.toFixed(1)}h`;
  return `${(hours / 24).toFixed(1)}d`;
}

export default function CycleTimePanel({ projectId, sprints, disabled, onClose }: Props) {
  const [metrics, setMetrics] = useState<ProjectCycleMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sprintFilter, setSprintFilter] = useState<string>('');
  const [fromDate, setFromDate] = useState<string>('');
  const [toDate, setToDate] = useState<string>('');
  const [sortField, setSortField] = useState<SortField>('leadTimeHours');
  const [sortAsc, setSortAsc] = useState(true);

  const dateError = fromDate && toDate && fromDate > toDate ? 'From date must be before To date' : null;

  const load = async (sprintId?: string, from?: string, to?: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ cycleTimeMetrics: ProjectCycleMetrics }>(
        CYCLE_TIME_METRICS_QUERY,
        { projectId, sprintId: sprintId || undefined, fromDate: from || undefined, toDate: to || undefined }
      );
      setMetrics(data.cycleTimeMetrics);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!disabled && !dateError) load(sprintFilter || undefined, fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, sprintFilter, fromDate, toDate]);

  const activeSprint = sprints?.find((s) => s.isActive);

  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setFromDate(start.toISOString().split('T')[0]);
    setToDate(end.toISOString().split('T')[0]);
  };

  const setThisSprint = () => {
    if (activeSprint?.startDate) setFromDate(activeSprint.startDate);
    if (activeSprint?.endDate) setToDate(activeSprint.endDate);
    else setToDate(new Date().toISOString().split('T')[0]);
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const sortedTasks = metrics?.tasks
    ? [...metrics.tasks].sort((a, b) => {
        const dir = sortAsc ? 1 : -1;
        if (sortField === 'title') return dir * a.title.localeCompare(b.title);
        const aVal = a[sortField] ?? Infinity;
        const bVal = b[sortField] ?? Infinity;
        return dir * (aVal - bVal);
      })
    : [];

  const sortIndicator = (field: SortField) =>
    sortField === field ? (sortAsc ? ' \u2191' : ' \u2193') : '';

  return (
    <div className="flex-1 overflow-auto px-8 py-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Cycle Time Metrics</p>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            <IconClose className="w-3 h-3" /> Dismiss
          </button>
        </div>

        {/* Sprint filter */}
        {sprints && sprints.length > 0 && (
          <div className="mb-4">
            <select
              value={sprintFilter}
              onChange={(e) => setSprintFilter(e.target.value)}
              className="text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 bg-white dark:bg-slate-800 dark:text-slate-200"
            >
              <option value="">All sprints</option>
              {sprints.map((s) => (
                <option key={s.sprintId} value={s.sprintId}>{s.name}</option>
              ))}
            </select>
          </div>
        )}

        {/* Date range filter */}
        <div className="mb-4 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <label htmlFor="cycle-from" className="text-xs text-slate-500 dark:text-slate-400">From</label>
              <input
                id="cycle-from"
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded px-2 py-1.5"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <label htmlFor="cycle-to" className="text-xs text-slate-500 dark:text-slate-400">To</label>
              <input
                id="cycle-to"
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="text-sm border border-slate-200 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 rounded px-2 py-1.5"
              />
            </div>
            {(fromDate || toDate) && (
              <button
                type="button"
                onClick={() => { setFromDate(''); setToDate(''); }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 underline"
              >
                Clear dates
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPresetRange(7)} className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Last 7 days</button>
            <button type="button" onClick={() => setPresetRange(30)} className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Last 30 days</button>
            <button type="button" onClick={() => setPresetRange(90)} className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">Last 90 days</button>
            {activeSprint?.startDate && (
              <button type="button" onClick={setThisSprint} className="text-xs px-2 py-1 rounded border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">This Sprint</button>
            )}
          </div>
          {dateError && <p className="text-xs text-red-600">{dateError}</p>}
        </div>

        {loading && (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg p-3">
            {error}
            <button onClick={() => load(sprintFilter || undefined)} className="ml-2 text-red-500 underline hover:text-red-700">Retry</button>
          </div>
        )}

        {metrics && (
          <>
            {/* Summary stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard label="Avg Lead Time" value={formatHours(metrics.avgLeadTimeHours)} />
              <StatCard label="Avg Cycle Time" value={formatHours(metrics.avgCycleTimeHours)} />
              <StatCard label="P50 Lead" value={formatHours(metrics.p50LeadTimeHours)} sub={`P85: ${formatHours(metrics.p85LeadTimeHours)}`} />
              <StatCard label="P50 Cycle" value={formatHours(metrics.p50CycleTimeHours)} sub={`P85: ${formatHours(metrics.p85CycleTimeHours)}`} />
            </div>

            <p className="text-xs text-slate-500 mb-2">{metrics.totalCompleted} completed task{metrics.totalCompleted !== 1 ? 's' : ''}</p>

            {/* Task table */}
            {sortedTasks.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs text-slate-500 uppercase tracking-wide">
                      <th className="pb-2 pr-4 cursor-pointer select-none" onClick={() => handleSort('title')}>
                        Task{sortIndicator('title')}
                      </th>
                      <th className="pb-2 pr-4 cursor-pointer select-none text-right" onClick={() => handleSort('leadTimeHours')}>
                        Lead Time{sortIndicator('leadTimeHours')}
                      </th>
                      <th className="pb-2 cursor-pointer select-none text-right" onClick={() => handleSort('cycleTimeHours')}>
                        Cycle Time{sortIndicator('cycleTimeHours')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTasks.map((t) => (
                      <tr key={t.taskId} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="py-2 pr-4 text-slate-700 dark:text-slate-300 truncate max-w-xs">{t.title}</td>
                        <td className="py-2 pr-4 text-right text-slate-600 dark:text-slate-400 font-mono text-xs">{formatHours(t.leadTimeHours)}</td>
                        <td className="py-2 text-right text-slate-600 dark:text-slate-400 font-mono text-xs">{formatHours(t.cycleTimeHours)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-slate-500 text-center py-8">No completed tasks found.</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">{label}</p>
      <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
