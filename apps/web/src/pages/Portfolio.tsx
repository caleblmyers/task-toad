import { Link } from 'react-router-dom';
import { gql } from '../api/client';
import useAsyncData from '../hooks/useAsyncData';
import {
  PORTFOLIO_OVERVIEW_QUERY,
} from '../api/queries';
import Badge from '../components/shared/Badge';

interface ProjectSummary {
  projectId: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionPercent: number;
  activeSprint: string | null;
  healthScore: number | null;
  statusDistribution: Array<{ label: string; count: number }>;
}

interface PortfolioRollup {
  totalProjects: number;
  totalTasks: number;
  totalVelocity: number;
  avgCycleTimeHours: number | null;
  teamSprintProgress: { totalSprints: number; activeSprints: number; avgCompletionPercent: number };
  aggregateStatusDistribution: Array<{ label: string; count: number }>;
}

function healthInfo(score: number | null): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (score === null) return { label: 'N/A', variant: 'neutral' };
  if (score > 70) return { label: 'Healthy', variant: 'success' };
  if (score >= 40) return { label: 'At Risk', variant: 'warning' };
  return { label: 'Critical', variant: 'danger' };
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  in_review: '#8b5cf6',
  done: '#22c55e',
  blocked: '#ef4444',
};

function CircularProgress({ percent }: { percent: number }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 75 ? '#22c55e' : percent >= 40 ? '#3b82f6' : '#94a3b8';

  return (
    <svg width={72} height={72} className="flex-shrink-0">
      <circle cx={36} cy={36} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle
        cx={36}
        cy={36}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        className="transition-all duration-500"
      />
      <text x={36} y={36} textAnchor="middle" dominantBaseline="central" className="text-sm font-semibold" fill="#334155">
        {percent}%
      </text>
    </svg>
  );
}

function StatusBar({ distribution, total }: { distribution: Array<{ label: string; count: number }>; total: number }) {
  if (total === 0) return <div className="h-2 bg-slate-100 rounded-full" />;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
      {distribution.map((entry) => {
        const pct = (entry.count / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={entry.label}
            className="h-full"
            style={{
              width: `${pct}%`,
              backgroundColor: STATUS_COLORS[entry.label] ?? '#94a3b8',
            }}
            title={`${entry.label}: ${entry.count}`}
          />
        );
      })}
    </div>
  );
}

function formatCycleTime(hours: number | null): string {
  if (hours === null) return 'N/A';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours >= 24) return `${+(hours / 24).toFixed(1)}d`;
  return `${hours.toFixed(1)}h`;
}

// ── Main Portfolio Component ──

interface PortfolioData {
  projects: ProjectSummary[];
  rollup: PortfolioRollup;
}

export default function Portfolio() {
  const { data: portfolioData, loading, error } = useAsyncData<PortfolioData>(
    async () => {
      const pd = await gql<{ portfolioOverview: ProjectSummary[]; portfolioRollup: PortfolioRollup }>(PORTFOLIO_OVERVIEW_QUERY);
      return {
        projects: pd.portfolioOverview,
        rollup: pd.portfolioRollup,
      };
    },
    [],
  );

  const projects = portfolioData?.projects ?? [];
  const rollup = portfolioData?.rollup ?? null;

  if (loading) {
    return (
      <div className="p-2">
        <h1 className="text-2xl font-semibold text-slate-800 mb-6">Portfolio</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/2 mb-4" />
              <div className="h-16 bg-slate-100 rounded mb-3" />
              <div className="h-2 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2">
        <h1 className="text-2xl font-semibold text-slate-800 mb-6">Portfolio</h1>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Portfolio</h1>
        <span className="text-sm text-slate-500">{projects.length} projects</span>
      </div>

      {/* Rollup metrics */}
      {rollup && rollup.totalProjects > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Projects</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{rollup.totalProjects}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Tasks</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{rollup.totalTasks}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Velocity</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{rollup.totalVelocity}<span className="text-sm font-normal text-slate-400 ml-1">pts</span></p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Cycle Time</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{formatCycleTime(rollup.avgCycleTimeHours)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Sprints</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {rollup.teamSprintProgress.activeSprints}
                <span className="text-sm font-normal text-slate-400 ml-1">/ {rollup.teamSprintProgress.totalSprints}</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sprint Progress</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{Math.round(rollup.teamSprintProgress.avgCompletionPercent)}%</p>
            </div>
          </div>

          {/* Aggregate status bar */}
          {rollup.aggregateStatusDistribution.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Org-wide Status Distribution</p>
              <StatusBar distribution={rollup.aggregateStatusDistribution} total={rollup.totalTasks} />
              <div className="flex gap-4 mt-2">
                {rollup.aggregateStatusDistribution.map((entry) => (
                  <span key={entry.label} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: STATUS_COLORS[entry.label] ?? '#94a3b8' }} />
                    {entry.label.replace('_', ' ')}: {entry.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Projects grid */}
      {projects.length === 0 ? (
        <p className="text-slate-500">
          No projects yet. <Link to="/home" className="underline">Create one.</Link>
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const health = healthInfo(p.healthScore);
            return (
              <Link
                key={p.projectId}
                to={`/projects/${p.projectId}`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-800 truncate">{p.name}</h2>
                  <Badge variant={health.variant} size="sm">{health.label}</Badge>
                </div>

                {/* Progress + metrics */}
                <div className="flex items-center gap-4 mb-3">
                  <CircularProgress percent={p.completionPercent} />
                  <div className="flex-1 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Total</span>
                      <span className="font-medium text-slate-800">{p.totalTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed</span>
                      <span className="font-medium text-green-600">{p.completedTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overdue</span>
                      <span className={`font-medium ${p.overdueTasks > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {p.overdueTasks}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status distribution bar */}
                <StatusBar distribution={p.statusDistribution} total={p.totalTasks} />

                {/* Active sprint */}
                {p.activeSprint && (
                  <div className="mt-3 text-xs text-slate-500">
                    Active: <span className="text-slate-700 font-medium">{p.activeSprint}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

    </div>
  );
}
