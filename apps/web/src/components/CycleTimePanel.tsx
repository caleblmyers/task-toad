import { useState, useEffect, useRef } from 'react';
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
type ViewMode = 'table' | 'scatter';

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
  const [viewMode, setViewMode] = useState<ViewMode>('table');

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

            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-slate-500">{metrics.totalCompleted} completed task{metrics.totalCompleted !== 1 ? 's' : ''}</p>
              <div className="flex rounded-md border border-slate-200 dark:border-slate-600 text-xs overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  className={`px-2.5 py-1 ${viewMode === 'table' ? 'bg-brand-green text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  Table
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('scatter')}
                  className={`px-2.5 py-1 ${viewMode === 'scatter' ? 'bg-brand-green text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  Scatter
                </button>
              </div>
            </div>

            {viewMode === 'scatter' ? (
              <CycleTimeScatter tasks={metrics.tasks} p50={metrics.p50CycleTimeHours} p85={metrics.p85CycleTimeHours} />
            ) : sortedTasks.length > 0 ? (
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

const SCATTER_H = 250;
const SCATTER_PAD = { top: 20, right: 16, bottom: 32, left: 48 };

function computePercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function CycleTimeScatter({ tasks, p50, p85 }: { tasks: TaskCycleMetrics[]; p50: number; p85: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const obs = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setWidth(w);
    });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Filter to tasks with both cycleTimeHours and completedAt
  const validTasks = tasks.filter((t) => t.cycleTimeHours !== null && t.completedAt !== null);

  if (validTasks.length === 0) {
    return (
      <div ref={containerRef} className="w-full text-center py-8 text-sm text-slate-400 dark:text-slate-500">
        No completed tasks with cycle time data.
      </div>
    );
  }

  // Calculate P95 from the data
  const sortedCycleTimes = validTasks.map((t) => t.cycleTimeHours!).sort((a, b) => a - b);
  const p95 = computePercentile(sortedCycleTimes, 95);

  // Determine axis ranges
  const dates = validTasks.map((t) => new Date(t.completedAt!).getTime());
  const minDate = Math.min(...dates);
  const maxDate = Math.max(...dates);
  const dateRange = maxDate - minDate || 86400000; // at least 1 day

  const maxCycleTime = Math.max(...sortedCycleTimes, p95) * 1.1;

  const innerW = width - SCATTER_PAD.left - SCATTER_PAD.right;
  const innerH = SCATTER_H - SCATTER_PAD.top - SCATTER_PAD.bottom;

  const xScale = (timestamp: number) => SCATTER_PAD.left + ((timestamp - minDate) / dateRange) * innerW;
  const yScale = (hours: number) => SCATTER_PAD.top + innerH - (maxCycleTime > 0 ? (hours / maxCycleTime) * innerH : 0);

  const points = validTasks.map((t) => ({
    x: xScale(new Date(t.completedAt!).getTime()),
    y: yScale(t.cycleTimeHours!),
    cycleTime: t.cycleTimeHours!,
    title: t.title,
    completedAt: t.completedAt!,
  }));

  // Format date for labels
  const fmtDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  // X-axis date labels (~5 evenly spaced)
  const xLabelCount = Math.min(5, validTasks.length);
  const xLabels = Array.from({ length: xLabelCount }, (_, i) => {
    const ts = minDate + (i / Math.max(xLabelCount - 1, 1)) * dateRange;
    return { ts, x: xScale(ts), label: fmtDate(ts) };
  });

  // Y-axis ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => {
    const v = (maxCycleTime / yTickCount) * i;
    return { v, label: formatHours(v) };
  });

  // Percentile lines
  const pLines = [
    { value: p50, color: '#22c55e', label: 'P50' },
    { value: p85, color: '#f59e0b', label: 'P85' },
    { value: p95, color: '#ef4444', label: 'P95' },
  ];

  return (
    <div ref={containerRef} className="w-full">
      <svg width={width} height={SCATTER_H} className="select-none" onMouseLeave={() => setHoveredIdx(null)}>
        {/* Grid lines */}
        {yTicks.map((tick, i) => (
          <line key={i} x1={SCATTER_PAD.left} y1={yScale(tick.v)} x2={SCATTER_PAD.left + innerW} y2={yScale(tick.v)} stroke="#e2e8f0" strokeWidth={1} />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((tick, i) => (
          <text key={i} x={SCATTER_PAD.left - 6} y={yScale(tick.v) + 4} textAnchor="end" className="fill-slate-400" fontSize={10}>
            {tick.label}
          </text>
        ))}

        {/* X-axis labels */}
        {xLabels.map((xl, i) => (
          <text key={i} x={xl.x} y={SCATTER_H - 8} textAnchor="middle" className="fill-slate-400" fontSize={10}>
            {xl.label}
          </text>
        ))}

        {/* Percentile lines */}
        {pLines.map((pl) => (
          <g key={pl.label}>
            <line
              x1={SCATTER_PAD.left}
              y1={yScale(pl.value)}
              x2={SCATTER_PAD.left + innerW}
              y2={yScale(pl.value)}
              stroke={pl.color}
              strokeWidth={1.5}
              strokeDasharray="6 4"
            />
            <text
              x={SCATTER_PAD.left + innerW + 2}
              y={yScale(pl.value) + 4}
              className="fill-current"
              fill={pl.color}
              fontSize={9}
              fontWeight={600}
            >
              {pl.label}
            </text>
          </g>
        ))}

        {/* Scatter dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 6 : 4}
            fill="#3b82f6"
            fillOpacity={0.7}
            stroke="white"
            strokeWidth={1.5}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* Tooltip */}
        {hoveredIdx !== null && (() => {
          const p = points[hoveredIdx];
          const line1 = p.title.length > 30 ? p.title.slice(0, 30) + '...' : p.title;
          const line2 = `Cycle: ${formatHours(p.cycleTime)}`;
          const boxW = Math.max(120, Math.max(line1.length, line2.length) * 6.5);
          const boxH = 36;
          const tx = Math.min(Math.max(p.x, SCATTER_PAD.left + boxW / 2), SCATTER_PAD.left + innerW - boxW / 2);
          const ty = p.y - boxH - 8;
          return (
            <g>
              <rect x={tx - boxW / 2} y={ty} width={boxW} height={boxH} rx={4} fill="#1e293b" opacity={0.9} />
              <text x={tx} y={ty + 14} textAnchor="middle" fill="white" fontSize={10}>
                {line1}
              </text>
              <text x={tx} y={ty + 28} textAnchor="middle" fill="#93c5fd" fontSize={10} fontWeight={500}>
                {line2}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-3 px-1 mt-1 flex-wrap">
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <span className="w-2.5 h-2.5 rounded-full bg-blue-500 opacity-70 inline-block" /> Task
        </span>
        {pLines.map((pl) => (
          <span key={pl.label} className="flex items-center gap-1 text-[10px]" style={{ color: pl.color }}>
            <span className="w-3 h-0 inline-block border-t-2 border-dashed" style={{ borderColor: pl.color }} /> {pl.label}
          </span>
        ))}
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
