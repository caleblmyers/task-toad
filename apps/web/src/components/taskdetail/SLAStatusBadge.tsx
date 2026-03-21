import { useState, useEffect } from 'react';
import { gql } from '../../api/client';
import { TASK_SLA_STATUS_QUERY } from '../../api/queries';

interface SLATimerData {
  slaTimerId: string;
  taskId: string;
  policyId: string;
  startedAt: string;
  respondedAt: string | null;
  resolvedAt: string | null;
  responseBreached: boolean;
  resolutionBreached: boolean;
  timeToResponseHours: number | null;
  timeToResolutionHours: number | null;
  policy: {
    slaPolicyId: string;
    name: string;
    responseTimeHours: number;
    resolutionTimeHours: number;
    priority: string | null;
  };
}

interface Props {
  taskId: string;
}

type SLAStatus = 'green' | 'amber' | 'red' | 'resolved';

function getTimerStatus(timer: SLATimerData): SLAStatus {
  if (timer.responseBreached || timer.resolutionBreached) return 'red';
  if (timer.resolvedAt) return 'resolved';

  // Check response SLA
  if (!timer.respondedAt && timer.timeToResponseHours != null) {
    if (timer.timeToResponseHours <= 0) return 'red';
    if (timer.timeToResponseHours <= timer.policy.responseTimeHours * 0.25) return 'amber';
  }

  // Check resolution SLA
  if (timer.timeToResolutionHours != null) {
    if (timer.timeToResolutionHours <= 0) return 'red';
    if (timer.timeToResolutionHours <= timer.policy.resolutionTimeHours * 0.25) return 'amber';
  }

  return 'green';
}

function getWorstStatus(timers: SLATimerData[]): SLAStatus {
  let worst: SLAStatus = 'resolved';
  const priority: Record<SLAStatus, number> = { resolved: 0, green: 1, amber: 2, red: 3 };
  for (const timer of timers) {
    const status = getTimerStatus(timer);
    if (priority[status] > priority[worst]) worst = status;
  }
  return worst;
}

function formatHours(hours: number): string {
  if (Math.abs(hours) < 1) {
    const mins = Math.round(Math.abs(hours) * 60);
    return hours < 0 ? `${mins}m overdue` : `${mins}m left`;
  }
  const h = Math.abs(hours);
  return hours < 0 ? `${h.toFixed(1)}h overdue` : `${h.toFixed(1)}h left`;
}

const statusColors: Record<SLAStatus, string> = {
  green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  amber: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  resolved: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400',
};

export default function SLAStatusBadge({ taskId }: Props) {
  const [timers, setTimers] = useState<SLATimerData[]>([]);

  useEffect(() => {
    let cancelled = false;
    gql<{ taskSLAStatus: SLATimerData[] }>(TASK_SLA_STATUS_QUERY, { taskId })
      .then((data) => { if (!cancelled) setTimers(data.taskSLAStatus); })
      .catch(() => { /* ignore */ });
    return () => { cancelled = true; };
  }, [taskId]);

  if (timers.length === 0) return null;

  const worst = getWorstStatus(timers);

  // Find the most urgent timer for the label
  const urgentTimer = timers
    .filter((t) => !t.resolvedAt)
    .sort((a, b) => {
      const aMin = Math.min(a.timeToResponseHours ?? Infinity, a.timeToResolutionHours ?? Infinity);
      const bMin = Math.min(b.timeToResponseHours ?? Infinity, b.timeToResolutionHours ?? Infinity);
      return aMin - bMin;
    })[0];

  let label = 'SLA Met';
  if (urgentTimer) {
    const urgentHours = Math.min(
      urgentTimer.timeToResponseHours ?? Infinity,
      urgentTimer.timeToResolutionHours ?? Infinity,
    );
    label = `SLA: ${formatHours(urgentHours)}`;
  }

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[worst]}`}
      title={timers.map((t) => `${t.policy.name}: ${getTimerStatus(t)}`).join(', ')}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${
        worst === 'green' ? 'bg-green-500' :
        worst === 'amber' ? 'bg-amber-500' :
        worst === 'red' ? 'bg-red-500' :
        'bg-slate-400'
      }`} />
      {label}
    </span>
  );
}
