import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { gql } from '../api/client';
import { useAuth } from '../auth/context';
import type { Task, TaskConnection, TaskPlanPreview, Sprint, OrgUser, CloseSprintResult, Project, Comment, Activity, ProjectStats, Label } from '../types';
import { TASK_FIELDS, columnToStatus, statusToColumn } from '../utils/taskHelpers';

const VIEW_KEY = 'task-toad-view';

export interface ProjectData {
  projectId: string | undefined;

  // State
  project: Project | null;
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
  generatingCode: string | null;
  generatedCode: {
    files: Array<{ path: string; content: string; language: string; description: string }>;
    summary: string;
    estimatedTokensUsed: number;
  } | null;
  creatingPR: boolean;
  isGenerating: boolean;
  view: 'backlog' | 'board' | 'dashboard' | 'table' | 'calendar';
  editingTitle: boolean;
  editTitleValue: string;
  showAddForm: boolean;
  newTaskTitle: string;
  addErr: string | null;
  showSprintModal: boolean;
  editingSprint: Sprint | null;
  showSprintPlanModal: boolean;
  closeSprintId: string | null;
  comments: Record<string, Comment[]>;
  taskActivities: Record<string, Activity[]>;
  dashboardStats: ProjectStats | null;
  labels: Label[];
  selectedTaskIds: Set<string>;
  projectStatuses: string[];

  // Actions
  loadTasks: () => Promise<Task[]>;
  loadMoreTasks: () => Promise<void>;
  selectTask: (task: Task) => void;
  handleStatusChange: (taskId: string, status: string) => Promise<void>;
  handleSubtaskStatusChange: (parentTaskId: string, taskId: string, status: string) => Promise<void>;
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
  handleGenerateCode: (task: Task) => Promise<void>;
  handleCreatePR: (files: Array<{ path: string; content: string }>) => Promise<void>;
  handleAddTask: (e: React.FormEvent) => Promise<void>;
  startEditTitle: (task: Task) => void;
  handleTitleSave: () => Promise<void>;
  handleUpdateTask: (taskId: string, updates: { description?: string; instructions?: string }) => Promise<void>;
  switchView: (v: 'backlog' | 'board' | 'dashboard' | 'table' | 'calendar') => void;
  handleUpdateProject: (data: { name?: string; description?: string; statuses?: string }) => Promise<void>;
  handleUpdateDependencies: (taskId: string, dependsOnIds: string[]) => Promise<void>;
  handleBulkUpdate: (taskIds: string[], updates: { status?: string; assigneeId?: string | null; sprintId?: string | null; archived?: boolean }) => Promise<void>;
  handleArchiveTask: (taskId: string, archived: boolean) => Promise<void>;
  handleCreateLabel: (name: string, color: string) => Promise<Label | null>;
  handleDeleteLabel: (labelId: string) => Promise<void>;
  handleAddTaskLabel: (taskId: string, labelId: string) => Promise<void>;
  handleRemoveTaskLabel: (taskId: string, labelId: string) => Promise<void>;
  handleCreateComment: (taskId: string, content: string, parentCommentId?: string) => Promise<void>;
  handleUpdateComment: (commentId: string, content: string) => Promise<void>;
  handleDeleteComment: (commentId: string, taskId: string) => Promise<void>;
  loadDashboardStats: () => Promise<void>;
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
  setGeneratedCode: React.Dispatch<React.SetStateAction<{
    files: Array<{ path: string; content: string; language: string; description: string }>;
    summary: string;
    estimatedTokensUsed: number;
  } | null>>;
  setSelectedTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;

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
  const { user } = useAuth();
  const locationState = location.state as { autoPreview?: boolean } | null;

  const [project, setProject] = useState<Project | null>(null);
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
  const [comments, setComments] = useState<Record<string, Comment[]>>({});
  const [taskActivities, setTaskActivities] = useState<Record<string, Activity[]>>({});
  const [dashboardStats, setDashboardStats] = useState<ProjectStats | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const stored = localStorage.getItem(VIEW_KEY);
  const validViews = ['backlog', 'board', 'dashboard', 'table', 'calendar'];
  const [view, setView] = useState<'backlog' | 'board' | 'dashboard' | 'table' | 'calendar'>(
    validViews.includes(stored ?? '') ? (stored as 'backlog' | 'board' | 'dashboard' | 'table' | 'calendar') : 'backlog'
  );

