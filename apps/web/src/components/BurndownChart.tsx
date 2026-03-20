import { useEffect, useRef, useState } from 'react';
import { gql } from '../api/client';
import { SPRINT_BURNDOWN_QUERY } from '../api/queries';
import useAsyncData from '../hooks/useAsyncData';

interface BurndownDay {
  date: string;
  remaining: number;
  completed: number;
  added: number;
}

interface BurndownData {
  days: BurndownDay[];
  totalScope: number;
  sprintName: string;
  startDate: string;
  endDate: string;
}

type BurndownChartProps =
  | { sprintId: string; data?: never }
  | { sprintId?: never; data: BurndownData };


const CHART_H = 250;
const PAD = { top: 24, right: 16, bottom: 32, left: 40 };

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function BurndownChart(props: BurndownChartProps) {
  const [mode, setMode] = useState<'burndown' | 'burnup'>('burndown');
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(500);

  const sprintId = props.sprintId;

  const { data: fetched, loading, error: fetchError, retry: fetchData } = useAsyncData(
    async () => {
      if (!sprintId) return null;
      const d = await gql<{ sprintBurndown: BurndownData }>(SPRINT_BURNDOWN_QUERY, { sprintId });
      return d.sprintBurndown;
    },
    [sprintId],
  );
  const error = !!fetchError;

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

  const data = props.data ?? fetched;

  if (loading) {
    return (
      <div ref={containerRef} className="w-full">
        <div className="bg-slate-100 rounded-lg animate-pulse" style={{ height: CHART_H }} />
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className="w-full flex flex-col items-center justify-center gap-2 py-8 text-sm text-slate-500">
        <span>Unable to load chart</span>
        <button
          type="button"
          onClick={fetchData}
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
        No burndown data available
      </div>
    );
  }

  const { days, totalScope, startDate, endDate } = data;
  const innerW = width - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const maxY = Math.max(totalScope, ...days.map((d) => Math.max(d.remaining, d.completed)), 1);

  const xScale = (i: number) => PAD.left + (days.length > 1 ? (i / (days.length - 1)) * innerW : innerW / 2);
  const yScale = (v: number) => PAD.top + innerH - (maxY > 0 ? (v / maxY) * innerH : 0);

  const isBurnup = mode === 'burnup';

  // Ideal line
  const idealStart = isBurnup ? 0 : totalScope;
  const idealEnd = isBurnup ? totalScope : 0;
  const idealLine = `M${PAD.left},${yScale(idealStart)} L${PAD.left + innerW},${yScale(idealEnd)}`;

  // Actual line
  const points = days.map((d, i) => ({
    x: xScale(i),
    y: yScale(isBurnup ? d.completed : d.remaining),
    value: isBurnup ? d.completed : d.remaining,
    date: d.date,
  }));
  const actualLine = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // X-axis labels — show ~6 evenly
  const labelStep = Math.max(1, Math.floor(days.length / 6));

  // Y-axis ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((maxY / yTickCount) * i));

  return (
    <div ref={containerRef} className="w-full">
      <div className="flex items-center justify-between mb-2 px-1">
        <span className="text-xs text-slate-500 font-medium">
          {data.sprintName} ({fmtDate(startDate)} - {fmtDate(endDate)})
        </span>
        <div className="flex rounded-md border border-slate-200 text-xs overflow-hidden">
          <button
            type="button"
            onClick={() => setMode('burndown')}
            className={`px-2.5 py-1 ${mode === 'burndown' ? 'bg-brand-green text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            Burndown
          </button>
          <button
            type="button"
            onClick={() => setMode('burnup')}
            className={`px-2.5 py-1 ${mode === 'burnup' ? 'bg-brand-green text-white' : 'bg-white text-slate-600 hover:bg-slate-50'}`}
          >
            Burnup
          </button>
        </div>
      </div>

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

        {/* Ideal line */}
        <path d={idealLine} fill="none" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="6 4" />

        {/* Actual line */}
        <path d={actualLine} fill="none" stroke={isBurnup ? '#22c55e' : '#3b82f6'} strokeWidth={2} strokeLinejoin="round" />

        {/* Data points + hover targets */}
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 5 : 3}
            fill={isBurnup ? '#22c55e' : '#3b82f6'}
            stroke="white"
            strokeWidth={1.5}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* Tooltip */}
        {hoveredIdx !== null && (() => {
          const p = points[hoveredIdx];
          const labelText = `${fmtDate(p.date)}: ${p.value}`;
          const boxW = Math.max(70, labelText.length * 7);
          const tx = Math.min(Math.max(p.x, PAD.left + boxW / 2), PAD.left + innerW - boxW / 2);
          return (
            <g>
              <line x1={p.x} y1={PAD.top} x2={p.x} y2={PAD.top + innerH} stroke="#94a3b8" strokeWidth={1} strokeDasharray="3 3" />
              <rect x={tx - boxW / 2} y={p.y - 28} width={boxW} height={20} rx={4} fill="#1e293b" opacity={0.9} />
              <text x={tx} y={p.y - 14} textAnchor="middle" fill="white" fontSize={11} fontWeight={500}>
                {labelText}
              </text>
            </g>
          );
        })()}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 px-1 mt-1">
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <span className="w-3 h-0.5 inline-block border-t border-dashed border-slate-300" /> Ideal
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <span className={`w-3 h-0.5 inline-block ${isBurnup ? 'bg-green-500' : 'bg-blue-500'}`} />
          {isBurnup ? 'Completed' : 'Remaining'}
        </span>
      </div>
    </div>
  );
}
