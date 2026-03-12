import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { gql } from '../api/client';
import type { Task, TaskConnection, TaskPlanPreview, Sprint, OrgUser, CloseSprintResult } from '../types';
import { TASK_FIELDS, columnToStatus, statusToColumn } from '../utils/taskHelpers';

const VIEW_KEY = 'task-toad-view';

export interface ProjectData {
  projectId: string | undefined;

  // State
  tasks: Task[];
  hasMore: boolean;
  loading: boolean;
  err: string | null;
  selectedTask: Task | null;
  subtasks: Record<string, Task[]>;
  sprints: Sprint[];
  orgUsers: OrgUser[];
  previewTasks: TaskPlanPreview[] | null;
  previewLoading: boolean;
  previewError: string | null;
  committing: boolean;
  summary: string | null;
  summarizing: boolean;
  generatingInstructions: string | null;
  isGenerating: boolean;
  view: 'backlog' | 'board';
  editingTitle: boolean;
  editTitleValue: string;
  showAddForm: boolean;
  newTaskTitle: string;
  addErr: string | null;
  showSprintModal: boolean;
  editingSprint: Sprint | null;
  showSprintPlanModal: boolean;
  closeSprintId: string | null;

  // Actions
  loadTasks: () => Promise<Task[]>;
  loadMoreTasks: () => Promise<void>;
  selectTask: (task: Task) => void;
  handleStatusChange: (taskId: string, status: Task['status']) => Promise<void>;
  handleSubtaskStatusChange: (parentTaskId: string, taskId: string, status: Task['status']) => Promise<void>;
  handleSprintColumnChange: (taskId: string, sprintColumn: string) => Promise<void>;
  handleAssignSprint: (taskId: string, sprintId: string | null) => Promise<void>;
  handleAssignUser: (taskId: string, assigneeId: string | null) => Promise<void>;
  handleDueDateChange: (taskId: string, dueDate: string | null) => Promise<void>;
  handleReorderTask: (taskId: string, beforeTaskId: string | null, afterTaskId: string | null, targetSprintId: string | null) => Promise<void>;
  handleActivateSprint: (sprintId: string) => Promise<void>;
  handleCreateSprint: (sprint: Sprint) => void;
  handleSprintPlanCreated: (newSprints: Sprint[]) => void;
  handleSprintClosed: (result: CloseSprintResult) => void;
  handleSprintUpdated: (sprint: Sprint) => void;
  handleDeleteSprint: (sprintId: string) => Promise<void>;
  openPreview: (context?: string, appendToTitles?: string[]) => Promise<void>;
  handleCommitPlan: (selectedTasks: TaskPlanPreview[]) => Promise<void>;
  handleSummarize: () => Promise<void>;
  handleGenerateInstructions: (task: Task) => Promise<void>;
  handleAddTask: (e: React.FormEvent) => Promise<void>;
  startEditTitle: (task: Task) => void;
  handleTitleSave: () => Promise<void>;
  switchView: (v: 'backlog' | 'board') => void;
  setSelectedTask: React.Dispatch<React.SetStateAction<Task | null>>;
  setErr: React.Dispatch<React.SetStateAction<string | null>>;
  setSummary: React.Dispatch<React.SetStateAction<string | null>>;
  setPreviewTasks: React.Dispatch<React.SetStateAction<TaskPlanPreview[] | null>>;
  setPreviewError: React.Dispatch<React.SetStateAction<string | null>>;
  setShowAddForm: React.Dispatch<React.SetStateAction<boolean>>;
  setNewTaskTitle: React.Dispatch<React.SetStateAction<string>>;
  setEditTitleValue: React.Dispatch<React.SetStateAction<string>>;
  setEditingTitle: React.Dispatch<React.SetStateAction<boolean>>;
  setShowSprintModal: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingSprint: React.Dispatch<React.SetStateAction<Sprint | null>>;
  setShowSprintPlanModal: React.Dispatch<React.SetStateAction<boolean>>;
  setCloseSprintId: React.Dispatch<React.SetStateAction<string | null>>;

  // Computed
  activeSprint: Sprint | undefined;
  rootTasks: Task[];

  // Refs
  titleEditRef: React.RefObject<HTMLInputElement>;
  abortRef: React.MutableRefObject<AbortController | null>;
}

