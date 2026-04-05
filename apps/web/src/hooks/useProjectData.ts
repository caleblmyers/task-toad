import { useCallback, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { gql } from '../api/client';
import { useAuth } from '../auth/context';
import { useTaskCRUD } from './useTaskCRUD';
import { useSprintManagement } from './useSprintManagement';
import { useAIGeneration } from './useAIGeneration';
import { useProjectState } from './useProjectState';
import { useReleaseManagement } from './useReleaseManagement';
import { useProjectEffects } from './useProjectEffects';
import { usePermissions } from './usePermissions';
import type { Task, TaskPlanPreview, Sprint, OrgUser, CloseSprintResult, Project, Comment, Activity, ProjectStats, Label, Epic, ActionPlanPreview, TaskActionPlan, Release } from '../types';
import type { TaskFilterInput } from './useTaskFiltering';

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
  isGenerating: boolean;
  epics: Epic[];
  epicMap: Map<string, string>;
  view: 'autopilot' | 'backlog' | 'board' | 'dashboard' | 'table' | 'calendar' | 'epics' | 'releases' | 'timesheet';
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
  loadTasks: (filter?: TaskFilterInput) => Promise<Task[]>;
  loadMoreTasks: () => Promise<void>;
  selectTask: (task: Task) => void;
  handleStatusChange: (taskId: string, status: string) => Promise<void>;
  handleSubtaskStatusChange: (parentTaskId: string, taskId: string, status: string) => Promise<void>;
  handleSprintColumnChange: (taskId: string, sprintColumn: string) => Promise<void>;
  handleAssignSprint: (taskId: string, sprintId: string | null) => Promise<void>;
  handleAssignUser: (taskId: string, assigneeId: string | null) => Promise<void>;
  handleDueDateChange: (taskId: string, dueDate: string | null) => Promise<void>;
  handleReorderTask: (taskId: string, beforeTaskId: string | null, afterTaskId: string | null, targetSprintId: string | null) => Promise<void>;
  handleKanbanReorderTask: (taskId: string, position: number) => Promise<void>;
  handleReorderColumns: (newColumns: string[]) => Promise<void>;
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
  handleUpdateTask: (taskId: string, updates: { description?: string; instructions?: string; acceptanceCriteria?: string; storyPoints?: number | null }) => Promise<void>;
  switchView: (v: 'autopilot' | 'backlog' | 'board' | 'dashboard' | 'table' | 'calendar' | 'epics' | 'releases' | 'timesheet') => void;
  handleUpdateProject: (data: { name?: string; description?: string; prompt?: string; knowledgeBase?: string; statuses?: string }) => Promise<void>;
  handleRefreshRepoProfile: () => Promise<void>;
  handleAddDependency: (sourceTaskId: string, targetTaskId: string, linkType: string) => Promise<void>;
  handleRemoveDependency: (taskDependencyId: string) => Promise<void>;
  handleBulkUpdate: (taskIds: string[], updates: { status?: string; assigneeId?: string | null; sprintId?: string | null; archived?: boolean }) => Promise<void>;
  handleArchiveTask: (taskId: string, archived: boolean) => Promise<void>;
  handleBulkCreateTasks: (tasks: Array<{ title: string; description?: string; status?: string; priority?: string }>, onProgress?: (current: number, total: number) => void) => Promise<void>;
  handleCreateSubtask: (parentTaskId: string, title: string) => Promise<void>;
  handleCreateLabel: (name: string, color: string) => Promise<Label | null>;
  handleDeleteLabel: (labelId: string) => Promise<void>;
  handleAddTaskLabel: (taskId: string, labelId: string) => Promise<void>;
  handleRemoveTaskLabel: (taskId: string, labelId: string) => Promise<void>;
  handleAddWatcher: (taskId: string, userId: string) => Promise<void>;
  handleRemoveWatcher: (taskId: string, userId: string) => Promise<void>;
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
  setSelectedTaskIds: React.Dispatch<React.SetStateAction<Set<string>>>;

  // Releases
  releases: Release[];
  selectedRelease: Release | null;
  showReleaseCreateModal: boolean;
  releasesLoading: boolean;
  loadReleases: () => Promise<void>;
  createRelease: (args: { name: string; version: string; description?: string; releaseDate?: string }) => Promise<void>;
  updateRelease: (releaseId: string, updates: Partial<Pick<Release, 'name' | 'version' | 'description' | 'status' | 'releaseDate' | 'releaseNotes'>>) => Promise<void>;
  deleteRelease: (releaseId: string) => Promise<void>;
  addTaskToRelease: (releaseId: string, task: Task) => Promise<void>;
  removeTaskFromRelease: (releaseId: string, taskId: string) => Promise<void>;
  generateReleaseNotes: (releaseId: string) => Promise<void>;
  setSelectedRelease: React.Dispatch<React.SetStateAction<Release | null>>;
  setShowReleaseCreateModal: React.Dispatch<React.SetStateAction<boolean>>;

  // Action plan
  actionPlanPreview: ActionPlanPreview | null;
  actionPlanPreviewLoading: boolean;
  loadingMessage: string | null;
  actionPlan: TaskActionPlan | null;
  isProjectBusy: boolean;
  handlePreviewActionPlan: (task: Task) => Promise<void>;
  handleCommitActionPlan: (taskId: string, actions: Array<{ actionType: string; label: string; config: string; requiresApproval: boolean }>) => Promise<TaskActionPlan | null>;
  handleExecuteActionPlan: (planId: string) => Promise<TaskActionPlan | null>;
  handleCompleteManualAction: (actionId: string) => Promise<void>;
  handleSkipAction: (actionId: string) => Promise<void>;
  handleRetryAction: (actionId: string) => Promise<void>;
  handleCancelActionPlan: (planId: string) => Promise<void>;
  loadActionPlan: (taskId: string) => Promise<void>;
  checkProjectBusy: () => Promise<void>;
  setActionPlanPreview: React.Dispatch<React.SetStateAction<ActionPlanPreview | null>>;
  setActionPlan: React.Dispatch<React.SetStateAction<TaskActionPlan | null>>;

  // Computed
  activeSprint: Sprint | undefined;
  rootTasks: Task[];

  // Permissions
  permissions: string[];
  can: (permission: string) => boolean;
  permissionsLoading: boolean;

  // Refs
  titleEditRef: React.RefObject<HTMLInputElement>;
  abortRef: React.MutableRefObject<AbortController | null>;

  // Confirm dialog portal (for nav-away confirmation)
  ConfirmDialogPortal: () => JSX.Element | null;
}

