import { useState, useCallback, useRef, useMemo } from 'react';
import { gql } from '../api/client';
import {
  TASKS_QUERY, TASKS_PAGINATED_QUERY, SUBTASKS_QUERY, CREATE_TASK_MUTATION,
  CREATE_TASK_WITH_STATUS_MUTATION, CREATE_SUBTASK_MUTATION, BULK_UPDATE_TASKS_MUTATION,
  COMMENTS_QUERY, ACTIVITIES_QUERY, CREATE_COMMENT_MUTATION, UPDATE_COMMENT_MUTATION,
  DELETE_COMMENT_MUTATION, CREATE_LABEL_MUTATION, DELETE_LABEL_MUTATION,
  ADD_TASK_LABEL_MUTATION, REMOVE_TASK_LABEL_MUTATION, LABELS_QUERY,
} from '../api/queries';
import { columnToStatus, statusToColumn } from '../utils/taskHelpers';
import type { Task, TaskConnection, Sprint, Comment, Activity, Label } from '../types';

interface UseTaskCRUDOptions {
  projectId: string | undefined;
  userId: string | undefined;
  sprints: Sprint[];
}

export function useTaskCRUD({ projectId, userId, sprints }: UseTaskCRUDOptions) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [taskOffset, setTaskOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Record<string, Task[]>>({});
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [taskActivities, setTaskActivities] = useState<Record<string, Activity[]>>({});
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [err, setErr] = useState<string | null>(null);

  // Add task form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const titleEditRef = useRef<HTMLInputElement>(null);

  const rootTasks = useMemo(() => tasks.filter((t) => !t.parentTaskId), [tasks]);

  // ── Data loading ──

  const loadTasks = useCallback(async (): Promise<Task[]> => {
    if (!projectId) return [];
    try {
      const data = await gql<{ tasks: TaskConnection }>(TASKS_QUERY, { projectId });
      setTasks(data.tasks.tasks);
      setHasMore(data.tasks.hasMore);
      setTaskOffset(0);
      setSelectedTask((prev) => {
        if (!prev) return prev;
        const refreshed = data.tasks.tasks.find((t) => t.taskId === prev.taskId);
        return refreshed ?? prev;
      });
      return data.tasks.tasks;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadMoreTasks = useCallback(async () => {
    if (!projectId || !hasMore) return;
    const newOffset = taskOffset + 100;
    try {
      const data = await gql<{ tasks: TaskConnection }>(
        TASKS_PAGINATED_QUERY, { projectId, limit: 100, offset: newOffset },
      );
      setTasks((prev) => [...prev, ...data.tasks.tasks]);
      setHasMore(data.tasks.hasMore);
      setTaskOffset(newOffset);
    } catch {
      // ignore
    }
  }, [projectId, hasMore, taskOffset]);

  const loadSubtasks = useCallback(async (taskId: string) => {
    if (!projectId) return;
    try {
      const data = await gql<{ tasks: TaskConnection }>(SUBTASKS_QUERY, { projectId, parentTaskId: taskId });
      setSubtasks((prev) => ({ ...prev, [taskId]: data.tasks.tasks }));
    } catch {
      // ignore
    }
  }, [projectId]);

  const loadComments = useCallback(async (taskId: string) => {
    try {
      const data = await gql<{ comments: Comment[] }>(COMMENTS_QUERY, { taskId });
      setComments((prev) => ({ ...prev, [taskId]: data.comments }));
    } catch {
      // ignore
    }
  }, []);

  const loadTaskActivities = useCallback(async (taskId: string) => {
    try {
      const data = await gql<{ activities: Activity[] }>(ACTIVITIES_QUERY, { taskId });
      setTaskActivities((prev) => ({ ...prev, [taskId]: data.activities }));
    } catch {
      // ignore
    }
  }, []);

  const loadLabels = useCallback(async () => {
    try {
      const data = await gql<{ labels: Label[] }>(LABELS_QUERY);
      setLabels(data.labels);
    } catch {
      // ignore
    }
  }, []);

  const selectTask = useCallback((task: Task) => {
    setSelectedTask(task);
    loadSubtasks(task.taskId);
    loadComments(task.taskId);
    loadTaskActivities(task.taskId);
  }, [loadSubtasks, loadComments, loadTaskActivities]);

  // ── Helpers ──

  const getTaskSprintColumns = useCallback((task: Task): string[] | null => {
    if (!task.sprintId) return null;
    const sprint = sprints.find((s) => s.sprintId === task.sprintId);
    if (!sprint) return null;
    try { return JSON.parse(sprint.columns) as string[]; } catch { return null; }
  }, [sprints]);

  // ── Status / Column changes ──

  const handleStatusChange = useCallback(async (taskId: string, status: string) => {
    const task = tasks.find((t) => t.taskId === taskId);
    const columns = task ? getTaskSprintColumns(task) : null;
    const newColumn = columns ? statusToColumn(status, columns) : undefined;
    const autoAssign = status === 'in_progress' && task && !task.assigneeId && userId ? userId : undefined;

    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId
        ? { ...t, status, ...(newColumn !== undefined ? { sprintColumn: newColumn } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) }
        : t
    ));
    setSelectedTask((t) => t?.taskId === taskId
      ? { ...t, status, ...(newColumn !== undefined ? { sprintColumn: newColumn } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) }
      : t
    );

    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $status: String!${newColumn !== undefined ? ', $sprintColumn: String' : ''}${autoAssign ? ', $assigneeId: ID' : ''}) {
          updateTask(taskId: $taskId, status: $status${newColumn !== undefined ? ', sprintColumn: $sprintColumn' : ''}${autoAssign ? ', assigneeId: $assigneeId' : ''}) { taskId }
        }`,
        { taskId, status, ...(newColumn !== undefined ? { sprintColumn: newColumn } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) },
      );
    } catch {
      loadTasks();
    }
  }, [tasks, getTaskSprintColumns, userId, loadTasks]);

  const handleSubtaskStatusChange = useCallback(async (parentTaskId: string, taskId: string, status: string) => {
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $status: String!) { updateTask(taskId: $taskId, status: $status) { taskId } }`,
        { taskId, status },
      );
      setSubtasks((prev) => ({
        ...prev,
        [parentTaskId]: (prev[parentTaskId] ?? []).map((t) => t.taskId === taskId ? { ...t, status } : t),
      }));
    } catch {
      // ignore
    }
  }, []);

  const handleSprintColumnChange = useCallback(async (taskId: string, sprintColumn: string) => {
    const newStatus = columnToStatus(sprintColumn);
    const task = tasks.find((t) => t.taskId === taskId);
    const autoAssign = newStatus === 'in_progress' && task && !task.assigneeId && userId ? userId : undefined;

    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId
        ? { ...t, sprintColumn, ...(newStatus ? { status: newStatus } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) }
        : t
    ));
    setSelectedTask((t) => t?.taskId === taskId
      ? { ...t, sprintColumn, ...(newStatus ? { status: newStatus } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) }
      : t
    );
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $sprintColumn: String${newStatus ? ', $status: String!' : ''}${autoAssign ? ', $assigneeId: ID' : ''}) {
          updateTask(taskId: $taskId, sprintColumn: $sprintColumn${newStatus ? ', status: $status' : ''}${autoAssign ? ', assigneeId: $assigneeId' : ''}) { taskId }
        }`,
        { taskId, sprintColumn, ...(newStatus ? { status: newStatus } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) },
      );
    } catch {
      loadTasks();
    }
  }, [tasks, userId, loadTasks]);

  // ── Field updates ──

  const handleAssignSprint = useCallback(async (taskId: string, sprintId: string | null) => {
    const sprint = sprintId ? sprints.find((s) => s.sprintId === sprintId) : null;
    const firstColumn = sprint ? (JSON.parse(sprint.columns) as string[])[0] ?? null : null;
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, sprintId, sprintColumn: firstColumn } : t));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, sprintId, sprintColumn: firstColumn } : t);
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $sprintId: ID, $sprintColumn: String) {
          updateTask(taskId: $taskId, sprintId: $sprintId, sprintColumn: $sprintColumn) { taskId }
        }`,
        { taskId, sprintId, sprintColumn: firstColumn },
      );
    } catch {
      loadTasks();
    }
  }, [sprints, loadTasks]);

  const handleAssignUser = useCallback(async (taskId: string, assigneeId: string | null) => {
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, assigneeId } : t));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, assigneeId } : t);
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $assigneeId: ID) { updateTask(taskId: $taskId, assigneeId: $assigneeId) { taskId } }`,
        { taskId, assigneeId },
      );
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  const handleDueDateChange = useCallback(async (taskId: string, dueDate: string | null) => {
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, dueDate } : t));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, dueDate } : t);
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $dueDate: String) { updateTask(taskId: $taskId, dueDate: $dueDate) { taskId } }`,
        { taskId, dueDate },
      );
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  const handleUpdateDependencies = useCallback(async (taskId: string, dependsOnIds: string[]) => {
    const depValue = dependsOnIds.length > 0 ? JSON.stringify(dependsOnIds) : null;
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, dependsOn: depValue } : t));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, dependsOn: depValue } : t);
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $dependsOn: String) { updateTask(taskId: $taskId, dependsOn: $dependsOn) { taskId } }`,
        { taskId, dependsOn: depValue },
      );
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  // ── Reorder ──

  const handleReorderTask = useCallback(async (
    taskId: string, beforeTaskId: string | null, afterTaskId: string | null, targetSprintId: string | null,
  ) => {
    const task = tasks.find((t) => t.taskId === taskId);
    if (!task) return;

    const sectionTasks = tasks
      .filter((t) => !t.parentTaskId && !t.archived && t.sprintId === targetSprintId && t.taskId !== taskId)
      .sort((a, b) => {
        if (a.position != null && b.position != null) return a.position - b.position;
        if (a.position != null) return -1;
        if (b.position != null) return 1;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    let maxPos = 0;
    sectionTasks.forEach((t) => { if (t.position != null && t.position > maxPos) maxPos = t.position; });
    const getVP = (t: Task, idx: number): number => t.position ?? (maxPos + idx + 1);

    const beforeTask = beforeTaskId ? sectionTasks.find((t) => t.taskId === beforeTaskId) ?? null : null;
    const afterTask = afterTaskId ? sectionTasks.find((t) => t.taskId === afterTaskId) ?? null : null;
    const beforeIdx = beforeTask ? sectionTasks.indexOf(beforeTask) : -1;
    const afterIdx = afterTask ? sectionTasks.indexOf(afterTask) : -1;

    let newPosition: number;
    if (beforeTask && afterTask) {
      newPosition = (getVP(beforeTask, beforeIdx) + getVP(afterTask, afterIdx)) / 2;
    } else if (beforeTask) {
      newPosition = getVP(beforeTask, beforeIdx) + 1;
    } else if (afterTask) {
      newPosition = getVP(afterTask, afterIdx) - 1;
    } else {
      newPosition = 0;
    }

    const isChangingSprint = task.sprintId !== targetSprintId;
    const targetSprint = targetSprintId ? sprints.find((s) => s.sprintId === targetSprintId) : null;
    const newSprintColumn = isChangingSprint
      ? (targetSprint ? (JSON.parse(targetSprint.columns) as string[])[0] ?? null : null)
      : task.sprintColumn;

    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId ? { ...t, position: newPosition, sprintId: targetSprintId, sprintColumn: newSprintColumn } : t
    ));
    setSelectedTask((t) => t?.taskId === taskId
      ? { ...t, position: newPosition, sprintId: targetSprintId, sprintColumn: newSprintColumn }
      : t
    );

    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $position: Float, $sprintId: ID, $sprintColumn: String) {
          updateTask(taskId: $taskId, position: $position, sprintId: $sprintId, sprintColumn: $sprintColumn) { taskId }
        }`,
        { taskId, position: newPosition, sprintId: targetSprintId, sprintColumn: newSprintColumn },
      );
    } catch {
      loadTasks();
    }
  }, [tasks, sprints, loadTasks]);

  // ── Create / Bulk ──

  const handleAddTask = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newTaskTitle.trim()) return;
    setAddErr(null);
    try {
      await gql<{ createTask: Task }>(CREATE_TASK_MUTATION, { projectId, title: newTaskTitle });
      setNewTaskTitle('');
      setShowAddForm(false);
      loadTasks();
    } catch (error) {
      setAddErr(error instanceof Error ? error.message : 'Failed to add task');
    }
  }, [projectId, newTaskTitle, loadTasks]);

  const handleBulkCreateTasks = useCallback(async (
    tasksToCreate: Array<{ title: string; description?: string; status?: string; priority?: string }>,
    onProgress?: (current: number, total: number) => void,
  ) => {
    if (!projectId) return;
    for (let i = 0; i < tasksToCreate.length; i++) {
      const t = tasksToCreate[i];
      await gql<{ createTask: Task }>(CREATE_TASK_WITH_STATUS_MUTATION, { projectId, title: t.title, status: t.status });
      onProgress?.(i + 1, tasksToCreate.length);
    }
    await loadTasks();
  }, [projectId, loadTasks]);

  const handleCreateSubtask = useCallback(async (parentTaskId: string, title: string) => {
    try {
      const data = await gql<{ createSubtask: Task }>(CREATE_SUBTASK_MUTATION, { parentTaskId, title });
      setSubtasks((prev) => ({
        ...prev,
        [parentTaskId]: [...(prev[parentTaskId] ?? []), data.createSubtask],
      }));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create subtask');
    }
  }, []);

  // ── Title editing ──

  const startEditTitle = useCallback((task: Task) => {
    setEditTitleValue(task.title);
    setEditingTitle(true);
    setTimeout(() => titleEditRef.current?.focus(), 0);
  }, []);

  const handleTitleSave = useCallback(async () => {
    if (!selectedTask || !editTitleValue.trim()) return;
    setEditingTitle(false);
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $title: String!) { updateTask(taskId: $taskId, title: $title) { taskId } }`,
        { taskId: selectedTask.taskId, title: editTitleValue },
      );
      const updated = { ...selectedTask, title: editTitleValue };
      setTasks((prev) => prev.map((t) => t.taskId === selectedTask.taskId ? updated : t));
      setSelectedTask(updated);
    } catch {
      setEditingTitle(false);
    }
  }, [selectedTask, editTitleValue]);

  const handleUpdateTask = useCallback(async (
    taskId: string,
    updates: { description?: string; instructions?: string; acceptanceCriteria?: string; storyPoints?: number | null },
  ) => {
    const mutationParts: string[] = ['$taskId: ID!'];
    const vars: Record<string, unknown> = { taskId };
    if (updates.description !== undefined) { mutationParts.push('$description: String'); vars.description = updates.description; }
    if (updates.instructions !== undefined) { mutationParts.push('$instructions: String'); vars.instructions = updates.instructions; }
    if (updates.acceptanceCriteria !== undefined) { mutationParts.push('$acceptanceCriteria: String'); vars.acceptanceCriteria = updates.acceptanceCriteria; }
    if (updates.storyPoints !== undefined) { mutationParts.push('$storyPoints: Int'); vars.storyPoints = updates.storyPoints; }

    const argsPart = Object.keys(updates).map((k) => `${k}: $${k}`).join(', ');

    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, ...updates } : t));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, ...updates } : t);

    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask(${mutationParts.join(', ')}) { updateTask(taskId: $taskId, ${argsPart}) { taskId } }`,
        vars,
      );
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  // ── Bulk / Archive ──

  const handleBulkUpdate = useCallback(async (
    taskIds: string[],
    updates: { status?: string; assigneeId?: string | null; sprintId?: string | null; archived?: boolean },
  ) => {
    setTasks((prev) => prev.map((t) => taskIds.includes(t.taskId) ? { ...t, ...updates } : t));
    try {
      await gql<{ bulkUpdateTasks: Task[] }>(BULK_UPDATE_TASKS_MUTATION, { taskIds, ...updates });
      setSelectedTaskIds(new Set());
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  const handleArchiveTask = useCallback(async (taskId: string, archived: boolean) => {
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, archived } : t));
    if (archived) setSelectedTask((t) => t?.taskId === taskId ? null : t);
    else setSelectedTask((t) => t?.taskId === taskId ? { ...t, archived } : t);
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $archived: Boolean) { updateTask(taskId: $taskId, archived: $archived) { taskId } }`,
        { taskId, archived },
      );
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  // ── Labels ──

  const handleCreateLabel = useCallback(async (name: string, color: string): Promise<Label | null> => {
    try {
      const data = await gql<{ createLabel: Label }>(CREATE_LABEL_MUTATION, { name, color });
      setLabels((prev) => [...prev, data.createLabel].sort((a, b) => a.name.localeCompare(b.name)));
      return data.createLabel;
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create label');
      return null;
    }
  }, []);

  const handleDeleteLabel = useCallback(async (labelId: string) => {
    try {
      await gql<{ deleteLabel: boolean }>(DELETE_LABEL_MUTATION, { labelId });
      setLabels((prev) => prev.filter((l) => l.labelId !== labelId));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to delete label');
    }
  }, []);

  const handleAddTaskLabel = useCallback(async (taskId: string, labelId: string) => {
    const label = labels.find((l) => l.labelId === labelId);
    if (!label) return;
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, labels: [...(t.labels ?? []), label] } : t));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, labels: [...(t.labels ?? []), label] } : t);
    try {
      await gql<{ addTaskLabel: Task }>(ADD_TASK_LABEL_MUTATION, { taskId, labelId });
    } catch {
      loadTasks();
    }
  }, [labels, loadTasks]);

  const handleRemoveTaskLabel = useCallback(async (taskId: string, labelId: string) => {
    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId ? { ...t, labels: (t.labels ?? []).filter((l) => l.labelId !== labelId) } : t
    ));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, labels: (t.labels ?? []).filter((l) => l.labelId !== labelId) } : t);
    try {
      await gql<{ removeTaskLabel: Task }>(REMOVE_TASK_LABEL_MUTATION, { taskId, labelId });
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  // ── Comments ──

  const handleCreateComment = useCallback(async (taskId: string, content: string, parentCommentId?: string) => {
    try {
      await gql<{ createComment: Comment }>(
        CREATE_COMMENT_MUTATION, { taskId, content, parentCommentId: parentCommentId ?? null },
      );
      await loadComments(taskId);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create comment');
    }
  }, [loadComments]);

  const handleUpdateComment = useCallback(async (commentId: string, content: string) => {
    try {
      await gql<{ updateComment: Comment }>(UPDATE_COMMENT_MUTATION, { commentId, content });
      if (selectedTask) await loadComments(selectedTask.taskId);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update comment');
    }
  }, [selectedTask, loadComments]);

  const handleDeleteComment = useCallback(async (commentId: string, taskId: string) => {
    try {
      await gql<{ deleteComment: boolean }>(DELETE_COMMENT_MUTATION, { commentId });
      await loadComments(taskId);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to delete comment');
    }
  }, [loadComments]);

  return {
    // State
    tasks, hasMore, loading, err, selectedTask, subtasks, comments, taskActivities,
    labels, selectedTaskIds, showAddForm, newTaskTitle, addErr,
    editingTitle, editTitleValue, titleEditRef, rootTasks,
    // Setters
    setTasks, setSubtasks, setSelectedTask, setErr, setSelectedTaskIds,
    setShowAddForm, setNewTaskTitle, setEditTitleValue, setEditingTitle,
    // Data loaders
    loadTasks, loadMoreTasks, loadSubtasks, loadLabels, selectTask,
    // Task operations
    handleStatusChange, handleSubtaskStatusChange, handleSprintColumnChange,
    handleAssignSprint, handleAssignUser, handleDueDateChange,
    handleReorderTask, handleUpdateDependencies,
    handleAddTask, handleBulkCreateTasks, handleCreateSubtask,
    startEditTitle, handleTitleSave, handleUpdateTask,
    handleBulkUpdate, handleArchiveTask,
    // Labels
    handleCreateLabel, handleDeleteLabel, handleAddTaskLabel, handleRemoveTaskLabel,
    // Comments
    handleCreateComment, handleUpdateComment, handleDeleteComment,
  };
}
