import type { Task } from '../types';

export function statusLabel(status: string): string {
  return status
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export const TASK_FIELDS = `
  taskId title description instructions acceptanceCriteria suggestedTools estimatedHours storyPoints priority status taskType projectId parentTaskId createdAt sprintId sprintColumn assigneeId archived position dueDate recurrenceRule recurrenceParentId labels { labelId name color } customFieldValues { customFieldValueId field { customFieldId name fieldType options required position } value } attachments { attachmentId taskId fileName fileKey mimeType sizeBytes uploadedById createdAt } assignees { id user { userId email } assignedAt } githubIssueNumber githubIssueUrl pullRequests { id prNumber prUrl prTitle state } commits { id sha message author url createdAt } dependencies { taskDependencyId sourceTaskId targetTaskId linkType targetTask { taskId title status } } dependents { taskDependencyId sourceTaskId targetTaskId linkType sourceTask { taskId title status } }
`;

export function columnToStatus(column: string): Task['status'] | null {
  const lower = column.toLowerCase().replace(/[^a-z]/g, '');
  if (lower === 'todo' || lower === 'backlog') return 'todo';
  if (lower === 'inprogress' || lower === 'doing' || lower === 'active') return 'in_progress';
  if (lower === 'inreview' || lower === 'review' || lower === 'reviewing') return 'in_review';
  if (lower === 'done' || lower === 'complete' || lower === 'completed' || lower === 'closed') return 'done';
  return null;
}

const statusColumnMap: Record<string, string> = {
  todo: 'To Do',
  in_progress: 'In Progress',
  in_review: 'In Review',
  done: 'Done',
};

export function statusToColumn(status: Task['status'], columns: string[]): string | null {
  const preferred = statusColumnMap[status];
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
