import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '../api/client';

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

const PORTFOLIO_QUERY = `query PortfolioOverview {
  portfolioOverview {
    projectId name totalTasks completedTasks overdueTasks
    completionPercent activeSprint healthScore
    statusDistribution { label count }
  }
}`;

function healthBadge(score: number | null): { label: string; className: string } {
  if (score === null) return { label: 'N/A', className: 'bg-slate-100 text-slate-500' };
  if (score > 70) return { label: 'Healthy', className: 'bg-green-100 text-green-700' };
  if (score >= 40) return { label: 'At Risk', className: 'bg-yellow-100 text-yellow-700' };
  return { label: 'Critical', className: 'bg-red-100 text-red-700' };
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

export default function Portfolio() {
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ portfolioOverview: ProjectSummary[] }>(PORTFOLIO_QUERY)
      .then((data) => setProjects(data.portfolioOverview))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

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

      {projects.length === 0 ? (
        <p className="text-slate-500">No projects yet. <Link to="/app" className="underline">Create one.</Link></p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {projects.map((p) => {
            const badge = healthBadge(p.healthScore);
            return (
              <Link
                key={p.projectId}
                to={`/app/projects/${p.projectId}`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-800 truncate">{p.name}</h2>
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                    {badge.label}
                  </span>
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