export function useProjectData(): ProjectData {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();

  // ── Refs for cross-hook communication ──
  const taskCrudRef = useRef<ReturnType<typeof useTaskCRUD>>(null!);

  // ── Compose sub-hooks ──
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

  const projectState = useProjectState({
    projectId,
    setErr: (e) => taskCrud.setErr(e),
  });

  const permissionData = usePermissions(projectId);

  const releaseMgmt = useReleaseManagement({
    projectId,
    setErr: (e) => taskCrud.setErr(e),
  });

  const ai = useAIGeneration({
    projectId,
    setTasks: taskCrud.setTasks,
    setSubtasks: taskCrud.setSubtasks,
    setSelectedTask: taskCrud.setSelectedTask,
    setErr: (e) => taskCrud.setErr(e),
    loadTasks: taskCrud.loadTasks,
    loadSubtasks: taskCrud.loadSubtasks,
  });

  // ── Effects ──
  const loadAll = useCallback(async () => {
    const results = await Promise.all([
      projectState.loadProject(), taskCrud.loadTasks(), sprintMgmt.loadSprints(),
      projectState.loadOrgUsers(), taskCrud.loadLabels(), projectState.loadEpics(),
      releaseMgmt.loadReleases(),
    ]);
    return results[1]; // loadTasks result
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Default to backlog view when project has no sprints (initial load only)
  // Track that sprint data has loaded (no longer forces view switch — autopilot is always valid)
  const sprintCheckDone = useRef(false);
  useEffect(() => {
    if (sprintCheckDone.current) return;
    if (projectState.project) {
      sprintCheckDone.current = true;
    }
  }, [projectState.project]);

  const { ConfirmDialogPortal } = useProjectEffects({
    projectId,
    isGenerating: ai.isGenerating,
    abortRef: ai.abortRef,
    loadAll: async () => { await loadAll(); },
    autoPreviewCheck: () => true, // The effect itself handles task count check
    onAutoPreview: () => ai.openPreview(),
  });

  // ── Wrapped handlers ──
  const handleSprintClosed = useCallback((result: CloseSprintResult) => {
    sprintMgmt.handleSprintClosed(result, taskCrud.loadTasks);
  }, [sprintMgmt.handleSprintClosed, taskCrud.loadTasks]);

  const handleCommitPlan = useCallback(async (selectedTasks: TaskPlanPreview[]) => {
    await ai.handleCommitPlan(selectedTasks);
    projectState.loadEpics();
  }, [ai.handleCommitPlan, projectState.loadEpics]);

  const handleCommitPRD = useCallback(async (epics: string) => {
    await ai.handleCommitPRD(epics);
    projectState.loadEpics();
  }, [ai.handleCommitPRD, projectState.loadEpics]);

  const handleBootstrapFromRepo = useCallback(async () => {
    await ai.handleBootstrapFromRepo();
    projectState.loadEpics();
  }, [ai.handleBootstrapFromRepo, projectState.loadEpics]);

  const handleKanbanReorderTask = useCallback(async (taskId: string, position: number) => {
    taskCrud.setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, position } : t));
    taskCrud.setSelectedTask((t) => t?.taskId === taskId ? { ...t, position } : t);
    try {
      await gql<{ reorderTask: { taskId: string } }>(
        `mutation ReorderTask($taskId: ID!, $position: Float!) { reorderTask(taskId: $taskId, position: $position) { taskId } }`,
        { taskId, position },
      );
    } catch {
      taskCrud.loadTasks();
    }
  }, [taskCrud]);

  // ── Return unified interface ──
  return {
    projectId,
    project: projectState.project,
    tasks: taskCrud.tasks, hasMore: taskCrud.hasMore, loading: taskCrud.loading,
    err: taskCrud.err, selectedTask: taskCrud.selectedTask, subtasks: taskCrud.subtasks,
    sprints: sprintMgmt.sprints, orgUsers: projectState.orgUsers, labels: taskCrud.labels,
    epics: projectState.epics, epicMap: projectState.epicMap,
    previewTasks: ai.previewTasks, previewLoading: ai.previewLoading,
    previewError: ai.previewError, committing: ai.committing,
    summary: ai.summary, summarizing: ai.summarizing,
    generatingInstructions: ai.generatingInstructions, isGenerating: ai.isGenerating,
    view: projectState.view,
    editingTitle: taskCrud.editingTitle, editTitleValue: taskCrud.editTitleValue,
    showAddForm: taskCrud.showAddForm, newTaskTitle: taskCrud.newTaskTitle,
    addErr: taskCrud.addErr,
    showSprintModal: sprintMgmt.showSprintModal, editingSprint: sprintMgmt.editingSprint,
    showSprintPlanModal: sprintMgmt.showSprintPlanModal, closeSprintId: sprintMgmt.closeSprintId,
    comments: taskCrud.comments, taskActivities: taskCrud.taskActivities,
    dashboardStats: projectState.dashboardStats,
    selectedTaskIds: taskCrud.selectedTaskIds, projectStatuses: projectState.projectStatuses,

    // Actions
    loadTasks: taskCrud.loadTasks, loadMoreTasks: taskCrud.loadMoreTasks,
    selectTask: taskCrud.selectTask,
    handleStatusChange: taskCrud.handleStatusChange,
    handleSubtaskStatusChange: taskCrud.handleSubtaskStatusChange,
    handleSprintColumnChange: taskCrud.handleSprintColumnChange,
    handleAssignSprint: taskCrud.handleAssignSprint, handleAssignUser: taskCrud.handleAssignUser,
    handleDueDateChange: taskCrud.handleDueDateChange, handleReorderTask: taskCrud.handleReorderTask,
    handleKanbanReorderTask,
    handleReorderColumns: sprintMgmt.handleReorderColumns,
    handleActivateSprint: sprintMgmt.handleActivateSprint,
    handleCreateSprint: sprintMgmt.handleCreateSprint,
    handleSprintPlanCreated: sprintMgmt.handleSprintPlanCreated,
    handleSprintClosed, handleSprintUpdated: sprintMgmt.handleSprintUpdated,
    handleDeleteSprint: sprintMgmt.handleDeleteSprint,
    openPreview: ai.openPreview, handleCommitPlan, handleSummarize: ai.handleSummarize,
    handleGenerateInstructions: ai.handleGenerateInstructions,
    handleAddTask: taskCrud.handleAddTask, startEditTitle: taskCrud.startEditTitle,
    handleTitleSave: taskCrud.handleTitleSave, handleUpdateTask: taskCrud.handleUpdateTask,
    switchView: projectState.switchView,
    handleUpdateProject: projectState.handleUpdateProject,
    handleRefreshRepoProfile: projectState.handleRefreshRepoProfile,
    handleAddDependency: taskCrud.handleAddDependency,
    handleRemoveDependency: taskCrud.handleRemoveDependency,
    handleBulkUpdate: taskCrud.handleBulkUpdate, handleArchiveTask: taskCrud.handleArchiveTask,
    handleBulkCreateTasks: taskCrud.handleBulkCreateTasks,
    handleCreateSubtask: taskCrud.handleCreateSubtask,
    handleCreateLabel: taskCrud.handleCreateLabel, handleDeleteLabel: taskCrud.handleDeleteLabel,
    handleAddTaskLabel: taskCrud.handleAddTaskLabel, handleRemoveTaskLabel: taskCrud.handleRemoveTaskLabel,
    handleAddWatcher: taskCrud.handleAddWatcher, handleRemoveWatcher: taskCrud.handleRemoveWatcher,
    handleCreateComment: taskCrud.handleCreateComment, handleUpdateComment: taskCrud.handleUpdateComment,
    handleDeleteComment: taskCrud.handleDeleteComment,
    handleParseBugReport: ai.handleParseBugReport, handlePreviewPRD: ai.handlePreviewPRD,
    handleCommitPRD, handleBootstrapFromRepo, loadDashboardStats: projectState.loadDashboardStats,

    // State setters
    setSelectedTask: taskCrud.setSelectedTask, setErr: taskCrud.setErr,
    setSummary: ai.setSummary, setPreviewTasks: ai.setPreviewTasks,
    setPreviewError: ai.setPreviewError,
    setShowAddForm: taskCrud.setShowAddForm, setNewTaskTitle: taskCrud.setNewTaskTitle,
    setEditTitleValue: taskCrud.setEditTitleValue, setEditingTitle: taskCrud.setEditingTitle,
    setShowSprintModal: sprintMgmt.setShowSprintModal, setEditingSprint: sprintMgmt.setEditingSprint,
    setShowSprintPlanModal: sprintMgmt.setShowSprintPlanModal, setCloseSprintId: sprintMgmt.setCloseSprintId,
    setSelectedTaskIds: taskCrud.setSelectedTaskIds,

    // Releases
    releases: releaseMgmt.releases,
    selectedRelease: releaseMgmt.selectedRelease,
    showReleaseCreateModal: releaseMgmt.showCreateModal,
    releasesLoading: releaseMgmt.loading,
    loadReleases: releaseMgmt.loadReleases,
    createRelease: releaseMgmt.createRelease,
    updateRelease: releaseMgmt.updateRelease,
    deleteRelease: releaseMgmt.deleteRelease,
    addTaskToRelease: releaseMgmt.addTaskToRelease,
    removeTaskFromRelease: releaseMgmt.removeTaskFromRelease,
    generateReleaseNotes: releaseMgmt.generateReleaseNotes,
    setSelectedRelease: releaseMgmt.setSelectedRelease,
    setShowReleaseCreateModal: releaseMgmt.setShowCreateModal,

    // Action plan
    actionPlanPreview: ai.actionPlanPreview, actionPlanPreviewLoading: ai.actionPlanPreviewLoading, loadingMessage: ai.loadingMessage,
    actionPlan: ai.actionPlan, isProjectBusy: ai.isProjectBusy,
    handlePreviewActionPlan: ai.handlePreviewActionPlan,
    handleCommitActionPlan: ai.handleCommitActionPlan,
    handleExecuteActionPlan: ai.handleExecuteActionPlan,
    handleCompleteManualAction: ai.handleCompleteManualAction,
    handleSkipAction: ai.handleSkipAction, handleRetryAction: ai.handleRetryAction,
    handleCancelActionPlan: ai.handleCancelActionPlan, loadActionPlan: ai.loadActionPlan, checkProjectBusy: ai.checkProjectBusy,
    setActionPlanPreview: ai.setActionPlanPreview, setActionPlan: ai.setActionPlan,

    // Permissions
    permissions: permissionData.permissions,
    can: permissionData.can,
    permissionsLoading: permissionData.loading,

    // Computed
    activeSprint: sprintMgmt.activeSprint, rootTasks: taskCrud.rootTasks,

    // Refs
    titleEditRef: taskCrud.titleEditRef, abortRef: ai.abortRef,
    ConfirmDialogPortal,
  };
}
