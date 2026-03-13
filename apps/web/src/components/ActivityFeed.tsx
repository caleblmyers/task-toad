import type { Activity } from '../types';
import { statusLabel } from '../utils/taskHelpers';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function formatValue(field: string | null | undefined, value: string | null | undefined): string {
  if (!value) return 'none';
  if (field === 'status') return statusLabel(value);
  return value;
}

function describeActivity(activity: Activity): string {
  const user = activity.userEmail.split('@')[0];
  switch (activity.action) {
    case 'task.created':
      return `${user} created this task`;
    case 'task.updated':
      if (activity.field) {
        return `${user} changed ${activity.field} from ${formatValue(activity.field, activity.oldValue)} to ${formatValue(activity.field, activity.newValue)}`;
      }
      return `${user} updated this task`;
    case 'task.bulk_updated':
      if (activity.field) {
        return `${user} bulk changed ${activity.field} to ${formatValue(activity.field, activity.newValue)}`;
      }
      return `${user} bulk updated this task`;
    case 'comment.created':
      return `${user} added a comment`;
    case 'sprint.created':
      return `${user} created a sprint`;
    case 'sprint.updated':
      return `${user} updated a sprint`;
    case 'sprint.deleted':
      return `${user} deleted a sprint`;
    case 'project.updated':
      if (activity.field) {
        return `${user} changed project ${activity.field}`;
      }
      return `${user} updated the project`;
    case 'project.archived':
      return `${user} archived the project`;
    case 'project.unarchived':
      return `${user} unarchived the project`;
    default:
      return `${user} ${activity.action.replace('.', ' ')}`;
  }
}

interface ActivityFeedProps {
  activities: Activity[];
  className?: string;
}

export default function ActivityFeed({ activities, className = '' }: ActivityFeedProps) {
  if (activities.length === 0) {
    return <p className="text-xs text-slate-400 py-1">No activity yet.</p>;
  }

  return (
    <div className={`space-y-2 ${className}`}>
      {activities.map((activity) => (
        <div key={activity.activityId} className="flex items-start gap-2 py-1">
          <div className="w-5 h-5 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center text-[10px] font-medium flex-shrink-0 mt-0.5">
            {activity.userEmail.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-slate-600">{describeActivity(activity)}</p>
            <p className="text-[10px] text-slate-400">{timeAgo(activity.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