  const [previewTasks, setPreviewTasks] = useState<TaskPlanPreview[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [addErr, setAddErr] = useState<string | null>(null);

  const [generatingInstructions, setGeneratingInstructions] = useState<string | null>(null);
  const [generatingCode, setGeneratingCode] = useState<string | null>(null);
  const [generatedCode, setGeneratedCode] = useState<{
    files: Array<{ path: string; content: string; language: string; description: string }>;
    summary: string;
    estimatedTokensUsed: number;
  } | null>(null);
  const [creatingPR, setCreatingPR] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const titleEditRef = useRef<HTMLInputElement>(null);
  const autoPreviewFiredRef = useRef(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editTitleValue, setEditTitleValue] = useState('');

  const abortRef = useRef<AbortController | null>(null);
  const isGenerating = previewLoading || summarizing || committing || generatingInstructions !== null || generatingCode !== null;
  const isGeneratingRef = useRef(false);
  isGeneratingRef.current = isGenerating;

  const projectStatuses: string[] = project
    ? (() => { try { return JSON.parse(project.statuses) as string[]; } catch { return ['todo', 'in_progress', 'done']; } })()
    : ['todo', 'in_progress', 'done'];

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

  const loadProject = async () => {
    if (!projectId) return;
    try {
      const data = await gql<{ project: Project | null }>(
        `query Project($projectId: ID!) { project(projectId: $projectId) { projectId name description prompt statuses createdAt orgId archived } }`,
        { projectId }
      );
      if (data.project) setProject(data.project);
    } catch {
      // ignore
    }
  };

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

  const loadLabels = async () => {
    try {
      const data = await gql<{ labels: Label[] }>(
        `query Labels { labels { labelId name color } }`
      );
      setLabels(data.labels);
    } catch {
      // ignore
    }
  };

  const loadComments = async (taskId: string) => {
    try {
      const data = await gql<{ comments: Comment[] }>(
        `query Comments($taskId: ID!) { comments(taskId: $taskId) { commentId taskId userId userEmail parentCommentId content createdAt updatedAt replies { commentId taskId userId userEmail parentCommentId content createdAt updatedAt replies { commentId } } } }`,
        { taskId }
      );
      setComments((prev) => ({ ...prev, [taskId]: data.comments }));
    } catch {
      // ignore
    }
  };

  const loadTaskActivities = async (taskId: string) => {
    try {
      const data = await gql<{ activities: Activity[] }>(
        `query Activities($taskId: ID!) { activities(taskId: $taskId, limit: 30) { activityId projectId taskId sprintId userId userEmail action field oldValue newValue createdAt } }`,
        { taskId }
      );
      setTaskActivities((prev) => ({ ...prev, [taskId]: data.activities }));
    } catch {
      // ignore
    }
  };

  const loadDashboardStats = async () => {
    if (!projectId) return;
    try {
      const data = await gql<{ projectStats: ProjectStats }>(
        `query ProjectStats($projectId: ID!) { projectStats(projectId: $projectId) { totalTasks completedTasks overdueTasks completionPercent tasksByStatus { label count } tasksByPriority { label count } tasksByAssignee { userId email count } totalEstimatedHours completedEstimatedHours } }`,
        { projectId }
      );
      setDashboardStats(data.projectStats);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    Promise.all([loadProject(), loadTasks(), loadSprints(), loadOrgUsers(), loadLabels()]).then(([, loadedTasks]) => {
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

  const switchView = (v: 'backlog' | 'board' | 'dashboard' | 'table' | 'calendar') => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
    if (v === 'dashboard') loadDashboardStats();
  };

  const handleStatusChange = async (taskId: string, status: string) => {
    const task = tasks.find((t) => t.taskId === taskId);
    const columns = task ? getTaskSprintColumns(task) : null;
    const newColumn = columns ? statusToColumn(status, columns) : undefined;

    // Auto-assign if moving to in_progress and unassigned
    const autoAssign = status === 'in_progress' && task && !task.assigneeId && user ? user.userId : undefined;

    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId
        ? { ...t, status, ...(newColumn !== undefined ? { sprintColumn: newColumn } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) }
        : t
    ));
    if (selectedTask?.taskId === taskId) {
      setSelectedTask((t) => t ? { ...t, status, ...(newColumn !== undefined ? { sprintColumn: newColumn } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) } : t);
    }

    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $status: String!${newColumn !== undefined ? ', $sprintColumn: String' : ''}${autoAssign ? ', $assigneeId: ID' : ''}) {
          updateTask(taskId: $taskId, status: $status${newColumn !== undefined ? ', sprintColumn: $sprintColumn' : ''}${autoAssign ? ', assigneeId: $assigneeId' : ''}) { taskId }
        }`,
        { taskId, status, ...(newColumn !== undefined ? { sprintColumn: newColumn } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) }
      );
    } catch {
      loadTasks();
    }
  };

  const handleSubtaskStatusChange = async (parentTaskId: string, taskId: string, status: string) => {
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $status: String!) {
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
    const task = tasks.find((t) => t.taskId === taskId);

    // Auto-assign if moving to in-progress column and unassigned
    const autoAssign = newStatus === 'in_progress' && task && !task.assigneeId && user ? user.userId : undefined;

    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId
        ? { ...t, sprintColumn, ...(newStatus ? { status: newStatus } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) }
        : t
    ));
    if (selectedTask?.taskId === taskId) {
      setSelectedTask((t) => t ? { ...t, sprintColumn, ...(newStatus ? { status: newStatus } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) } : t);
    }
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $sprintColumn: String${newStatus ? ', $status: String!' : ''}${autoAssign ? ', $assigneeId: ID' : ''}) {
          updateTask(taskId: $taskId, sprintColumn: $sprintColumn${newStatus ? ', status: $status' : ''}${autoAssign ? ', assigneeId: $assigneeId' : ''}) { taskId }
        }`,
        { taskId, sprintColumn, ...(newStatus ? { status: newStatus } : {}), ...(autoAssign ? { assigneeId: autoAssign } : {}) }
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

  // --- Project management ---

  const handleUpdateProject = async (data: { name?: string; description?: string; statuses?: string }) => {
    if (!projectId) return;
    try {
      const result = await gql<{ updateProject: Project }>(
        `mutation UpdateProject($projectId: ID!, $name: String, $description: String, $statuses: String) {
          updateProject(projectId: $projectId, name: $name, description: $description, statuses: $statuses) {
            projectId name description prompt statuses createdAt orgId archived
          }
        }`,
        { projectId, ...data }
      );
      setProject(result.updateProject);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update project');
    }
  };

  // --- Dependencies ---

  const handleUpdateDependencies = async (taskId: string, dependsOnIds: string[]) => {
    const depValue = dependsOnIds.length > 0 ? JSON.stringify(dependsOnIds) : null;
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, dependsOn: depValue } : t));
    if (selectedTask?.taskId === taskId) {
      setSelectedTask((t) => t ? { ...t, dependsOn: depValue } : t);
    }
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $dependsOn: String) {
          updateTask(taskId: $taskId, dependsOn: $dependsOn) { taskId }
        }`,
        { taskId, dependsOn: depValue }
      );
    } catch {
      loadTasks();
    }
  };

  // --- Bulk actions ---

  const handleBulkUpdate = async (taskIds: string[], updates: { status?: string; assigneeId?: string | null; sprintId?: string | null; archived?: boolean }) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) =>
      taskIds.includes(t.taskId) ? { ...t, ...updates } : t
    ));
    try {
      await gql<{ bulkUpdateTasks: Task[] }>(
        `mutation BulkUpdateTasks($taskIds: [ID!]!, $status: String, $assigneeId: ID, $sprintId: ID, $archived: Boolean) {
          bulkUpdateTasks(taskIds: $taskIds, status: $status, assigneeId: $assigneeId, sprintId: $sprintId, archived: $archived) { ${TASK_FIELDS} }
        }`,
        { taskIds, ...updates }
      );
      setSelectedTaskIds(new Set());
    } catch {
      loadTasks();
    }
  };

  const handleArchiveTask = async (taskId: string, archived: boolean) => {
    // Optimistically update
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, archived } : t));
    if (selectedTask?.taskId === taskId) {
      if (archived) setSelectedTask(null);
      else setSelectedTask((t) => t ? { ...t, archived } : t);
    }
    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask($taskId: ID!, $archived: Boolean) {
          updateTask(taskId: $taskId, archived: $archived) { taskId }
        }`,
        { taskId, archived }
      );
    } catch {
      loadTasks();
    }
  };

  // --- Labels ---

  const handleCreateLabel = async (name: string, color: string): Promise<Label | null> => {
    try {
      const data = await gql<{ createLabel: Label }>(
        `mutation CreateLabel($name: String!, $color: String) { createLabel(name: $name, color: $color) { labelId name color } }`,
        { name, color }
      );
      setLabels((prev) => [...prev, data.createLabel].sort((a, b) => a.name.localeCompare(b.name)));
      return data.createLabel;
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create label');
      return null;
    }
  };

  const handleDeleteLabel = async (labelId: string) => {
    try {
      await gql<{ deleteLabel: boolean }>(
        `mutation DeleteLabel($labelId: ID!) { deleteLabel(labelId: $labelId) }`,
        { labelId }
      );
      setLabels((prev) => prev.filter((l) => l.labelId !== labelId));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to delete label');
    }
  };

  const handleAddTaskLabel = async (taskId: string, labelId: string) => {
    const label = labels.find((l) => l.labelId === labelId);
    if (!label) return;
    // Optimistic update
    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId ? { ...t, labels: [...(t.labels ?? []), label] } : t
    ));
    if (selectedTask?.taskId === taskId) {
      setSelectedTask((t) => t ? { ...t, labels: [...(t.labels ?? []), label] } : t);
    }
    try {
      await gql<{ addTaskLabel: Task }>(
        `mutation AddTaskLabel($taskId: ID!, $labelId: ID!) { addTaskLabel(taskId: $taskId, labelId: $labelId) { taskId } }`,
        { taskId, labelId }
      );
    } catch {
      loadTasks();
    }
  };

  const handleRemoveTaskLabel = async (taskId: string, labelId: string) => {
    setTasks((prev) => prev.map((t) =>
      t.taskId === taskId ? { ...t, labels: (t.labels ?? []).filter((l) => l.labelId !== labelId) } : t
    ));
    if (selectedTask?.taskId === taskId) {
      setSelectedTask((t) => t ? { ...t, labels: (t.labels ?? []).filter((l) => l.labelId !== labelId) } : t);
    }
    try {
      await gql<{ removeTaskLabel: Task }>(
        `mutation RemoveTaskLabel($taskId: ID!, $labelId: ID!) { removeTaskLabel(taskId: $taskId, labelId: $labelId) { taskId } }`,
        { taskId, labelId }
      );
    } catch {
      loadTasks();
    }
  };

  // --- Comments ---

  const handleCreateComment = async (taskId: string, content: string, parentCommentId?: string) => {
    try {
      await gql<{ createComment: Comment }>(
        `mutation CreateComment($taskId: ID!, $content: String!, $parentCommentId: ID) {
          createComment(taskId: $taskId, content: $content, parentCommentId: $parentCommentId) {
            commentId taskId userId userEmail parentCommentId content createdAt updatedAt replies { commentId }
          }
        }`,
        { taskId, content, parentCommentId: parentCommentId ?? null }
      );
      // Reload comments for this task
      await loadComments(taskId);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create comment');
    }
  };

  const handleUpdateComment = async (commentId: string, content: string) => {
    try {
      await gql<{ updateComment: Comment }>(
        `mutation UpdateComment($commentId: ID!, $content: String!) {
          updateComment(commentId: $commentId, content: $content) { commentId content updatedAt }
        }`,
        { commentId, content }
      );
      if (selectedTask) await loadComments(selectedTask.taskId);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update comment');
    }
  };

  const handleDeleteComment = async (commentId: string, taskId: string) => {
    try {
      await gql<{ deleteComment: boolean }>(
        `mutation DeleteComment($commentId: ID!) { deleteComment(commentId: $commentId) }`,
        { commentId }
      );
      await loadComments(taskId);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to delete comment');
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

  const handleGenerateCode = async (task: Task) => {
    const controller = new AbortController();
    abortRef.current = controller;
    setGeneratingCode(task.taskId);
    try {
      const data = await gql<{ generateCodeFromTask: { files: Array<{ path: string; content: string; language: string; description: string }>; summary: string; estimatedTokensUsed: number } }>(
        `mutation($taskId: ID!) { generateCodeFromTask(taskId: $taskId) { files { path content language description } summary estimatedTokensUsed } }`,
        { taskId: task.taskId },
        controller.signal
      );
      setGeneratedCode(data.generateCodeFromTask);
    } catch (err: unknown) {
      if ((err as Error).name !== 'AbortError') {
        setErr((err as Error).message || 'Code generation failed');
      }
    } finally {
      setGeneratingCode(null);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  const handleCreatePR = async (files: Array<{ path: string; content: string }>) => {
    if (!selectedTask || !projectId) return;
    setCreatingPR(true);
    try {
      await gql(
        `mutation($projectId: ID!, $taskId: ID!, $files: [GitHubFileInput!]!) { createPullRequestFromTask(projectId: $projectId, taskId: $taskId, files: $files) { url number } }`,
        { projectId, taskId: selectedTask.taskId, files }
      );
      setErr(null);
      setGeneratedCode(null);
    } catch (err: unknown) {
      setErr((err as Error).message || 'Failed to create PR');
    } finally {
      setCreatingPR(false);
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

  const handleUpdateTask = async (taskId: string, updates: { description?: string; instructions?: string }) => {
    const mutationParts: string[] = ['$taskId: ID!'];
    const vars: Record<string, unknown> = { taskId };
    if (updates.description !== undefined) { mutationParts.push('$description: String'); vars.description = updates.description; }
    if (updates.instructions !== undefined) { mutationParts.push('$instructions: String'); vars.instructions = updates.instructions; }

    const argsPart = Object.keys(updates).map((k) => `${k}: $${k}`).join(', ');

    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, ...updates } : t));
    if (selectedTask?.taskId === taskId) setSelectedTask((t) => t ? { ...t, ...updates } : t);

    try {
      await gql<{ updateTask: Task }>(
        `mutation UpdateTask(${mutationParts.join(', ')}) { updateTask(taskId: $taskId, ${argsPart}) { taskId } }`,
        vars
      );
    } catch {
      loadTasks();
    }
  };

  const selectTask = (task: Task) => {
    setSelectedTask(task);
    loadSubtasks(task.taskId);
    loadComments(task.taskId);
    loadTaskActivities(task.taskId);
  };

  // --- Computed ---

  const activeSprint = sprints.find((s) => s.isActive);
  const rootTasks = tasks.filter((t) => !t.parentTaskId);

  return {
    projectId,
    project, tasks, hasMore, loading, err, selectedTask, subtasks, sprints, orgUsers, labels,
    previewTasks, previewLoading, previewError, committing, summary, summarizing,
    generatingInstructions, generatingCode, generatedCode, creatingPR,
    isGenerating, view, editingTitle, editTitleValue,
    showAddForm, newTaskTitle, addErr, showSprintModal, editingSprint,
    showSprintPlanModal, closeSprintId, comments, taskActivities, dashboardStats,
    selectedTaskIds, projectStatuses,
    loadTasks, loadMoreTasks, selectTask,
    handleStatusChange, handleSubtaskStatusChange, handleSprintColumnChange,
    handleAssignSprint, handleAssignUser, handleDueDateChange, handleReorderTask,
    handleActivateSprint, handleCreateSprint, handleSprintPlanCreated,
    handleSprintClosed, handleSprintUpdated, handleDeleteSprint,
    openPreview, handleCommitPlan, handleSummarize, handleGenerateInstructions, handleGenerateCode, handleCreatePR,
    handleAddTask, startEditTitle, handleTitleSave, handleUpdateTask, switchView,
    handleUpdateProject, handleUpdateDependencies, handleBulkUpdate, handleArchiveTask,
    handleCreateLabel, handleDeleteLabel, handleAddTaskLabel, handleRemoveTaskLabel,
    handleCreateComment, handleUpdateComment, handleDeleteComment,
    loadDashboardStats,
    setSelectedTask, setErr, setSummary, setPreviewTasks, setPreviewError,
    setShowAddForm, setNewTaskTitle, setEditTitleValue, setEditingTitle,
    setShowSprintModal, setEditingSprint, setShowSprintPlanModal, setCloseSprintId,
    setGeneratedCode, setSelectedTaskIds,
    activeSprint, rootTasks,
    titleEditRef, abortRef,
  };
}
