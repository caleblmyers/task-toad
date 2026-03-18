import { useState, useCallback, useRef, useMemo } from 'react';
import { gql } from '../api/client';
import {
  TASKS_QUERY, TASKS_PAGINATED_QUERY, SUBTASKS_QUERY, CREATE_TASK_MUTATION,
  CREATE_TASK_WITH_STATUS_MUTATION, CREATE_SUBTASK_MUTATION, BULK_UPDATE_TASKS_MUTATION,
} from '../api/queries';
import { columnToStatus, statusToColumn } from '../utils/taskHelpers';
import { parseColumns } from '../utils/jsonHelpers';
import type { Task, TaskConnection, Sprint, TaskDependency } from '../types';

interface UpdateTaskResult {
  task: { taskId: string };
  warnings: string[];
}

interface UseTaskOperationsOptions {
  projectId: string | undefined;
  userId: string | undefined;
  sprints: Sprint[];
  onWarnings?: (warnings: string[]) => void;
}

export function useTaskOperations({ projectId, userId, sprints, onWarnings }: UseTaskOperationsOptions) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [taskOffset, setTaskOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Record<string, Task[]>>({});
  const [err, setErr] = useState<string | null>(null);

  // Add task form state
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);

  // Title editing state
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');
  const titleEditRef = useRef<HTMLInputElement>(null);

  const rootTasks = useMemo(() => tasks, [tasks]);

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

  // ── Helpers ──

  const getTaskSprintColumns = useCallback((task: Task): string[] | null => {
    if (!task.sprintId) return null;
    const sprint = sprints.find((s) => s.sprintId === task.sprintId);
    if (!sprint) return null;
    return parseColumns(sprint.columns);
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
      const data = await gql<{ updateTask: UpdateTaskResult }>(
        `mutation UpdateTask($taskId: ID!, $status: String!${newColumn !== undefined ? ', $sprintColumn: String' : ''}${autoAssign ? ', $assigneeId: ID' : ''}) {
          updateTask(taskId: $taskId, status: $status${newColumn !== undefined ? ', sprintColumn: $sprintColumn' : ''}${autoAssign ? ', assigneeId: $assigneeId' : ''}) { task { taskId } warnings }
        }`,
        { taskId, status, ...(newColumn !== undefined ? { sprintColumn: newColumn } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) },
      );
      if (data.updateTask.warnings.length > 0) onWarnings?.(data.updateTask.warnings);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not allowed by the project workflow')) {
        onWarnings?.([error.message]);
      }
      loadTasks();
    }
  }, [tasks, getTaskSprintColumns, userId, loadTasks, onWarnings]);

  const handleSubtaskStatusChange = useCallback(async (parentTaskId: string, taskId: string, status: string) => {
    try {
      const data = await gql<{ updateTask: UpdateTaskResult }>(
        `mutation UpdateTask($taskId: ID!, $status: String!) { updateTask(taskId: $taskId, status: $status) { task { taskId } warnings } }`,
        { taskId, status },
      );
      setSubtasks((prev) => ({
        ...prev,
        [parentTaskId]: (prev[parentTaskId] ?? []).map((t) => t.taskId === taskId ? { ...t, status } : t),
      }));
      if (data.updateTask.warnings.length > 0) onWarnings?.(data.updateTask.warnings);
    } catch {
      // ignore
    }
  }, [onWarnings]);

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
      const data = await gql<{ updateTask: UpdateTaskResult }>(
        `mutation UpdateTask($taskId: ID!, $sprintColumn: String${newStatus ? ', $status: String!' : ''}${autoAssign ? ', $assigneeId: ID' : ''}) {
          updateTask(taskId: $taskId, sprintColumn: $sprintColumn${newStatus ? ', status: $status' : ''}${autoAssign ? ', assigneeId: $assigneeId' : ''}) { task { taskId } warnings }
        }`,
        { taskId, sprintColumn, ...(newStatus ? { status: newStatus } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) },
      );
      if (data.updateTask.warnings.length > 0) onWarnings?.(data.updateTask.warnings);
    } catch (error) {
      if (error instanceof Error && error.message.includes('not allowed by the project workflow')) {
        onWarnings?.([error.message]);
      }
      loadTasks();
    }
  }, [tasks, userId, loadTasks, onWarnings]);

  // ── Field updates ──

  const handleAssignSprint = useCallback(async (taskId: string, sprintId: string | null) => {
    const sprint = sprintId ? sprints.find((s) => s.sprintId === sprintId) : null;
    const firstColumn = sprint ? parseColumns(sprint.columns)[0] ?? null : null;
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, sprintId, sprintColumn: firstColumn } : t));
    setSelectedTask((t) => t?.taskId === taskId ? { ...t, sprintId, sprintColumn: firstColumn } : t);
    try {
      await gql<{ updateTask: UpdateTaskResult }>(
        `mutation UpdateTask($taskId: ID!, $sprintId: ID, $sprintColumn: String) {
          updateTask(taskId: $taskId, sprintId: $sprintId, sprintColumn: $sprintColumn) { task { taskId } warnings }
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
      await gql<{ updateTask: UpdateTaskResult }>(
        `mutation UpdateTask($taskId: ID!, $assigneeId: ID) { updateTask(taskId: $taskId, assigneeId: $assigneeId) { task { taskId } warnings } }`,
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
      await gql<{ updateTask: UpdateTaskResult }>(
        `mutation UpdateTask($taskId: ID!, $dueDate: String) { updateTask(taskId: $taskId, dueDate: $dueDate) { task { taskId } warnings } }`,
        { taskId, dueDate },
      );
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  const handleAddDependency = useCallback(async (sourceTaskId: string, targetTaskId: string, linkType: string) => {
    try {
      const data = await gql<{ addTaskDependency: TaskDependency }>(
        `mutation AddDep($sourceTaskId: ID!, $targetTaskId: ID!, $linkType: DependencyLinkType!) {
          addTaskDependency(sourceTaskId: $sourceTaskId, targetTaskId: $targetTaskId, linkType: $linkType) {
            taskDependencyId sourceTaskId targetTaskId linkType createdAt targetTask { taskId title status }
          }
        }`,
        { sourceTaskId, targetTaskId, linkType },
      );
      const dep = data.addTaskDependency;
      setTasks((prev) => prev.map((t) =>
        t.taskId === sourceTaskId ? { ...t, dependencies: [...(t.dependencies ?? []), dep] } : t
      ));
      setSelectedTask((t) => t?.taskId === sourceTaskId ? { ...t, dependencies: [...(t.dependencies ?? []), dep] } : t);
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  const handleRemoveDependency = useCallback(async (taskDependencyId: string) => {
    // Optimistically remove from both dependencies and dependents
    const removeDep = (t: Task): Task => ({
      ...t,
      dependencies: (t.dependencies ?? []).filter(d => d.taskDependencyId !== taskDependencyId),
      dependents: (t.dependents ?? []).filter(d => d.taskDependencyId !== taskDependencyId),
    });
    setTasks((prev) => prev.map(removeDep));
    setSelectedTask((t) => t ? removeDep(t) : t);
    try {
      await gql<{ removeTaskDependency: boolean }>(
        `mutation RemoveDep($taskDependencyId: ID!) { removeTaskDependency(taskDependencyId: $taskDependencyId) }`,
        { taskDependencyId },
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
      .filter((t) => !t.archived && t.sprintId === targetSprintId && t.taskId !== taskId)
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
      ? (targetSprint ? parseColumns(targetSprint.columns)[0] ?? null : null)
      : task.sprintColumn;

    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId ? { ...t, position: newPosition, sprintId: targetSprintId, sprintColumn: newSprintColumn } : t
    ));
    setSelectedTask((t) => t?.taskId === taskId
      ? { ...t, position: newPosition, sprintId: targetSprintId, sprintColumn: newSprintColumn }
      : t
    );

    try {
      await gql<{ updateTask: UpdateTaskResult }>(
        `mutation UpdateTask($taskId: ID!, $position: Float, $sprintId: ID, $sprintColumn: String) {
          updateTask(taskId: $taskId, position: $position, sprintId: $sprintId, sprintColumn: $sprintColumn) { task { taskId } warnings }
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
      await gql<{ updateTask: UpdateTaskResult }>(
        `mutation UpdateTask($taskId: ID!, $title: String!) { updateTask(taskId: $taskId, title: $title) { task { taskId } warnings } }`,
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
      await gql<{ updateTask: UpdateTaskResult }>(
        `mutation UpdateTask(${mutationParts.join(', ')}) { updateTask(taskId: $taskId, ${argsPart}) { task { taskId } warnings } }`,
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
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  const handleArchiveTask = useCallback(async (taskId: string, archived: boolean) => {
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, archived } : t));
    if (archived) setSelectedTask((t) => t?.taskId === taskId ? null : t);
    else setSelectedTask((t) => t?.taskId === taskId ? { ...t, archived } : t);
    try {
      await gql<{ updateTask: UpdateTaskResult }>(
        `mutation UpdateTask($taskId: ID!, $archived: Boolean) { updateTask(taskId: $taskId, archived: $archived) { task { taskId } warnings } }`,
        { taskId, archived },
      );
    } catch {
      loadTasks();
    }
  }, [loadTasks]);

  return {
    // State
    tasks, hasMore, loading, err, selectedTask, subtasks,
    showAddForm, newTaskTitle, addErr, editingTitle, editTitleValue, titleEditRef, rootTasks,
    // Setters
    setTasks, setSubtasks, setSelectedTask, setErr,
    setShowAddForm, setNewTaskTitle, setEditTitleValue, setEditingTitle,
    // Data loaders
    loadTasks, loadMoreTasks, loadSubtasks,
    // Task operations
    handleStatusChange, handleSubtaskStatusChange, handleSprintColumnChange,
    handleAssignSprint, handleAssignUser, handleDueDateChange,
    handleReorderTask, handleAddDependency, handleRemoveDependency,
    handleAddTask, handleBulkCreateTasks, handleCreateSubtask,
    startEditTitle, handleTitleSave, handleUpdateTask,
    handleBulkUpdate, handleArchiveTask,
  };
}