export function useProjectData(): ProjectData {
  const { projectId } = useParams<{ projectId: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const locationState = location.state as { autoPreview?: boolean } | null;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [taskOffset, setTaskOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [subtasks, setSubtasks] = useState<Record<string, Task[]>>({});
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [showSprintPlanModal, setShowSprintPlanModal] = useState(false);
  const [closeSprintId, setCloseSprintId] = useState<string | null>(null);

  const stored = localStorage.getItem(VIEW_KEY);
  const [view, setView] = useState<'backlog' | 'board'>(stored === 'board' ? 'board' : 'backlog');

  const [previewTasks, setPreviewTasks] = useState<TaskPlanPreview[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);

  const [generatingInstructions, setGeneratingInstructions] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const titleEditRef = useRef<HTMLInputElement>(null);
  const autoPreviewFiredRef = useRef(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const isGenerating = previewLoading || summarizing || committing || generatingInstructions !== null;
  const isGeneratingRef = useRef(false);
  isGeneratingRef.current = isGenerating;

  // Block browser tab close / refresh during generation
  useEffect(() => {
    if (!isGenerating) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isGenerating]);

  // Intercept browser back/forward navigation during generation
  useEffect(() => {
    if (!isGenerating) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      if (!isGeneratingRef.current) return;
      const leave = window.confirm(
        'An AI generation is in progress. If you leave, the request will be cancelled.\n\nAre you sure you want to leave?'
      );
      if (leave) {
        abortRef.current?.abort();
        abortRef.current = null;
        window.history.back();
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [isGenerating]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => { abortRef.current?.abort(); };
  }, []);

  // --- Data loading ---

  const loadTasks = async (): Promise<Task[]> => {
    if (!projectId) return [];
    try {
      const data = await gql<{ tasks: TaskConnection }>(
        `query Tasks($projectId: ID!) { tasks(projectId: $projectId) { tasks { ${TASK_FIELDS} } hasMore total } }`,
        { projectId }
      );
      setTasks(data.tasks.tasks);
      setHasMore(data.tasks.hasMore);
      setTaskOffset(0);
      if (selectedTask) {
        const refreshed = data.tasks.tasks.find((t) => t.taskId === selectedTask.taskId);
        if (refreshed) setSelectedTask(refreshed);
      }
      return data.tasks.tasks;
    } catch {
      return [];
    } finally {
      setLoading(false);
    }
  };

  const loadMoreTasks = async () => {
    if (!projectId || !hasMore) return;
    const newOffset = taskOffset + 100;
    try {
      const data = await gql<{ tasks: TaskConnection }>(
        `query Tasks($projectId: ID!, $limit: Int, $offset: Int) { tasks(projectId: $projectId, limit: $limit, offset: $offset) { tasks { ${TASK_FIELDS} } hasMore total } }`,
        { projectId, limit: 100, offset: newOffset }
      );
      setTasks((prev) => [...prev, ...data.tasks.tasks]);
      setHasMore(data.tasks.hasMore);
      setTaskOffset(newOffset);
    } catch {
      // ignore
    }
  };

  const loadSubtasks = async (taskId: string) => {
    if (!projectId) return;
    try {
      const data = await gql<{ tasks: TaskConnection }>(
        `query Subtasks($projectId: ID!, $parentTaskId: ID) { tasks(projectId: $projectId, parentTaskId: $parentTaskId) { tasks { ${TASK_FIELDS} } } }`,
        { projectId, parentTaskId: taskId }
      );
      setSubtasks((prev) => ({ ...prev, [taskId]: data.tasks.tasks }));
    } catch {
      // ignore
    }
  };

  const loadSprints = async () => {
    if (!projectId) return;
    try {
      const data = await gql<{ sprints: Sprint[] }>(
        `query Sprints($projectId: ID!) { sprints(projectId: $projectId) { sprintId projectId name isActive columns startDate endDate createdAt closedAt } }`,
        { projectId }
      );
      setSprints(data.sprints);
    } catch {
      // ignore
    }
  };

  const loadOrgUsers = async () => {
    try {
      const data = await gql<{ orgUsers: OrgUser[] }>(
        `query OrgUsers { orgUsers { userId email role } }`
      );
      setOrgUsers(data.orgUsers);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    Promise.all([loadTasks(), loadSprints(), loadOrgUsers()]).then(([loadedTasks]) => {
      if (
        locationState?.autoPreview &&
        loadedTasks.length === 0 &&
        !autoPreviewFiredRef.current
      ) {
        autoPreviewFiredRef.current = true;
        navigate(location.pathname, { replace: true, state: {} });
        openPreview();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // --- Helpers ---

  const getTaskSprintColumns = useCallback((task: Task): string[] | null => {
    if (!task.sprintId) return null;
    const sprint = sprints.find((s) => s.sprintId === task.sprintId);
    if (!sprint) return null;
    try { return JSON.parse(sprint.columns) as string[]; } catch { return null; }
  }, [sprints]);

  // --- Event handlers ---

  const switchView = (v: 'backlog' | 'board') => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
  };

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    const task = tasks.find((t) => t.taskId === taskId);
    const columns = task ? getTaskSprintColumns(task) : null;
    const newColumn = columns ? statusToColumn(status, columns) : undefined;

    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId
        ? { ...t, status, ...(newColumn !== undefined ? { sprintColumn: newColumn } : {}) }
        : t
    ));
    if (selectedTask?.taskId === taskId) {
      setSelectedTask((t) => t ? { ...t, status, ...(newColumn !== undefined ? { sprintColumn: newColumn } : {}) } : t);
    }

    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $status: TaskStatus!${newColumn !== undefined ? ', $sprintColumn: String' : ''}) {
          updateTask(taskId: $taskId, status: $status${newColumn !== undefined ? ', sprintColumn: $sprintColumn' : ''}) { taskId }
        }`,
        { taskId, status, ...(newColumn !== undefined ? { sprintColumn: newColumn } : {}) }
      );
    } catch {
      loadTasks();
    }
  };

  const handleSubtaskStatusChange = async (parentTaskId: string, taskId: string, status: Task['status']) => {
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $status: TaskStatus!) {
          updateTask(taskId: $taskId, status: $status) { taskId }
        }`,
        { taskId, status }
      );
      setSubtasks((prev) => ({
        ...prev,
        [parentTaskId]: (prev[parentTaskId] ?? []).map((t) =>
          t.taskId === taskId ? { ...t, status } : t
        ),
      }));
    } catch {
      // ignore
    }
  };

  const handleSprintColumnChange = async (taskId: string, sprintColumn: string) => {
    const newStatus = columnToStatus(sprintColumn);
    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId
        ? { ...t, sprintColumn, ...(newStatus ? { status: newStatus } : {}) }
        : t
    ));
    if (selectedTask?.taskId === taskId) {
      setSelectedTask((t) => t ? { ...t, sprintColumn, ...(newStatus ? { status: newStatus } : {}) } : t);
    }
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $sprintColumn: String${newStatus ? ', $status: TaskStatus!' : ''}) {
          updateTask(taskId: $taskId, sprintColumn: $sprintColumn${newStatus ? ', status: $status' : ''}) { taskId }
        }`,
        { taskId, sprintColumn, ...(newStatus ? { status: newStatus } : {}) }
      );
    } catch {
      loadTasks();
    }
  };

  const handleAssignSprint = async (taskId: string, sprintId: string | null) => {
    const sprint = sprintId ? sprints.find((s) => s.sprintId === sprintId) : null;
    const firstColumn = sprint ? (JSON.parse(sprint.columns) as string[])[0] ?? null : null;
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, sprintId, sprintColumn: firstColumn } : t));
    if (selectedTask?.taskId === taskId) setSelectedTask((t) => t ? { ...t, sprintId, sprintColumn: firstColumn } : t);
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $sprintId: ID, $sprintColumn: String) {
          updateTask(taskId: $taskId, sprintId: $sprintId, sprintColumn: $sprintColumn) { taskId }
        }`,
        { taskId, sprintId, sprintColumn: firstColumn }
      );
    } catch {
      loadTasks();
    }
  };

  const handleAssignUser = async (taskId: string, assigneeId: string | null) => {
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, assigneeId } : t));
    if (selectedTask?.taskId === taskId) setSelectedTask((t) => t ? { ...t, assigneeId } : t);
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $assigneeId: ID) {
          updateTask(taskId: $taskId, assigneeId: $assigneeId) { taskId }
        }`,
        { taskId, assigneeId }
      );
    } catch {
      loadTasks();
    }
  };

  const handleDueDateChange = async (taskId: string, dueDate: string | null) => {
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, dueDate } : t));
    if (selectedTask?.taskId === taskId) setSelectedTask((t) => t ? { ...t, dueDate } : t);
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $dueDate: String) {
          updateTask(taskId: $taskId, dueDate: $dueDate) { taskId }
        }`,
        { taskId, dueDate }
      );
    } catch {
      loadTasks();
    }
  };

  const handleReorderTask = async (
    taskId: string,
    beforeTaskId: string | null,
    afterTaskId: string | null,
    targetSprintId: string | null
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
      t.taskId === taskId
        ? { ...t, position: newPosition, sprintId: targetSprintId, sprintColumn: newSprintColumn }
        : t
    ));
    if (selectedTask?.taskId === taskId) {
      setSelectedTask((t) => t ? { ...t, position: newPosition, sprintId: targetSprintId, sprintColumn: newSprintColumn } : t);
    }

    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $position: Float, $sprintId: ID, $sprintColumn: String) {
          updateTask(taskId: $taskId, position: $position, sprintId: $sprintId, sprintColumn: $sprintColumn) { taskId }
        }`,
        { taskId, position: newPosition, sprintId: targetSprintId, sprintColumn: newSprintColumn }
      );
    } catch {
      loadTasks();
    }
  };

  const handleActivateSprint = async (sprintId: string) => {
    try {
      await gql<{ updateSprint: Sprint }>(
        `mutation UpdateSprint($sprintId: ID!, $isActive: Boolean) {
          updateSprint(sprintId: $sprintId, isActive: $isActive) { sprintId isActive }
        }`,
        { sprintId, isActive: true }
      );
      setSprints((prev) => prev.map((s) => ({ ...s, isActive: s.sprintId === sprintId })));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to activate sprint');
    }
  };

  const handleCreateSprint = (sprint: Sprint) => {
    setSprints((prev) => [...prev, sprint]);
    setShowSprintModal(false);
  };

  const handleSprintPlanCreated = (newSprints: Sprint[]) => {
    setSprints((prev) => [...prev, ...newSprints]);
    setShowSprintPlanModal(false);
  };

  const handleSprintClosed = (result: CloseSprintResult) => {
    setSprints((prev) =>
      prev.map((s) => s.sprintId === result.sprint.sprintId ? result.sprint : s)
    );
    setCloseSprintId(null);
    loadTasks();
  };

  const handleSprintUpdated = (sprint: Sprint) => {
    setSprints((prev) => prev.map((s) => s.sprintId === sprint.sprintId ? sprint : s));
    setEditingSprint(null);
  };

  const handleDeleteSprint = async (sprintId: string) => {
    try {
      await gql<{ deleteSprint: boolean }>(
        `mutation DeleteSprint($sprintId: ID!) { deleteSprint(sprintId: $sprintId) }`,
        { sprintId }
      );
      setSprints((prev) => prev.filter((s) => s.sprintId !== sprintId));
      setTasks((prev) => prev.map((t) => t.sprintId === sprintId ? { ...t, sprintId: null, sprintColumn: null } : t));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to delete sprint');
    }
  };

  // --- AI generation handlers ---

  const openPreview = async (context?: string, appendToTitles?: string[]) => {
    if (!projectId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setPreviewLoading(true);
    setPreviewError(null);
    if (!appendToTitles) setPreviewTasks([]);
    try {
      const data = await gql<{ previewTaskPlan: TaskPlanPreview[] }>(
        `mutation PreviewTaskPlan($projectId: ID!, $context: String, $appendToTitles: [String!]) {
          previewTaskPlan(projectId: $projectId, context: $context, appendToTitles: $appendToTitles) {
            title description instructions suggestedTools estimatedHours priority dependsOn
            subtasks { title description }
          }
        }`,
        { projectId, context: context ?? null, appendToTitles: appendToTitles ?? null },
        controller.signal
      );
      if (appendToTitles && previewTasks) {
        const existingTitles = new Set(previewTasks.map((t) => t.title));
        const newTasks = data.previewTaskPlan.filter((t) => !existingTitles.has(t.title));
        setPreviewTasks([...previewTasks, ...newTasks]);
      } else {
        setPreviewTasks(data.previewTaskPlan);
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setPreviewError(error instanceof Error ? error.message : 'Failed to generate task plan');
    } finally {
      setPreviewLoading(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleCommitPlan = async (selectedTasks: TaskPlanPreview[]) => {
    if (!projectId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setCommitting(true);
    setErr(null);
    try {
      const data = await gql<{ commitTaskPlan: Task[] }>(
        `mutation CommitTaskPlan($projectId: ID!, $tasks: [CommitTaskInput!]!, $clearExisting: Boolean) {
          commitTaskPlan(projectId: $projectId, tasks: $tasks, clearExisting: $clearExisting) {
            ${TASK_FIELDS}
          }
        }`,
        {
          projectId,
          tasks: selectedTasks.map((t) => ({
            title: t.title,
            description: t.description,
            instructions: t.instructions,
            suggestedTools: t.suggestedTools,
            estimatedHours: t.estimatedHours,
            priority: t.priority,
            dependsOn: t.dependsOn,
            subtasks: t.subtasks,
          })),
          clearExisting: true,
        },
        controller.signal
      );
      setTasks(data.commitTaskPlan);
      setSubtasks({});
      setSelectedTask(null);
      setPreviewTasks(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErr(error instanceof Error ? error.message : 'Failed to create tasks');
    } finally {
      setCommitting(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleSummarize = async () => {
    if (!projectId) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setSummarizing(true);
    setErr(null);
    setSummary(null);
    try {
      const data = await gql<{ summarizeProject: string }>(
        `mutation SummarizeProject($projectId: ID!) {
          summarizeProject(projectId: $projectId)
        }`,
        { projectId },
        controller.signal
      );
      setSummary(data.summarizeProject);
      setSelectedTask(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErr(error instanceof Error ? error.message : 'Failed to summarize project');
    } finally {
      setSummarizing(false);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleGenerateInstructions = async (task: Task) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setGeneratingInstructions(task.taskId);
    try {
      const data = await gql<{ generateTaskInstructions: Task }>(
        `mutation GenerateTaskInstructions($taskId: ID!) {
          generateTaskInstructions(taskId: $taskId) { ${TASK_FIELDS} }
        }`,
        { taskId: task.taskId },
        controller.signal
      );
      const updated = data.generateTaskInstructions;
      setTasks((prev) => prev.map((t) => t.taskId === updated.taskId ? updated : t));
      setSelectedTask(updated);
      loadSubtasks(updated.taskId);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setErr(error instanceof Error ? error.message : 'Failed to generate instructions');
    } finally {
      setGeneratingInstructions(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  // --- Non-AI handlers ---

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId || !newTaskTitle.trim()) return;
    setAddErr(null);
    try {
      await gql<{ createTask: Task }>(
        `mutation CreateTask($projectId: ID!, $title: String!) {
          createTask(projectId: $projectId, title: $title) { taskId }
        }`,
        { projectId, title: newTaskTitle }
      );
      setNewTaskTitle('');
      setShowAddForm(false);
      loadTasks();
    } catch (error) {
      setAddErr(error instanceof Error ? error.message : 'Failed to add task');
    }
  };

  const startEditTitle = (task: Task) => {
    setEditTitleValue(task.title);
    setEditingTitle(true);
    setTimeout(() => titleEditRef.current?.focus(), 0);
  };

  const handleTitleSave = async () => {
    if (!selectedTask || !editTitleValue.trim()) return;
    setEditingTitle(false);
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $title: String!) {
          updateTask(taskId: $taskId, title: $title) { taskId }
        }`,
        { taskId: selectedTask.taskId, title: editTitleValue }
      );
      const updated = { ...selectedTask, title: editTitleValue };
      setTasks((prev) => prev.map((t) => t.taskId === selectedTask.taskId ? updated : t));
      setSelectedTask(updated);
    } catch {
      setEditingTitle(false);
    }
  };

  const selectTask = (task: Task) => {
    setSelectedTask(task);
    loadSubtasks(task.taskId);
  };

  // --- Computed ---

  const activeSprint = sprints.find((s) => s.isActive);
  const rootTasks = tasks.filter((t) => !t.parentTaskId && !t.archived);

  return {
    projectId,
    tasks, hasMore, loading, err, selectedTask, subtasks, sprints, orgUsers,
    previewTasks, previewLoading, previewError, committing, summary, summarizing,
    generatingInstructions, isGenerating, view, editingTitle, editTitleValue,
    showAddForm, newTaskTitle, addErr, showSprintModal, editingSprint,
    showSprintPlanModal, closeSprintId,
    loadTasks, loadMoreTasks, selectTask,
    handleStatusChange, handleSubtaskStatusChange, handleSprintColumnChange,
    handleAssignSprint, handleAssignUser, handleDueDateChange, handleReorderTask,
    handleActivateSprint, handleCreateSprint, handleSprintPlanCreated,
    handleSprintClosed, handleSprintUpdated, handleDeleteSprint,
    openPreview, handleCommitPlan, handleSummarize, handleGenerateInstructions,
    handleAddTask, startEditTitle, handleTitleSave, switchView,
    setSelectedTask, setErr, setSummary, setPreviewTasks, setPreviewError,
    setShowAddForm, setNewTaskTitle, setEditTitleValue, setEditingTitle,
    setShowSprintModal, setEditingSprint, setShowSprintPlanModal, setCloseSprintId,
    activeSprint, rootTasks,
    titleEditRef, abortRef,
  };
}
