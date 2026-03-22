import { useState, useMemo } from 'react';
import { gql } from '../api/client';
import { WORKLOAD_HEATMAP_QUERY } from '../api/queries';
import useAsyncData from '../hooks/useAsyncData';

interface WorkloadCell {
  userId: string;
  userName: string;
  week: string;
  totalHours: number;
  taskCount: number;
}

function cellColor(hours: number): string {
  if (hours === 0) return 'bg-slate-50 dark:bg-slate-800';
  if (hours < 30) return 'bg-green-100 dark:bg-green-900/40 text-green-800 dark:text-green-300';
  if (hours <= 40) return 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300';
  return 'bg-red-100 dark:bg-red-900/40 text-red-800 dark:text-red-300';
}

function getDefaultDateRange(): { startDate: string; endDate: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

interface WorkloadHeatmapProps {
  projectId: string;
}

export default function WorkloadHeatmap({ projectId }: WorkloadHeatmapProps) {
  const defaults = useMemo(() => getDefaultDateRange(), []);
  const [startDate, setStartDate] = useState(defaults.startDate);
  const [endDate, setEndDate] = useState(defaults.endDate);

  const { data: cells, loading } = useAsyncData(
    async () => {
      if (!projectId || !startDate || !endDate) return [];
      const d = await gql<{ workloadHeatmap: WorkloadCell[] }>(
        WORKLOAD_HEATMAP_QUERY,
        { projectId, startDate, endDate },
      );
      return d.workloadHeatmap;
    },
    [projectId, startDate, endDate],
  );

  const cellData = useMemo(() => cells ?? [], [cells]);

  // Derive unique users and weeks
  const users = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of cellData) map.set(c.userId, c.userName);
    return Array.from(map.entries()).map(([userId, userName]) => ({ userId, userName }));
  }, [cellData]);

  const weeks = useMemo(() => {
    const set = new Set<string>();
    for (const c of cellData) set.add(c.week);
    return Array.from(set).sort();
  }, [cellData]);

  const cellMap = useMemo(() => {
    const m = new Map<string, WorkloadCell>();
    for (const c of cellData) m.set(`${c.userId}::${c.week}`, c);
    return m;
  }, [cellData]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-500">
          From
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="ml-1 text-xs border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-800"
          />
        </label>
        <label className="text-xs text-slate-500">
          To
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="ml-1 text-xs border border-slate-200 dark:border-slate-600 rounded px-1.5 py-0.5 bg-white dark:bg-slate-800"
          />
        </label>
        <div className="flex items-center gap-2 ml-auto text-[10px] text-slate-400">
          <span className="inline-block w-3 h-3 rounded bg-green-100 border border-green-200" /> &lt;30h
          <span className="inline-block w-3 h-3 rounded bg-amber-100 border border-amber-200" /> 30-40h
          <span className="inline-block w-3 h-3 rounded bg-red-100 border border-red-200" /> &gt;40h
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-green" />
        </div>
      ) : users.length === 0 ? (
        <p className="text-xs text-slate-400 italic py-4 text-center">No workload data for this period</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-xs w-full">
            <thead>
              <tr>
                <th className="text-left py-1 px-2 text-slate-500 font-medium">User</th>
                {weeks.map((w) => (
                  <th key={w} className="text-center py-1 px-2 text-slate-500 font-medium whitespace-nowrap">{w}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId}>
                  <td className="py-1 px-2 text-slate-600 dark:text-slate-300 whitespace-nowrap">{u.userName}</td>
                  {weeks.map((w) => {
                    const cell = cellMap.get(`${u.userId}::${w}`);
                    const hours = cell?.totalHours ?? 0;
                    const tasks = cell?.taskCount ?? 0;
                    return (
                      <td
                        key={w}
                        className={`py-1 px-2 text-center rounded ${cellColor(hours)}`}
                        title={`${hours}h, ${tasks} tasks`}
                      >
                        {hours > 0 ? `${hours}h` : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
