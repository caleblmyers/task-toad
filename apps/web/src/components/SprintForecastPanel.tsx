import { useState, useEffect } from 'react';
import { gql } from '../api/client';

const SPRINT_FORECAST_QUERY = `query SprintForecast($projectId: ID!, $sprintId: ID!) {
  sprintForecast(projectId: $projectId, sprintId: $sprintId) {
    completionProbability
    percentiles { percentile daysRemaining }
    historicalVelocity
  }
}`;

interface ForecastPercentile {
  percentile: number;
  daysRemaining: number;
}

interface SprintForecast {
  completionProbability: number;
  percentiles: ForecastPercentile[];
  historicalVelocity: number[];
}

interface Props {
  projectId: string;
  sprintId: string;
  closedSprintCount: number;
}

function probabilityColor(p: number): string {
  if (p >= 75) return 'text-green-600 dark:text-green-400';
  if (p >= 50) return 'text-yellow-600 dark:text-yellow-400';
  return 'text-red-600 dark:text-red-400';
}

function gaugeColor(p: number): string {
  if (p >= 75) return 'bg-green-500';
  if (p >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

export default function SprintForecastPanel({ projectId, sprintId, closedSprintCount }: Props) {
  const [forecast, setForecast] = useState<SprintForecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (closedSprintCount < 3) return;
    gql<{ sprintForecast: SprintForecast }>(SPRINT_FORECAST_QUERY, { projectId, sprintId })
      .then((d) => setForecast(d.sprintForecast))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load forecast'));
  }, [projectId, sprintId, closedSprintCount]);

  if (closedSprintCount < 3) return null;
  if (error) return <p className="text-xs text-red-500">{error}</p>;
  if (!forecast) return <p className="text-xs text-slate-400">Loading forecast...</p>;

  const prob = forecast.completionProbability;

  return (
    <div className="space-y-3">
      {/* Probability gauge */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-slate-500 dark:text-slate-400">On-time probability</span>
            <span className={`text-lg font-bold ${probabilityColor(prob)}`}>{prob}%</span>
          </div>
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2.5">
            <div
              className={`h-2.5 rounded-full transition-all ${gaugeColor(prob)}`}
              style={{ width: `${prob}%` }}
            />
          </div>
        </div>
      </div>

      {/* Percentile table */}
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-500 dark:text-slate-400">
            <th className="text-left font-medium pb-1">Confidence</th>
            <th className="text-right font-medium pb-1">Days to complete</th>
          </tr>
        </thead>
        <tbody className="text-slate-700 dark:text-slate-300">
          {forecast.percentiles.map((p) => (
            <tr key={p.percentile} className="border-t border-slate-100 dark:border-slate-700">
              <td className="py-1">{p.percentile}th percentile</td>
              <td className="py-1 text-right">{p.daysRemaining.toFixed(0)} days</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
