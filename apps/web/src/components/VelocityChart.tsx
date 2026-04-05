interface VelocityPoint {
  sprintId: string;
  sprintName: string;
  completedTasks: number;
  completedHours: number;
  totalTasks: number;
  totalHours: number;
}

interface VelocityChartProps {
  data: VelocityPoint[];
}

export default function VelocityChart({ data }: VelocityChartProps) {
  if (data.length < 2) {
    return <p className="text-xs text-slate-400 py-4 text-center">Need at least 2 closed sessions for velocity chart</p>;
  }

  const maxVal = Math.max(...data.map((d) => d.totalTasks), 1);
  const chartHeight = 160;
  const barWidth = Math.min(40, Math.max(20, 300 / data.length));
  const chartWidth = data.length * (barWidth + 16) + 40;
  const avgCompleted = data.reduce((s, d) => s + d.completedTasks, 0) / data.length;

  return (
    <div className="overflow-x-auto">
      <svg width={chartWidth} height={chartHeight + 40} className="text-slate-600">
        {/* Average line */}
        <line
          x1={20}
          x2={chartWidth}
          y1={chartHeight - (avgCompleted / maxVal) * chartHeight}
          y2={chartHeight - (avgCompleted / maxVal) * chartHeight}
          stroke="#94a3b8"
          strokeDasharray="4 4"
          strokeWidth="1"
        />
        <text
          x={chartWidth - 4}
          y={chartHeight - (avgCompleted / maxVal) * chartHeight - 4}
          textAnchor="end"
          className="text-[10px] fill-slate-400"
        >
          avg: {avgCompleted.toFixed(1)}
        </text>

        {data.map((point, i) => {
          const x = 30 + i * (barWidth + 16);
          const totalHeight = (point.totalTasks / maxVal) * chartHeight;
          const completedHeight = (point.completedTasks / maxVal) * chartHeight;
          const pct = point.totalTasks > 0 ? Math.round((point.completedTasks / point.totalTasks) * 100) : 0;

          return (
            <g key={point.sprintId}>
              {/* Total bar (background) */}
              <rect
                x={x}
                y={chartHeight - totalHeight}
                width={barWidth}
                height={totalHeight}
                fill="#e2e8f0"
                rx="3"
              />
              {/* Completed bar */}
              <rect
                x={x}
                y={chartHeight - completedHeight}
                width={barWidth}
                height={completedHeight}
                fill={pct >= 80 ? '#22c55e' : pct >= 50 ? '#3b82f6' : '#f59e0b'}
                rx="3"
              />
              {/* Value label */}
              <text
                x={x + barWidth / 2}
                y={chartHeight - completedHeight - 4}
                textAnchor="middle"
                className="text-[10px] fill-slate-600 font-medium"
              >
                {point.completedTasks}
              </text>
              {/* Sprint name */}
              <text
                x={x + barWidth / 2}
                y={chartHeight + 14}
                textAnchor="middle"
                className="text-[9px] fill-slate-500"
              >
                {point.sprintName.length > 8 ? point.sprintName.slice(0, 8) + '\u2026' : point.sprintName}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
