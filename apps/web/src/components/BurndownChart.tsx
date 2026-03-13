import { useState } from 'react';

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

interface BurndownChartProps {
  data: BurndownData;
}

export default function BurndownChart({ data }: BurndownChartProps) {
  const [showBurnup, setShowBurnup] = useState(false);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  if (data.days.length === 0) {
    return <p className="text-xs text-slate-400 py-4 text-center">No data available</p>;
  }

  const maxVal = Math.max(data.totalScope, ...data.days.map((d) => d.remaining), 1);
  const chartWidth = Math.max(400, data.days.length * 30);
  const chartHeight = 160;
  const padLeft = 30;
  const padRight = 10;
  const plotWidth = chartWidth - padLeft - padRight;

  const xScale = (i: number) => padLeft + (i / Math.max(data.days.length - 1, 1)) * plotWidth;
  const yScale = (v: number) => chartHeight - (v / maxVal) * (chartHeight - 10);

  // Ideal burndown line
  const idealPoints = `${padLeft},${yScale(data.totalScope)} ${padLeft + plotWidth},${yScale(0)}`;

  // Actual line
  const actualPoints = data.days.map((d, i) =>
    `${xScale(i)},${yScale(showBurnup ? d.completed : d.remaining)}`
  ).join(' ');

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <span className="w-3 h-0.5 bg-slate-300 inline-block" /> Ideal
          </span>
          <span className="flex items-center gap-1 text-xs text-slate-500">
            <span className={`w-3 h-0.5 inline-block ${showBurnup ? 'bg-green-500' : 'bg-blue-500'}`} />
            {showBurnup ? 'Completed' : 'Remaining'}
          </span>
        </div>
        <button
          onClick={() => setShowBurnup((v) => !v)}
          className="text-xs text-slate-500 hover:text-slate-700 px-2 py-0.5 border border-slate-200 rounded"
        >
          {showBurnup ? 'Burndown' : 'Burnup'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <svg
          width={chartWidth}
          height={chartHeight + 30}
          className="text-slate-600"
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {/* Y-axis labels */}
          <text x={padLeft - 4} y={yScale(maxVal) + 4} textAnchor="end" className="text-[9px] fill-slate-400">{maxVal}</text>
          <text x={padLeft - 4} y={yScale(0) + 4} textAnchor="end" className="text-[9px] fill-slate-400">0</text>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((pct) => (
            <line
              key={pct}
              x1={padLeft} x2={chartWidth - padRight}
              y1={yScale(maxVal * pct)} y2={yScale(maxVal * pct)}
              stroke="#f1f5f9" strokeWidth="1"
            />
          ))}

          {/* Ideal line */}
          {!showBurnup && (
            <polyline
              points={idealPoints}
              fill="none"
              stroke="#cbd5e1"
              strokeWidth="1.5"
              strokeDasharray="4 4"
            />
          )}

          {/* Actual line */}
          <polyline
            points={actualPoints}
            fill="none"
            stroke={showBurnup ? '#22c55e' : '#3b82f6'}
            strokeWidth="2"
          />

          {/* Data points */}
          {data.days.map((d, i) => (
            <circle
              key={i}
              cx={xScale(i)}
              cy={yScale(showBurnup ? d.completed : d.remaining)}
              r={hoveredIdx === i ? 4 : 2.5}
              fill={showBurnup ? '#22c55e' : '#3b82f6'}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredIdx(i)}
            />
          ))}

          {/* X-axis date labels (every few days) */}
          {data.days.map((d, i) => {
            if (data.days.length <= 14 || i % Math.ceil(data.days.length / 7) === 0 || i === data.days.length - 1) {
              return (
                <text
                  key={i}
                  x={xScale(i)}
                  y={chartHeight + 14}
                  textAnchor="middle"
                  className="text-[9px] fill-slate-400"
                >
                  {d.date.slice(5)}
                </text>
              );
            }
            return null;
          })}

          {/* Tooltip */}
          {hoveredIdx !== null && (
            <g>
              <rect
                x={xScale(hoveredIdx) - 45}
                y={yScale(showBurnup ? data.days[hoveredIdx].completed : data.days[hoveredIdx].remaining) - 30}
                width={90}
                height={22}
                rx="4"
                fill="white"
                stroke="#e2e8f0"
              />
              <text
                x={xScale(hoveredIdx)}
                y={yScale(showBurnup ? data.days[hoveredIdx].completed : data.days[hoveredIdx].remaining) - 15}
                textAnchor="middle"
                className="text-[10px] fill-slate-700 font-medium"
              >
                {data.days[hoveredIdx].date}: {showBurnup ? data.days[hoveredIdx].completed : data.days[hoveredIdx].remaining}
              </text>
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
