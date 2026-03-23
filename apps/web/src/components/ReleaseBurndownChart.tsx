import { useEffect, useRef, useState } from 'react';
import { gql } from '../api/client';
import { RELEASE_BURNDOWN_QUERY } from '../api/queries';
import useAsyncData from '../hooks/useAsyncData';

interface BurndownPoint {
  date: string;
  totalTasks: number;
  completedTasks: number;
  remainingTasks: number;
}

const CHART_H = 220;
const PAD = { top: 24, right: 16, bottom: 32, left: 40 };

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function ReleaseBurndownChart({ releaseId }: { releaseId: string }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(400);

  const { data, loading, error, retry } = useAsyncData(
    async () => {
      const res = await gql<{ releaseBurndown: BurndownPoint[] }>(RELEASE_BURNDOWN_QUERY, { releaseId });
      return res.releaseBurndown;
    },
    [releaseId],
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
        <div className="bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" style={{ height: CHART_H }} />
      </div>
    );
  }

  if (error) {
    return (
      <div ref={containerRef} className="w-full flex flex-col items-center justify-center gap-2 py-6 text-sm text-slate-500">
        <span>Unable to load burndown</span>
        <span className="text-xs text-slate-400 max-w-xs text-center">{String(error)}</span>
        <button type="button" onClick={retry} className="text-blue-600 hover:text-blue-800 text-xs px-2 py-1 border border-blue-200 rounded">
          Retry
        </button>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div ref={containerRef} className="w-full text-center py-6 text-sm text-slate-400 dark:text-slate-500">
        No burndown data available
      </div>
    );
  }

  const innerW = width - PAD.left - PAD.right;
  const innerH = CHART_H - PAD.top - PAD.bottom;
  const maxY = Math.max(data[0].totalTasks, 1);

  const xScale = (i: number) => PAD.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2);
  const yScale = (v: number) => PAD.top + innerH - (maxY > 0 ? (v / maxY) * innerH : 0);

  // Total line (flat at top)
  const totalLine = `M${xScale(0)},${yScale(maxY)} L${xScale(data.length - 1)},${yScale(maxY)}`;

  // Remaining line
  const remainingPoints = data.map((p, i) => ({
    x: xScale(i),
    y: yScale(p.remainingTasks),
    value: p.remainingTasks,
    completed: p.completedTasks,
    total: p.totalTasks,
    date: p.date,
  }));
  const remainingLine = remainingPoints.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  // Ideal line from total to 0
  const idealLine = `M${xScale(0)},${yScale(maxY)} L${xScale(data.length - 1)},${yScale(0)}`;

  // X-axis labels
  const labelStep = Math.max(1, Math.floor(data.length / 6));

  // Y-axis ticks
  const yTickCount = 4;
  const yTicks = Array.from({ length: yTickCount + 1 }, (_, i) => Math.round((maxY / yTickCount) * i));

  return (
    <div ref={containerRef} className="w-full">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">Release Burndown</p>
      <svg width={width} height={CHART_H} className="select-none" onMouseLeave={() => setHoveredIdx(null)}>
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
        {data.map((d, i) => {
          if (i % labelStep !== 0 && i !== data.length - 1) return null;
          return (
            <text key={d.date} x={xScale(i)} y={CHART_H - 8} textAnchor="middle" className="fill-slate-400" fontSize={10}>
              {fmtDate(d.date)}
            </text>
          );
        })}

        {/* Total line (flat) */}
        <path d={totalLine} fill="none" stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="4 4" />

        {/* Ideal line */}
        <path d={idealLine} fill="none" stroke="#cbd5e1" strokeWidth={1} strokeDasharray="6 4" />

        {/* Remaining line */}
        <path d={remainingLine} fill="none" stroke="#3b82f6" strokeWidth={2} strokeLinejoin="round" />

        {/* Data points + hover targets */}
        {remainingPoints.map((p, i) => (
          <circle
            key={p.date}
            cx={p.x}
            cy={p.y}
            r={hoveredIdx === i ? 5 : 3}
            fill="#3b82f6"
            stroke="white"
            strokeWidth={1.5}
            className="cursor-pointer"
            onMouseEnter={() => setHoveredIdx(i)}
          />
        ))}

        {/* Tooltip */}
        {hoveredIdx !== null && (() => {
          const p = remainingPoints[hoveredIdx];
          const labelText = `${fmtDate(p.date)}: ${p.completed}/${p.total} done`;
          const boxW = Math.max(90, labelText.length * 6.5);
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
          <span className="w-3 h-0.5 inline-block border-t border-dashed border-slate-400" /> Total
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <span className="w-3 h-0.5 inline-block border-t border-dashed border-slate-300" /> Ideal
        </span>
        <span className="flex items-center gap-1 text-[10px] text-slate-400">
          <span className="w-3 h-0.5 inline-block bg-blue-500" /> Remaining
        </span>
      </div>
    </div>
  );
}
