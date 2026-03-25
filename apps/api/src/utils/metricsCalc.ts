/**
 * Pure utility functions for metrics calculations.
 * Used by sprint and project resolvers to avoid duplication.
 */

// ── Percentile ──

/** Calculate the p-th percentile of a sorted array. */
export function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

// ── Average ──

function avg(arr: number[]): number {
  return arr.length === 0 ? 0 : arr.reduce((s, v) => s + v, 0) / arr.length;
}

// ── Velocity ──

interface VelocityTask {
  status: string;
  estimatedHours?: number | null;
  storyPoints?: number | null;
}

export interface VelocityResult {
  completedTasks: number;
  totalTasks: number;
  completedHours: number;
  totalHours: number;
  pointsCompleted: number;
  pointsTotal: number;
}

/** Calculate velocity metrics from a set of tasks. */
export function calculateVelocity(tasks: VelocityTask[]): VelocityResult {
  const doneTasks = tasks.filter((t) => t.status === 'done');
  return {
    completedTasks: doneTasks.length,
    totalTasks: tasks.length,
    completedHours: doneTasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0),
    totalHours: tasks.reduce((s, t) => s + (t.estimatedHours ?? 0), 0),
    pointsCompleted: doneTasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
    pointsTotal: tasks.reduce((s, t) => s + (t.storyPoints ?? 0), 0),
  };
}

// ── Cycle Time ──

interface CycleTimeActivity {
  taskId: string | null;
  newValue: string | null;
  createdAt: Date;
}

interface CycleTimeTask {
  taskId: string;
  createdAt: Date;
}

export interface CycleTimeResult {
  leadTimes: number[];
  cycleTimes: number[];
  averageLeadTime: number;
  averageCycleTime: number;
  p50LeadTime: number;
  p85LeadTime: number;
  p50CycleTime: number;
  p85CycleTime: number;
}

/**
 * Calculate cycle time and lead time metrics from status-change activities.
 * Lead time = created → done. Cycle time = in_progress → done.
 * Returns sorted arrays and percentile/average stats.
 */
export function calculateCycleTime(
  activities: CycleTimeActivity[],
  tasks: CycleTimeTask[],
): CycleTimeResult {
  // Group activities by taskId
  const activityByTask = new Map<string, Array<{ newValue: string | null; createdAt: Date }>>();
  for (const a of activities) {
    if (!a.taskId) continue;
    const list = activityByTask.get(a.taskId) ?? [];
    list.push({ newValue: a.newValue, createdAt: a.createdAt });
    activityByTask.set(a.taskId, list);
  }

  const leadTimes: number[] = [];
  const cycleTimes: number[] = [];

  for (const task of tasks) {
    const acts = activityByTask.get(task.taskId) ?? [];
    const firstInProgress = acts.find((a) => a.newValue === 'in_progress');
    const firstDone = acts.find((a) => a.newValue === 'done');

    if (firstDone) {
      const leadTimeHours = (firstDone.createdAt.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60);
      leadTimes.push(leadTimeHours);

      if (firstInProgress) {
        const cycleTimeHours = (firstDone.createdAt.getTime() - firstInProgress.createdAt.getTime()) / (1000 * 60 * 60);
        cycleTimes.push(cycleTimeHours);
      }
    }
  }

  leadTimes.sort((a, b) => a - b);
  cycleTimes.sort((a, b) => a - b);

  return {
    leadTimes,
    cycleTimes,
    averageLeadTime: Math.round(avg(leadTimes) * 100) / 100,
    averageCycleTime: Math.round(avg(cycleTimes) * 100) / 100,
    p50LeadTime: Math.round(percentile(leadTimes, 50) * 100) / 100,
    p85LeadTime: Math.round(percentile(leadTimes, 85) * 100) / 100,
    p50CycleTime: Math.round(percentile(cycleTimes, 50) * 100) / 100,
    p85CycleTime: Math.round(percentile(cycleTimes, 85) * 100) / 100,
  };
}

// ── Health Score ──

/**
 * Calculate a project health score (0-100).
 * Penalizes overdue tasks and low completion percentage.
 */
export function calculateHealthScore(
  completionPercent: number,
  overdueTasks: number,
  totalTasks: number,
): number {
  if (totalTasks === 0) return 0;
  let score = 100;
  score -= Math.min(overdueTasks * 10, 50);
  if (completionPercent < 25) score -= 20;
  else if (completionPercent < 50) score -= 10;
  return Math.max(0, Math.min(100, score));
}
