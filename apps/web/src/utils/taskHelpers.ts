import type { Task } from '../types';

const dependsOnCache = new Map<string, string[]>();
const MAX_CACHE_SIZE = 1000;

export function parseDependsOn(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const cached = dependsOnCache.get(raw);
  if (cached) return cached;
  try {
    const parsed = JSON.parse(raw) as string[];
    if (!Array.isArray(parsed)) return [];
    if (dependsOnCache.size >= MAX_CACHE_SIZE) {
      const firstKey = dependsOnCache.keys().next().value;
      if (firstKey !== undefined) dependsOnCache.delete(firstKey);
    }
    dependsOnCache.set(raw, parsed);
    return parsed;
  } catch {
    return [];
  }
}

export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const TASK_FIELDS = `
  taskId title description instructions acceptanceCriteria suggestedTools estimatedHours storyPoints priority dependsOn status taskType projectId parentTaskId createdAt sprintId sprintColumn assigneeId archived position dueDate labels { labelId name color } customFieldValues { customFieldValueId field { customFieldId name fieldType options required position } value } assignees { id user { userId email } assignedAt } githubIssueNumber githubIssueUrl pullRequests { id prNumber prUrl prTitle state } commits { id sha message author url createdAt }
`;

export const STATUS_TO_COLUMN: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export function columnToStatus(column: string): Task['status'] | null {
  const lower = column.toLowerCase().replace(/[^a-z]/g, '');
  if (lower === 'todo' || lower === 'backlog') return 'todo';
  if (lower === 'inprogress' || lower === 'doing' || lower === 'active') return 'in_progress';
  if (lower === 'inreview' || lower === 'review' || lower === 'reviewing') return 'in_review';
  if (lower === 'done' || lower === 'complete' || lower === 'completed' || lower === 'closed') return 'done';
  return null;
}

export function statusToColumn(status: Task['status'], columns: string[]): string | null {
  const preferred = STATUS_TO_COLUMN[status];
  if (preferred && columns.includes(preferred)) return preferred;
  for (const col of columns) {
    if (columnToStatus(col) === status) return col;
  }
  return null;
}

export function parseSuggestedTools(
  raw: string | null | undefined,
): Array<{ name: string; category: string; reason: string }> {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is { name: string; category: string; reason: string } =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as Record<string, unknown>).name === 'string' &&
        typeof (item as Record<string, unknown>).category === 'string' &&
        typeof (item as Record<string, unknown>).reason === 'string',
    );
  } catch {
    return [];
  }
}

export function sortTasks(taskList: Task[]): Task[] {
  return taskList.slice().sort((a, b) => {
    if (a.position != null && b.position != null) return a.position - b.position;
    if (a.position != null) return -1;
    if (b.position != null) return 1;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}
