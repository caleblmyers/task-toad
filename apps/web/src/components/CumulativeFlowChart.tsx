import { useEffect, useRef, useState } from 'react';
import { gql } from '../api/client';
import { CUMULATIVE_FLOW_QUERY } from '../api/queries';
import useAsyncData from '../hooks/useAsyncData';

interface StatusCount {
  status: string;
  count: number;
}

interface CumulativeFlowDay {
  date: string;
  statusCounts: StatusCount[];
}

interface CumulativeFlowData {
  days: CumulativeFlowDay[];
  statuses: string[];
}

interface CumulativeFlowChartProps {
  projectId: string;
  sprintId?: string;
  fromDate?: string;
  toDate?: string;
}


const STATUS_COLORS: Record<string, { fill: string; label: string }> = {
  todo: { fill: '#94a3b8', label: 'To Do' },
  in_progress: { fill: '#3b82f6', label: 'In Progress' },
  in_review: { fill: '#f59e0b', label: 'In Review' },
  done: { fill: '#22c55e', label: 'Done' },
};

const CHART_H = 280;
const PAD = { top: 24, right: 16, bottom: 32, left: 40 };

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function CumulativeFlowChart({ projectId, sprintId, fromDate, toDate }: CumulativeFlowChartProps) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);

  const { data, loading, error: fetchError, retry } = useAsyncData(
    async () => {
      const d = await gql<{ cumulativeFlow: CumulativeFlowData }>(CUMULATIVE_FLOW_QUERY, {
        projectId,
        sprintId: sprintId ?? null,
        fromDate: fromDate ?? null,
        toDate: toDate ?? null,
      });
      return d.cumulativeFlow;
    },
    [projectId, sprintId, fromDate, toDate],
  );

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

  if (loading) {
    return (
      <div ref={containerRef} className="w-full">
        <div className="bg-slate-100 rounded-lg animate-pulse" style={{ height: CHART_H }} />
      </div>
    );
  }

  if (fetchError) {
    return (
      <div ref={containerRef} className="w-full flex flex-col items-center justify-center gap-2 py-8 text-sm text-slate-500">
        <span>Unable to load chart</span>
        <button
          type="button"
          onClick={retry}
          className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-200 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.days.length === 0) {
    return (
      <div ref={containerRef} className="w-full text-center py-8 text-sm text-slate-400">
        No cumulative flow data available
      </div>
    );
  }

  const { days, statuses } = data;
  const innerW = width - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;

  // Compute stacked values: for each day, accumulate counts bottom-to-top
  const stackedDays = days.map((day) => {
    const countMap = new Map(day.statusCounts.map((sc) => [sc.status, sc.count]));
    let cumulative = 0;
    const layers = statuses.map((s) => {
      const count = countMap.get(s) ?? 0;
      const y0 = cumulative;
      cumulative += count;
      return { status: s, y0, y1: cumulative, count };
    });
    return { date: day.date, layers, total: cumulative };
  });

  const maxY = Math.max(...stackedDays.map((d) => d.total), 1);

  const xScale = (i: number) => PAD.left + (days.length > 1 ? (i / (days.length - 1)) * innerW : innerW / 2);
  const yScale = (v: number) => PAD.top + innerH - (maxY > 0 ? (v / maxY) * innerH : 0);

  // Build area paths for each status layer (bottom-to-top stacking)
  const areaPaths = statuses.map((status) => {
    // Top edge: left to right
    const topPoints = stackedDays.map((d, i) => {
      const layer = d.layers.find((l) => l.status === status);
      return `${i === 0 ? 'M' : 'L'}${xScale(i)},${yScale(layer?.y1 ?? 0)}`;
    });
    // Bottom edge: right to left
    const bottomPoints = [...stackedDays].reverse().map((d, i) => {
      const layer = d.layers.find((l) => l.status === status);
      return `${i === 0 ? 'L' : 'L'}${xScale(days.length - 1 - i)},${yScale(layer?.y0 ?? 0)}`;
    });
    return { status, d: topPoints.join(' ') + ' ' + bottomPoints.join(' ') + ' Z' };
  });

  // X-axis labels — show ~6 evenly
  const labelStep = Math.max(1, Math.floor(days.length / 6));

  // Y-axis ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((maxY / yTickCount) * i));

  return (
    <div ref={containerRef} className="w-full">
      <svg
        width={width}
        height={CHART_H}
        className="select-none"
        onMouseLeave={() => setHoveredIdx(null)}
      >
        {/* Grid lines */}
        {yTicks.map((v) => (
          <line key={v} x1={PAD.left} y1={yScale(v)} x2={PAD.left + innerW} y2={yScale(v)} stroke="#e2e8f0" strokeWidth={1} />
        ))}

        {/* Y-axis labels */}
        {yTicks.map((v) => (
          <text key={v} x={PAD.left - 6} y={yScale(v) + 4} textAnchor="end" className="fill-slate-400" fontSize={10}>
            {v}
          </text>
        ))}

        {/* X-axis labels */}
        {days.map((d, i) => {
          if (i % labelStep !== 0 && i !== days.length - 1) return null;
          return (
            <text key={d.date} x={xScale(i)} y={CHART_H - 8} textAnchor="middle" className="fill-slate-400" fontSize={10}>
              {fmtDate(d.date)}
            </text>
          );
        })}

        {/* Stacked area fills — render bottom-to-top (reversed so top layers paint over bottom) */}
        {[...areaPaths].reverse().map((ap) => (
          <path
            key={ap.status}
            d={ap.d}
            fill={STATUS_COLORS[ap.status]?.fill ?? '#94a3b8'}
            opacity={0.7}
            stroke={STATUS_COLORS[ap.status]?.fill ?? '#94a3b8'}
            strokeWidth={0.5}
          />
        ))}

        {/* Invisible hover targets for each day column */}
        {days.map((_d, i) => {
          const colW = days.length > 1 ? innerW / (days.length - 1) : innerW;
          const x = xScale(i) - colW / 2;
          return (
            <rect
              key={i}
              x={Math.max(PAD.left, x)}
              y={PAD.top}
              width={Math.min(colW, innerW)}
              height={innerH}
              fill="transparent"
              onMouseEnter={() => setHoveredIdx(i)}
            />
          );
        })}

        {/* Hover crosshair + tooltip */}
        {hoveredIdx !== null && (() => {
          const day = stackedDays[hoveredIdx];
          const x = xScale(hoveredIdx);
          const lines = day.layers.filter((l) => l.count > 0).map((l) => {
            const label = STATUS_COLORS[l.status]?.label ?? l.status;
            return `${label}: ${l.count}`;
          });
          const headerText = fmtDate(day.date);
          const allLines = [headerText, ...lines];
          const boxW = Math.max(100, Math.max(...allLines.map((l) => l.length)) * 7 + 16);
          const boxH = allLines.length * 16 + 8;
          const tx = Math.min(Math.max(x, PAD.left + boxW / 2), PAD.left + innerW - boxW / 2);

          return (
            <g>
              <line x1={x} y1={PAD.top} x2={x} y2={PAD.top + innerH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
              <rect x={tx - boxW / 2} y={PAD.top - 4} width={boxW} height={boxH} rx={4} fill="#1e293b" opacity={0.9} />
              {allLines.map((line, li) => (
                <text
                  key={li}
                  x={tx - boxW / 2 + 8}
                  y={PAD.top + 10 + li * 16}
                  fill="white"
                  fontSize={li === 0 ? 11 : 10}
                  fontWeight={li === 0 ? 600 : 400}
                >
                  {line}
                </text>
              ))}
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1 mt-1">
        {statuses.map((s) => (
          <span key={s} className="flex items-center gap-1 text-[10px] text-slate-400">
            <span className="w-3 h-3 rounded-sm inline-block" style={{ backgroundColor: STATUS_COLORS[s]?.fill ?? '#94a3b8' }} />
            {STATUS_COLORS[s]?.label ?? s}
          </span>
        ))}
      </div>
    </div>
  );
}
