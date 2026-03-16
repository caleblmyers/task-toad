import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { gql } from '../api/client';
import { useAuth } from '../auth/context';
import { PROJECT_QUERY, ORG_USERS_QUERY, PROJECT_STATS_QUERY, UPDATE_PROJECT_MUTATION } from '../api/queries';
import { useTaskCRUD } from './useTaskCRUD';
import { useSprintManagement } from './useSprintManagement';
import { useAIGeneration } from './useAIGeneration';
import type { Task, TaskPlanPreview, Sprint, OrgUser, CloseSprintResult, Project, Comment, Activity, ProjectStats, Label } from '../types';

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
  handleRegenerateFile: (taskId: string, filePath: string, feedback?: string) => Promise<{ path: string; content: string; language: string; description: string } | null>;
  handleCreatePR: (files: Array<{ path: string; content: string }>) => Promise<void>;
  handleAddTask: (e: React.FormEvent) => Promise<void>;
  startEditTitle: (task: Task) => void;
  handleTitleSave: () => Promise<void>;
  handleUpdateTask: (taskId: string, updates: { description?: string; instructions?: string; acceptanceCriteria?: string; storyPoints?: number | null }) => Promise<void>;
  switchView: (v: 'backlog' | 'board' | 'dashboard' | 'table' | 'calendar') => void;
  handleUpdateProject: (data: { name?: string; description?: string; prompt?: string; knowledgeBase?: string; statuses?: string }) => Promise<void>;
  handleUpdateDependencies: (taskId: string, dependsOnIds: string[]) => Promise<void>;
  handleBulkUpdate: (taskIds: string[], updates: { status?: string; assigneeId?: string | null; sprintId?: string | null; archived?: boolean }) => Promise<void>;
  handleArchiveTask: (taskId: string, archived: boolean) => Promise<void>;
  handleBulkCreateTasks: (tasks: Array<{ title: string; description?: string; status?: string; priority?: string }>, onProgress?: (current: number, total: number) => void) => Promise<void>;
  handleCreateSubtask: (parentTaskId: string, title: string) => Promise<void>;
  handleCreateLabel: (name: string, color: string) => Promise<Label | null>;
  handleDeleteLabel: (labelId: string) => Promise<void>;
  handleAddTaskLabel: (taskId: string, labelId: string) => Promise<void>;
  handleRemoveTaskLabel: (taskId: string, labelId: string) => Promise<void>;
  handleCreateComment: (taskId: string, content: string, parentCommentId?: string) => Promise<void>;
  handleUpdateComment: (commentId: string, content: string) => Promise<void>;
  handleDeleteComment: (commentId: string, taskId: string) => Promise<void>;
  handleParseBugReport: (bugReport: string) => Promise<void>;
  handlePreviewPRD: (prd: string) => Promise<{ epics: Array<{ title: string; description: string; tasks: Array<{ title: string; description: string; priority: string; estimatedHours?: number | null; acceptanceCriteria?: string | null }> }> }>;
  handleCommitPRD: (epics: string) => Promise<void>;
  handleBootstrapFromRepo: () => Promise<void>;
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

  // ── Project state ──
  const [project, setProject] = useState<Project | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [dashboardStats, setDashboardStats] = useState<ProjectStats | null>(null);

  const stored = localStorage.getItem(VIEW_KEY);
  const validViews = ['backlog', 'board', 'dashboard', 'table', 'calendar'];
  const [view, setView] = useState<'backlog' | 'board' | 'dashboard' | 'table' | 'calendar'>(
    validViews.includes(stored ?? '') ? (stored as 'backlog' | 'board' | 'dashboard' | 'table' | 'calendar') : 'backlog'
  );

  const autoPreviewFiredRef = useRef(false);

  const projectStatuses: string[] = useMemo(() => {
    if (!project) return ['todo', 'in_progress', 'done'];
    try { return JSON.parse(project.statuses) as string[]; } catch { return ['todo', 'in_progress', 'done']; }
  }, [project]);

  // ── Refs for cross-hook communication (breaks circular init dependency) ──
  const taskCrudRef = useRef<ReturnType<typeof useTaskCRUD>>(null!);

  // ── Compose sub-hooks ──
  // sprintMgmt needs setTasks/setErr from taskCrud, but taskCrud needs sprints from sprintMgmt.
  // We use refs so callbacks can access taskCrud without initialization-order issues.
  const sprintMgmt = useSprintManagement({
    projectId,
    onTasksChanged: (updater) => taskCrudRef.current.setTasks((prev) => updater(prev)),
    setErr: (e) => taskCrudRef.current.setErr(e),
  });

  const taskCrud = useTaskCRUD({
    projectId,
    userId: user?.userId,
    sprints: sprintMgmt.sprints,
  });
  taskCrudRef.current = taskCrud;

  const ai = useAIGeneration({
    projectId,
    setTasks: taskCrud.setTasks,
    setSubtasks: taskCrud.setSubtasks,
    setSelectedTask: taskCrud.setSelectedTask,
    selectedTask: taskCrud.selectedTask,
    setErr: (e) => taskCrud.setErr(e),
    loadTasks: taskCrud.loadTasks,
    loadSubtasks: taskCrud.loadSubtasks,
  });

  // ── Project data loading ──

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await gql<{ project: Project | null }>(PROJECT_QUERY, { projectId });
      if (data.project) setProject(data.project);
    } catch {
      // ignore
    }
  }, [projectId]);

  const loadOrgUsers = useCallback(async () => {
    try {
      const data = await gql<{ orgUsers: OrgUser[] }>(ORG_USERS_QUERY);
      setOrgUsers(data.orgUsers);
    } catch {
      // ignore
    }
  }, []);

  const loadDashboardStats = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await gql<{ projectStats: ProjectStats }>(PROJECT_STATS_QUERY, { projectId });
      setDashboardStats(data.projectStats);
    } catch {
      // ignore
    }
  }, [projectId]);

  const handleUpdateProject = useCallback(async (data: { name?: string; description?: string; prompt?: string; knowledgeBase?: string; statuses?: string }) => {
    if (!projectId) return;
    try {
      const result = await gql<{ updateProject: Project }>(UPDATE_PROJECT_MUTATION, { projectId, ...data });
      setProject(result.updateProject);
    } catch (error) {
      taskCrudRef.current.setErr(error instanceof Error ? error.message : 'Failed to update project');
    }
  }, [projectId]);

  const switchView = useCallback((v: 'backlog' | 'board' | 'dashboard' | 'table' | 'calendar') => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
    if (v === 'dashboard') loadDashboardStats();
  }, [loadDashboardStats]);

  // ── Lifecycle effects ──

  // Load all data on project change
  useEffect(() => {
    Promise.all([loadProject(), taskCrud.loadTasks(), sprintMgmt.loadSprints(), loadOrgUsers(), taskCrud.loadLabels()]).then(([, loadedTasks]) => {
      if (locationState?.autoPreview && loadedTasks.length === 0 && !autoPreviewFiredRef.current) {
        autoPreviewFiredRef.current = true;
        navigate(location.pathname, { replace: true, state: {} });
        ai.openPreview();
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Block browser tab close during generation
  useEffect(() => {
    if (!ai.isGenerating) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [ai.isGenerating]);

  // Intercept browser back/forward during generation
  const isGeneratingRef = useRef(false);
  isGeneratingRef.current = ai.isGenerating;

  useEffect(() => {
    if (!ai.isGenerating) return;
    window.history.pushState(null, '', window.location.href);
    const handlePopState = () => {
      if (!isGeneratingRef.current) return;
      const leave = window.confirm(
        'An AI generation is in progress. If you leave, the request will be cancelled.\n\nAre you sure you want to leave?'
      );
      if (leave) {
        ai.abortRef.current?.abort();
        ai.abortRef.current = null;
        window.history.back();
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [ai.isGenerating, ai.abortRef]);

  // Cleanup abort controller on unmount
  useEffect(() => {
    return () => { ai.abortRef.current?.abort(); };
  }, [ai.abortRef]);

  // ── Wrap handleSprintClosed to pass loadTasks ──
  const handleSprintClosed = useCallback((result: CloseSprintResult) => {
    sprintMgmt.handleSprintClosed(result, taskCrud.loadTasks);
  }, [sprintMgmt.handleSprintClosed, taskCrud.loadTasks]);

  // ── Return unified interface ──
  return {
    projectId,
    project,
    tasks: taskCrud.tasks,
    hasMore: taskCrud.hasMore,
    loading: taskCrud.loading,
    err: taskCrud.err,
    selectedTask: taskCrud.selectedTask,
    subtasks: taskCrud.subtasks,
    sprints: sprintMgmt.sprints,
    orgUsers,
    labels: taskCrud.labels,
    previewTasks: ai.previewTasks,
    previewLoading: ai.previewLoading,
    previewError: ai.previewError,
    committing: ai.committing,
    summary: ai.summary,
    summarizing: ai.summarizing,
    generatingInstructions: ai.generatingInstructions,
    generatingCode: ai.generatingCode,
    generatedCode: ai.generatedCode,
    creatingPR: ai.creatingPR,
    isGenerating: ai.isGenerating,
    view,
    editingTitle: taskCrud.editingTitle,
    editTitleValue: taskCrud.editTitleValue,
    showAddForm: taskCrud.showAddForm,
    newTaskTitle: taskCrud.newTaskTitle,
    addErr: taskCrud.addErr,
    showSprintModal: sprintMgmt.showSprintModal,
    editingSprint: sprintMgmt.editingSprint,
    showSprintPlanModal: sprintMgmt.showSprintPlanModal,
    closeSprintId: sprintMgmt.closeSprintId,
    comments: taskCrud.comments,
    taskActivities: taskCrud.taskActivities,
    dashboardStats,
    selectedTaskIds: taskCrud.selectedTaskIds,
    projectStatuses,

    // Actions
    loadTasks: taskCrud.loadTasks,
    loadMoreTasks: taskCrud.loadMoreTasks,
    selectTask: taskCrud.selectTask,
    handleStatusChange: taskCrud.handleStatusChange,
    handleSubtaskStatusChange: taskCrud.handleSubtaskStatusChange,
    handleSprintColumnChange: taskCrud.handleSprintColumnChange,
    handleAssignSprint: taskCrud.handleAssignSprint,
    handleAssignUser: taskCrud.handleAssignUser,
    handleDueDateChange: taskCrud.handleDueDateChange,
    handleReorderTask: taskCrud.handleReorderTask,
    handleActivateSprint: sprintMgmt.handleActivateSprint,
    handleCreateSprint: sprintMgmt.handleCreateSprint,
    handleSprintPlanCreated: sprintMgmt.handleSprintPlanCreated,
    handleSprintClosed,
    handleSprintUpdated: sprintMgmt.handleSprintUpdated,
    handleDeleteSprint: sprintMgmt.handleDeleteSprint,
    openPreview: ai.openPreview,
    handleCommitPlan: ai.handleCommitPlan,
    handleSummarize: ai.handleSummarize,
    handleGenerateInstructions: ai.handleGenerateInstructions,
    handleGenerateCode: ai.handleGenerateCode,
    handleRegenerateFile: ai.handleRegenerateFile,
    handleCreatePR: ai.handleCreatePR,
    handleAddTask: taskCrud.handleAddTask,
    startEditTitle: taskCrud.startEditTitle,
    handleTitleSave: taskCrud.handleTitleSave,
    handleUpdateTask: taskCrud.handleUpdateTask,
    switchView,
    handleUpdateProject,
    handleUpdateDependencies: taskCrud.handleUpdateDependencies,
    handleBulkUpdate: taskCrud.handleBulkUpdate,
    handleArchiveTask: taskCrud.handleArchiveTask,
    handleBulkCreateTasks: taskCrud.handleBulkCreateTasks,
    handleCreateSubtask: taskCrud.handleCreateSubtask,
    handleCreateLabel: taskCrud.handleCreateLabel,
    handleDeleteLabel: taskCrud.handleDeleteLabel,
    handleAddTaskLabel: taskCrud.handleAddTaskLabel,
    handleRemoveTaskLabel: taskCrud.handleRemoveTaskLabel,
    handleCreateComment: taskCrud.handleCreateComment,
    handleUpdateComment: taskCrud.handleUpdateComment,
    handleDeleteComment: taskCrud.handleDeleteComment,
    handleParseBugReport: ai.handleParseBugReport,
    handlePreviewPRD: ai.handlePreviewPRD,
    handleCommitPRD: ai.handleCommitPRD,
    handleBootstrapFromRepo: ai.handleBootstrapFromRepo,
    loadDashboardStats,

    // State setters (backwards compat)
    setSelectedTask: taskCrud.setSelectedTask,
    setErr: taskCrud.setErr,
    setSummary: ai.setSummary,
    setPreviewTasks: ai.setPreviewTasks,
    setPreviewError: ai.setPreviewError,
    setShowAddForm: taskCrud.setShowAddForm,
    setNewTaskTitle: taskCrud.setNewTaskTitle,
    setEditTitleValue: taskCrud.setEditTitleValue,
    setEditingTitle: taskCrud.setEditingTitle,
    setShowSprintModal: sprintMgmt.setShowSprintModal,
    setEditingSprint: sprintMgmt.setEditingSprint,
    setShowSprintPlanModal: sprintMgmt.setShowSprintPlanModal,
    setCloseSprintId: sprintMgmt.setCloseSprintId,
    setGeneratedCode: ai.setGeneratedCode,
    setSelectedTaskIds: taskCrud.setSelectedTaskIds,

    // Computed
    activeSprint: sprintMgmt.activeSprint,
    rootTasks: taskCrud.rootTasks,

    // Refs
    titleEditRef: taskCrud.titleEditRef,
    abortRef: ai.abortRef,
  };
}
