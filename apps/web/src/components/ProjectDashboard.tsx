import { useState, useEffect } from 'react';
import type { ProjectStats, Activity } from '../types';
import { gql } from '../api/client';
import { SPRINT_VELOCITY_QUERY, SPRINT_BURNDOWN_QUERY } from '../api/queries';
import { statusLabel } from '../utils/taskHelpers';
import ActivityFeed from './ActivityFeed';
import VelocityChart from './VelocityChart';
import BurndownChart from './BurndownChart';
import CumulativeFlowChart from './CumulativeFlowChart';

const statusColors: Record<string, string> = {
  todo: 'bg-slate-400',
  in_progress: 'bg-blue-500',
  done: 'bg-green-500',
};

const priorityColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-blue-400',
  low: 'bg-slate-300',
};

function StatCard({ label, value, subtext }: { label: string; value: string | number; subtext?: string }) {
  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-800 dark:text-slate-200 mt-1">{value}</p>
      {subtext && <p className="text-xs text-slate-400 mt-0.5">{subtext}</p>}
    </div>
  );
}

function BarChart({ items, colorMap }: { items: Array<{ label: string; count: number }>; colorMap: Record<string, string> }) {
  const total = items.reduce((s, i) => s + i.count, 0);
  if (total === 0) return <p className="text-xs text-slate-400">No data</p>;

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const pct = Math.round((item.count / total) * 100);
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between text-xs mb-0.5">
              <span className="text-slate-600 dark:text-slate-300">{statusLabel(item.label)}</span>
              <span className="text-slate-400">{item.count} ({pct}%)</span>
            </div>
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${colorMap[item.label] ?? 'bg-slate-400'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatHours(h: number): string {
  if (h < 1) return `${Math.round(h * 60)}m`;
  if (h >= 8) return `${+(h / 8).toFixed(1)}d`;
  return `${h.toFixed(1)}h`;
}

interface ProjectDashboardProps {
  stats: ProjectStats | null;
  activities: Activity[];
  loading: boolean;
  projectId: string;
  sprints: Array<{ sprintId: string; name: string; startDate: string | null; endDate: string | null; closedAt: string | null; isActive: boolean }>;
}

export default function ProjectDashboard({ stats, activities, loading, projectId, sprints }: ProjectDashboardProps) {
  const [velocityData, setVelocityData] = useState<Array<{ sprintId: string; sprintName: string; completedTasks: number; completedHours: number; totalTasks: number; totalHours: number }>>([]);
  const [burndownData, setBurndownData] = useState<{ days: Array<{ date: string; remaining: number; completed: number; added: number }>; totalScope: number; sprintName: string; startDate: string; endDate: string } | null>(null);
  const [selectedBurndownSprint, setSelectedBurndownSprint] = useState<string>('');

  const closedSprints = sprints.filter((s) => s.closedAt);
  const sprintsWithDates = sprints.filter((s) => s.startDate && s.endDate && !s.closedAt);
  const activeSprint = sprints.find((s) => s.isActive);

  useEffect(() => {
    if (!projectId) return;
    gql<{ sprintVelocity: typeof velocityData }>(
      SPRINT_VELOCITY_QUERY,
      { projectId }
    ).then((d) => setVelocityData(d.sprintVelocity)).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    const sprintId = selectedBurndownSprint || activeSprint?.sprintId;
    if (!sprintId) return;
    const sprint = sprints.find((s) => s.sprintId === sprintId);
    if (!sprint?.startDate || !sprint?.endDate) return;
    gql<{ sprintBurndown: NonNullable<typeof burndownData> }>(
      SPRINT_BURNDOWN_QUERY,
      { sprintId }
    ).then((d) => setBurndownData(d.sprintBurndown)).catch(() => {});
  }, [selectedBurndownSprint, activeSprint?.sprintId, sprints]);
  if (loading || !stats) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Loading dashboard…</p>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Dashboard header */}
        <div className="flex items-center gap-3">
          <img src="/logo-data.png" alt="" className="w-8 h-8 opacity-60" aria-hidden="true" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Project Dashboard</h2>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Tasks" value={stats.totalTasks} />
          <StatCard label="Completed" value={stats.completedTasks} subtext={`${stats.completionPercent}%`} />
          <StatCard
            label="In Progress"
            value={stats.tasksByStatus.find((s) => s.label === 'in_progress')?.count ?? 0}
          />
          <StatCard label="Overdue" value={stats.overdueTasks} />
        </div>

        {/* Progress bar */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Completion</p>
          <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-3">
            <div
              className="h-3 rounded-full bg-green-500 transition-all"
              style={{ width: `${stats.completionPercent}%` }}
            />
          </div>
          <p className="text-xs text-slate-400 mt-1">{stats.completionPercent}% complete</p>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Tasks by Status</p>
            <BarChart items={stats.tasksByStatus} colorMap={statusColors} />
          </div>
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Tasks by Priority</p>
            <BarChart items={stats.tasksByPriority} colorMap={priorityColors} />
          </div>
        </div>

        {/* Assignee breakdown */}
        {stats.tasksByAssignee.length > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Tasks by Assignee</p>
            <div className="space-y-2">
              {stats.tasksByAssignee.map((a) => {
                const pct = Math.round((a.count / stats.totalTasks) * 100);
                return (
                  <div key={a.userId}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-slate-600 dark:text-slate-400">{a.email}</span>
                      <span className="text-slate-400">{a.count} ({pct}%)</span>
                    </div>
                    <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <div className="h-2 rounded-full bg-indigo-400" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Hours */}
        {stats.totalEstimatedHours > 0 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Hours</p>
            <p className="text-sm text-slate-700 dark:text-slate-300">
              {formatHours(stats.completedEstimatedHours)} completed of {formatHours(stats.totalEstimatedHours)} estimated
            </p>
            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mt-2">
              <div
                className="h-2 rounded-full bg-blue-500"
                style={{ width: `${Math.round((stats.completedEstimatedHours / stats.totalEstimatedHours) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Velocity Chart */}
        {closedSprints.length >= 2 && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Sprint Velocity</p>
            <VelocityChart data={velocityData} />
          </div>
        )}

        {/* Burndown Chart */}
        {(activeSprint?.startDate && activeSprint?.endDate) || sprintsWithDates.length > 0 ? (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Burndown</p>
              {sprintsWithDates.length > 1 && (
                <select
                  value={selectedBurndownSprint}
                  onChange={(e) => setSelectedBurndownSprint(e.target.value)}
                  className="text-xs border border-slate-200 rounded px-2 py-0.5"
                >
                  <option value="">Active Sprint</option>
                  {sprintsWithDates.map((s) => (
                    <option key={s.sprintId} value={s.sprintId}>{s.name}</option>
                  ))}
                </select>
              )}
            </div>
            {burndownData ? (
              <BurndownChart data={burndownData} />
            ) : (
              <p className="text-xs text-slate-400 py-4 text-center">Loading...</p>
            )}
          </div>
        ) : null}

        {/* Cumulative Flow Diagram */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Cumulative Flow</p>
          <CumulativeFlowChart projectId={projectId} />
        </div>

        {/* Activity feed */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Recent Activity</p>
          <ActivityFeed activities={activities} />
        </div>
      </div>
    </div>
  );
}
