import { useRef, useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useLocation } from 'react-router-dom';
import { useProjectData } from '../hooks/useProjectData';
import { useTaskFiltering } from '../hooks/useTaskFiltering';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../hooks/useToast';
import { useTimeTracking } from '../hooks/useTimeTracking';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import { GITHUB_PROJECT_REPO_QUERY, GITHUB_INSTALLATIONS_QUERY, PROJECT_ACTIVITIES_QUERY, SAVE_AS_TEMPLATE_MUTATION } from '../api/queries';
import { useSSEListener } from '../hooks/useEventSource';
import { PermissionProvider } from '../hooks/PermissionContext';
import type { Activity, GitHubRepoLink, GitHubInstallation } from '../types';
import KanbanBoard from '../components/KanbanBoard';
import TaskDetailPanel from '../components/TaskDetailPanel';
import BacklogView from '../components/BacklogView';
import EpicsView from '../components/EpicsView';
import TableView from '../components/TableView';
import CalendarView from '../components/CalendarView';
import BulkActionBar from '../components/BulkActionBar';
import ProjectDashboard from '../components/ProjectDashboard';
import ProjectToolbar from '../components/ProjectToolbar';
import { lazyWithRetry } from '../utils/lazyWithRetry';

// Lazy-load heavy modals — only rendered on user action
const GanttChart = lazyWithRetry(() => import('../components/GanttChart'));
const TaskPlanApprovalDialog = lazyWithRetry(() => import('../components/TaskPlanApprovalDialog'));
const CloseSprintModal = lazyWithRetry(() => import('../components/CloseSprintModal'));
const ProjectSettingsModal = lazyWithRetry(() => import('../components/ProjectSettingsModal'));
const SprintCreateModal = lazyWithRetry(() => import('../components/SprintCreateModal'));
const SprintPlanModal = lazyWithRetry(() => import('../components/SprintPlanModal'));
const GitHubRepoModal = lazyWithRetry(() => import('../components/GitHubRepoModal'));
const CycleTimePanel = lazyWithRetry(() => import('../components/CycleTimePanel'));
const StandupReportPanel = lazyWithRetry(() => import('../components/StandupReportPanel'));
const ProjectHealthPanel = lazyWithRetry(() => import('../components/ProjectHealthPanel'));
const TrendAnalysisPanel = lazyWithRetry(() => import('../components/TrendAnalysisPanel'));
const MeetingNotesDialog = lazyWithRetry(() => import('../components/MeetingNotesDialog'));
const CSVImportModal = lazyWithRetry(() => import('../components/CSVImportModal'));
const KnowledgeBasePanel = lazyWithRetry(() => import('../components/KnowledgeBasePanel'));
const ProjectSetupWizard = lazyWithRetry(() => import('../components/ProjectSetupWizard'));
const BugReportModal = lazyWithRetry(() => import('../components/BugReportModal'));
const PRDBreakdownModal = lazyWithRetry(() => import('../components/PRDBreakdownModal'));
const HierarchicalPlanDialog = lazyWithRetry(() => import('../components/HierarchicalPlanDialog'));
const SprintTransitionModal = lazyWithRetry(() => import('../components/SprintTransitionModal'));
const ActionPlanDialog = lazyWithRetry(() => import('../components/ActionPlanDialog'));
const ReleaseListPanel = lazyWithRetry(() => import('../components/ReleaseListPanel'));
const ReleaseModal = lazyWithRetry(() => import('../components/ReleaseModal'));
const ExecutionDashboard = lazyWithRetry(() => import('../components/ExecutionDashboard'));
const WhatNextPanel = lazyWithRetry(() => import('../components/WhatNextPanel'));
const TimesheetView = lazyWithRetry(() => import('../components/TimesheetView'));
import { TaskListSkeleton, KanbanBoardSkeleton } from '../components/Skeleton';
import ToastContainer from '../components/shared/ToastContainer';
import KeyboardShortcutHelp from '../components/shared/KeyboardShortcutHelp';
import { IconClose } from '../components/shared/Icons';
import { statusLabel } from '../utils/taskHelpers';
import { parseColumns } from '../utils/jsonHelpers';

const lazyFallback = (
  <div className="flex items-center justify-center p-8">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-green" />
  </div>
);

export default function ProjectDetail() {
  const projectData = useProjectData();
  const filtering = useTaskFiltering(projectData.rootTasks);
  const { toasts, addToast, removeToast } = useToast();
  const { user } = useAuth();
  const { timeSummary, loadTimeSummary, logTime, deleteTimeEntry } = useTimeTracking();
  const searchRef = useRef<HTMLInputElement>(null);
  const location = useLocation();

  // Show setup wizard and/or onboarding wizard after project creation
  const [showSetup, setShowSetup] = useState(false);
  const setupCheckedRef = useRef(false);
  useEffect(() => {
    const state = location.state as Record<string, unknown> | null;
    if (state?.showSetup) {
      setShowSetup(true);
      // Clear state so it doesn't re-trigger on navigation
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  // Show setup wizard for projects without a GitHub repo (once project data loads)
  useEffect(() => {
    if (projectData.project && !projectData.project.githubRepositoryName && !setupCheckedRef.current) {
      setupCheckedRef.current = true;
      setShowSetup(true);
    }
  }, [projectData.project]);

  // Load time summary and action plan when task is selected
  const selectedTaskId = projectData.selectedTask?.taskId;
  const { loadActionPlan, setActionPlan } = projectData;
  useEffect(() => {
    if (selectedTaskId) {
      void loadTimeSummary(selectedTaskId);
      void loadActionPlan(selectedTaskId);
    } else {
      setActionPlan(null);
    }
  }, [selectedTaskId, loadTimeSummary, loadActionPlan, setActionPlan]);

  // Re-fetch tasks when server-side filter changes
  const filterInput = filtering.filterInput;
  useEffect(() => {
    if (projectData.projectId) {
      void projectData.loadTasks(filterInput);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterInput]);

  // Consolidated modal state — replaces 8+ individual booleans
  const [activeModal, setActiveModal] = useState<string | null>(null);
  // View panels that replace the main content (not modal overlays)
  const [activePanel, setActivePanel] = useState<'standup' | 'health' | 'trends' | 'cycle-time' | 'execution-dashboard' | 'what-next' | null>(null);
  // Kanban swimlane grouping
  const [groupBy, setGroupBy] = useState<'assignee' | 'priority' | 'epic' | null>(() => {
    const saved = localStorage.getItem('kanban-groupBy');
    if (saved === 'assignee' || saved === 'priority' || saved === 'epic') return saved;
    return null;
  });
  const [timelineView, setTimelineView] = useState(false);
  const [projectActivities, setProjectActivities] = useState<Activity[]>([]);
  const [gitHubRepo, setGitHubRepo] = useState<GitHubRepoLink | null>(null);
  const [gitHubInstallations, setGitHubInstallations] = useState<GitHubInstallation[]>([]);
  const [showTransition, setShowTransition] = useState<{ sprintId: string; sprintName: string } | null>(null);

  const [searchParams, setSearchParams] = useSearchParams();

  useKeyboardShortcuts({
    tasks: filtering.filteredTasks,
    selectedTask: projectData.selectedTask,
    onSelectTask: projectData.selectTask,
    onCloseTask: () => projectData.setSelectedTask(null),
    onNewTask: () => projectData.setShowAddForm(true),
    onFocusSearch: () => searchRef.current?.focus(),
    onShowHelp: () => setActiveModal((v) => v === 'shortcut-help' ? null : 'shortcut-help'),
    enabled: !projectData.isGenerating,
  });

  // SSE: refresh action plan when action events arrive for the selected task + toast notifications
  useSSEListener(
    ['task.action_started', 'task.action_completed', 'task.action_plan_completed', 'task.action_plan_failed', 'task.blocked', 'task.unblocked', 'task.created', 'task.updated', 'tasks.bulk_updated', 'approval.requested', 'approval.decided'],
    (event: string, data: unknown) => {
      if (event === 'task.action_started' || event === 'task.action_completed' || event === 'task.action_plan_completed') {
        const payload = data as { taskId?: string; taskTitle?: string };
        if (payload?.taskId && projectData.selectedTask?.taskId === payload.taskId) {
          void projectData.loadActionPlan(payload.taskId);
        }
        if (event === 'task.action_plan_completed' && payload?.taskTitle) {
          addToast('success', `Auto-complete finished for "${payload.taskTitle}"`);
        }
      }
      if (event === 'task.action_plan_failed') {
        const payload = data as { taskId?: string; taskTitle?: string; errorMessage?: string };
        if (payload?.taskId && projectData.selectedTask?.taskId === payload.taskId) {
          void projectData.loadActionPlan(payload.taskId);
        }
        addToast('error', `Auto-complete failed: ${(payload?.errorMessage || 'Unknown error').slice(0, 100)}`);
      }
      if (event === 'task.blocked') {
        const payload = data as { taskTitle?: string };
        if (payload?.taskTitle) {
          addToast('info', `"${payload.taskTitle}" is now blocked`);
        }
      }
      if (event === 'task.created' || event === 'task.updated' || event === 'tasks.bulk_updated') {
        void projectData.loadTasks(filterInput);
      }
      if (event === 'approval.requested') {
        const payload = data as { taskTitle?: string; fromStatus?: string; toStatus?: string };
        if (payload?.taskTitle) {
          addToast('info', `Approval requested: ${payload.taskTitle} (${payload.fromStatus} \u2192 ${payload.toStatus})`);
        }
      }
      if (event === 'approval.decided') {
        const payload = data as { taskTitle?: string; decision?: string; fromStatus?: string; toStatus?: string };
        if (payload?.taskTitle) {
          const verb = payload.decision === 'approved' ? 'Approved' : 'Rejected';
          addToast(payload.decision === 'approved' ? 'success' : 'info', `${verb}: ${payload.taskTitle} (${payload.fromStatus} \u2192 ${payload.toStatus})`);
        }
      }
    },
  );

  // Handle ?task=<taskId> deep-link from search results
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (taskId && projectData.rootTasks.length > 0) {
      const task = projectData.rootTasks.find((t) => t.taskId === taskId);
      if (task) {
        projectData.selectTask(task);
        setSearchParams((prev) => {
          prev.delete('task');
          return prev;
        }, { replace: true });
      }
    }
  }, [searchParams, projectData.rootTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load GitHub repo link + installations
  useEffect(() => {
    if (!projectData.projectId) return;
    gql<{ githubProjectRepo: GitHubRepoLink | null }>(
      GITHUB_PROJECT_REPO_QUERY,
      { projectId: projectData.projectId }
    )
      .then((data) => setGitHubRepo(data.githubProjectRepo))
      .catch(() => {/* non-critical */});
    gql<{ githubInstallations: GitHubInstallation[] }>(
      GITHUB_INSTALLATIONS_QUERY
    )
      .then((data) => setGitHubInstallations(data.githubInstallations))
      .catch(() => {/* non-critical */});
  }, [projectData.projectId]);

  // Load project-level activities when switching to dashboard
  const loadProjectActivities = useCallback(async () => {
    if (!projectData.projectId) return;
    try {
      const data = await gql<{ activities: Activity[] }>(
        PROJECT_ACTIVITIES_QUERY,
        { projectId: projectData.projectId }
      );
      setProjectActivities(data.activities);
    } catch {
      // ignore
    }
  }, [projectData.projectId]);

  // Handle modal/panel open requests from toolbar
  const handleOpenModal = (modal: string) => {
    // Panels that replace main content
    if (modal === 'standup') {
      setActivePanel('standup');
      projectData.setSummary(null);
      return;
    }
    if (modal === 'health') {
      setActivePanel('health');
      projectData.setSummary(null);
      return;
    }
    if (modal === 'trends') {
      setActivePanel('trends');
      projectData.setSummary(null);
      return;
    }
    if (modal === 'cycle-time') {
      setActivePanel('cycle-time');
      projectData.setSummary(null);
      return;
    }
    if (modal === 'what-next') {
      setActivePanel('what-next');
      projectData.setSummary(null);
      return;
    }
    if (modal === 'execution-dashboard') {
      setActivePanel('execution-dashboard');
      projectData.setSummary(null);
      return;
    }
    // Sprint transition carries data
    if (modal.startsWith('transition:')) {
      const parts = modal.split(':');
      setShowTransition({ sprintId: parts[1], sprintName: parts.slice(2).join(':') });
      return;
    }
    setActiveModal(modal);
  };

  // Wrap handlers to show toasts on success
  const handleStatusChange = async (taskId: string, status: string) => {
    await projectData.handleStatusChange(taskId, status);
    addToast('success', `Status updated to ${statusLabel(status)}`);
  };
  const handleAssignUser = async (taskId: string, assigneeId: string | null) => {
    await projectData.handleAssignUser(taskId, assigneeId);
    addToast('success', assigneeId ? 'Task assigned' : 'Task unassigned');
  };
  const handleDueDateChange = async (taskId: string, dueDate: string | null) => {
    await projectData.handleDueDateChange(taskId, dueDate);
    addToast('success', dueDate ? 'Due date set' : 'Due date cleared');
  };
  const handleAssignSprint = async (taskId: string, sprintId: string | null) => {
    await projectData.handleAssignSprint(taskId, sprintId);
    addToast('success', sprintId ? 'Moved to sprint' : 'Moved to backlog');
  };

  const handleToggleTaskId = (taskId: string) => {
    projectData.setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const handleToggleAll = (taskIds: string[]) => {
    projectData.setSelectedTaskIds((prev) => {
      const allSelected = taskIds.every((id) => prev.has(id));
      const next = new Set(prev);
      if (allSelected) {
        taskIds.forEach((id) => next.delete(id));
      } else {
        taskIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const handleBulkUpdate = async (updates: { status?: string; assigneeId?: string | null; sprintId?: string | null; archived?: boolean }) => {
    const ids = Array.from(projectData.selectedTaskIds);
    await projectData.handleBulkUpdate(ids, updates);
    addToast('success', `Updated ${ids.length} tasks`);
  };

  const handleCSVImport = async (tasks: Array<{ title: string; description?: string; status?: string; priority?: string }>) => {
    await projectData.handleBulkCreateTasks(tasks);
    addToast('success', `Imported ${tasks.length} tasks`);
    setActiveModal(null);
  };

  const handleSaveAsTemplate = async () => {
    if (!projectData.selectedTask || !projectData.projectId) return;
    const t = projectData.selectedTask;
    try {
      await gql<{ createTaskTemplate: { taskTemplateId: string } }>(
        SAVE_AS_TEMPLATE_MUTATION,
        { projectId: projectData.projectId, name: `Template: ${t.title}`, description: t.description, instructions: t.instructions ?? null, acceptanceCriteria: t.acceptanceCriteria ?? null, priority: t.priority, taskType: t.taskType },
      );
      addToast('success', 'Saved as template');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save template');
    }
  };

  if (!projectData.projectId) return null;

  const detailPanelProps = {
    editingTitle: projectData.editingTitle,
    editTitleValue: projectData.editTitleValue,
    titleEditRef: projectData.titleEditRef,
    generatingInstructions: projectData.generatingInstructions,
    sprints: projectData.sprints,
    orgUsers: projectData.orgUsers,
    statuses: projectData.projectStatuses,
    allTasks: projectData.rootTasks,
    comments: projectData.selectedTask ? (projectData.comments[projectData.selectedTask.taskId] ?? []) : [],
    activities: projectData.selectedTask ? (projectData.taskActivities[projectData.selectedTask.taskId] ?? []) : [],
    currentUserId: user?.userId ?? '',
    isAdmin: user?.role === 'org:admin',
    can: projectData.can,
    disabled: projectData.isGenerating,
    onStartEditTitle: projectData.startEditTitle,
    onTitleChange: projectData.setEditTitleValue,
    onTitleSave: projectData.handleTitleSave,
    onTitleKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') projectData.handleTitleSave();
      if (e.key === 'Escape') projectData.setEditingTitle(false);
    },
    onStatusChange: handleStatusChange,
    onSubtaskStatusChange: projectData.handleSubtaskStatusChange,
    onGenerateInstructions: projectData.handleGenerateInstructions,
    onAssignSprint: handleAssignSprint,
    onAssignUser: handleAssignUser,
    onDueDateChange: handleDueDateChange,
    onAddDependency: projectData.handleAddDependency,
    onRemoveDependency: projectData.handleRemoveDependency,
    onCreateComment: async (content: string, parentId?: string) => {
      if (projectData.selectedTask) await projectData.handleCreateComment(projectData.selectedTask.taskId, content, parentId);
    },
    onUpdateComment: projectData.handleUpdateComment,
    onDeleteComment: async (commentId: string) => {
      if (projectData.selectedTask) await projectData.handleDeleteComment(commentId, projectData.selectedTask.taskId);
    },
    onUpdateTask: projectData.handleUpdateTask,
    labels: projectData.labels,
    onAddTaskLabel: projectData.handleAddTaskLabel,
    onRemoveTaskLabel: projectData.handleRemoveTaskLabel,
    onCreateLabel: projectData.handleCreateLabel,
    onAddWatcher: projectData.handleAddWatcher,
    onRemoveWatcher: projectData.handleRemoveWatcher,
    onArchiveTask: async (taskId: string, archived: boolean) => {
      await projectData.handleArchiveTask(taskId, archived);
      addToast('success', archived ? 'Task archived' : 'Task unarchived');
    },
    onAutoComplete: projectData.handlePreviewActionPlan,
    autoCompleteLoading: projectData.actionPlanPreviewLoading,
    actionPlan: projectData.actionPlan,
    onCompleteManualAction: projectData.handleCompleteManualAction,
    onSkipAction: projectData.handleSkipAction,
    onRetryAction: projectData.handleRetryAction,
    onCancelActionPlan: projectData.handleCancelActionPlan,
    onExecuteActionPlan: async (planId: string) => { await projectData.handleExecuteActionPlan(planId); },
    timeSummary,
    onLogTime: logTime,
    onDeleteTimeEntry: deleteTimeEntry,
    onSelectTask: projectData.selectTask,
  };

  return (
    <PermissionProvider can={projectData.can}>
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar + status editor + filter bar */}
      <ProjectToolbar
        projectData={projectData}
        filtering={filtering}
        searchRef={searchRef}
        timelineView={timelineView}
        setTimelineView={setTimelineView}
        gitHubRepo={gitHubRepo}
        addToast={addToast}
        onOpenModal={handleOpenModal}
        onLoadProjectActivities={loadProjectActivities}
        tqlError={projectData.err && projectData.err.includes('TQL parse error') ? projectData.err : null}
      />

      {/* Inline add form */}
      {projectData.showAddForm && !projectData.isGenerating && (
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <form onSubmit={projectData.handleAddTask} className="flex items-center gap-2">
            <input
              type="text"
              value={projectData.newTaskTitle}
              onChange={(e) => projectData.setNewTaskTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 max-w-sm px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-brand-green dark:bg-slate-700 dark:text-slate-200"
              required
              autoFocus
            />
            <button type="submit" className="px-3 py-1.5 bg-brand-green text-white text-sm rounded hover:bg-brand-green-hover">
              Add
            </button>
            {projectData.addErr && <p className="text-xs text-red-600">{projectData.addErr}</p>}
          </form>
        </div>
      )}

      {/* Error banner */}
      {projectData.err && (
        <div className="px-6 py-2 bg-red-50 text-sm text-red-600 border-b border-red-100 flex-shrink-0 flex items-center justify-between">
          <span>{projectData.err}</span>
          <button type="button" onClick={() => projectData.setErr(null)} className="text-red-400 hover:text-red-600 ml-2">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main content row */}
      <div className="flex flex-1 min-h-0">
        {/* Left: board / backlog / dashboard / states */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {activePanel === 'standup' && projectData.projectId ? (
            <Suspense fallback={lazyFallback}>
              <StandupReportPanel
                projectId={projectData.projectId}
                disabled={projectData.isGenerating}
                onClose={() => setActivePanel(null)}
              />
            </Suspense>
          ) : activePanel === 'health' && projectData.projectId ? (
            <Suspense fallback={lazyFallback}>
              <ProjectHealthPanel
                projectId={projectData.projectId}
                disabled={projectData.isGenerating}
                onClose={() => setActivePanel(null)}
              />
            </Suspense>
          ) : activePanel === 'trends' && projectData.projectId ? (
            <Suspense fallback={lazyFallback}>
              <TrendAnalysisPanel
                projectId={projectData.projectId}
                disabled={projectData.isGenerating}
                onClose={() => setActivePanel(null)}
              />
            </Suspense>
          ) : activePanel === 'cycle-time' && projectData.projectId ? (
            <Suspense fallback={lazyFallback}>
              <CycleTimePanel
                projectId={projectData.projectId}
                sprints={projectData.sprints}
                disabled={projectData.isGenerating}
                onClose={() => setActivePanel(null)}
              />
            </Suspense>
          ) : activePanel === 'execution-dashboard' && projectData.projectId ? (
            <Suspense fallback={lazyFallback}>
              <ExecutionDashboard
                projectId={projectData.projectId}
                onClose={() => setActivePanel(null)}
              />
            </Suspense>
          ) : activePanel === 'what-next' && projectData.projectId ? (
            <Suspense fallback={lazyFallback}>
              <WhatNextPanel
                projectId={projectData.projectId}
                onClose={() => setActivePanel(null)}
                onApplied={() => void projectData.loadTasks(filterInput)}
              />
            </Suspense>
          ) : projectData.summary ? (
            <div className="flex-1 flex items-center justify-center px-8">
              <div className="max-w-lg w-full">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Project Summary</p>
                  <button type="button" onClick={() => projectData.setSummary(null)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                    <IconClose className="w-3 h-3" /> Dismiss
                  </button>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{projectData.summary}</p>
              </div>
            </div>
          ) : timelineView ? (
            <Suspense fallback={lazyFallback}>
              <GanttChart
                tasks={filtering.filteredTasks}
                onSelectTask={projectData.selectTask}
              />
            </Suspense>
          ) : projectData.view === 'dashboard' ? (
            <ProjectDashboard
              stats={projectData.dashboardStats}
              activities={projectActivities}
              loading={!projectData.dashboardStats}
              projectId={projectData.projectId!}
              sprints={projectData.sprints}
            />
          ) : projectData.view === 'epics' ? (
            <EpicsView
              projectId={projectData.projectId!}
              epics={projectData.epics}
              selectedTask={projectData.selectedTask}
              onSelectTask={projectData.selectTask}
            />
          ) : projectData.view === 'timesheet' ? (
            <Suspense fallback={lazyFallback}>
              <TimesheetView
                projectId={projectData.projectId!}
                orgUsers={projectData.orgUsers}
              />
            </Suspense>
          ) : projectData.view === 'releases' ? (
            <Suspense fallback={lazyFallback}>
              <ReleaseListPanel
                releases={projectData.releases}
                selectedRelease={projectData.selectedRelease}
                projectTasks={projectData.tasks}
                loading={projectData.releasesLoading}
                onSelectRelease={projectData.setSelectedRelease}
                onCreateRelease={() => projectData.setShowReleaseCreateModal(true)}
                onUpdateRelease={projectData.updateRelease}
                onDeleteRelease={projectData.deleteRelease}
                onAddTask={projectData.addTaskToRelease}
                onRemoveTask={projectData.removeTaskFromRelease}
                onGenerateNotes={projectData.generateReleaseNotes}
              />
            </Suspense>
          ) : projectData.loading ? (
            projectData.view === 'board' ? <KanbanBoardSkeleton /> : <TaskListSkeleton count={6} />
          ) : projectData.view === 'backlog' ? (
            <BacklogView
              projectId={projectData.projectId!}
              tasks={filtering.filteredTasks}
              sprints={projectData.sprints}
              orgUsers={projectData.orgUsers}
              selectedTask={projectData.selectedTask}
              selectedTaskIds={projectData.selectedTaskIds}
              onSelectTask={projectData.selectTask}
              onToggleTaskId={handleToggleTaskId}
              onToggleAll={handleToggleAll}
              onCreateSprint={() => projectData.setShowSprintModal(true)}
              onEditSprint={(sprint) => projectData.setEditingSprint(sprint)}
              onDeleteSprint={projectData.handleDeleteSprint}
              onPlanSprints={() => projectData.setShowSprintPlanModal(true)}
              onActivateSprint={projectData.handleActivateSprint}
              onCloseSprint={(sprintId) => projectData.setCloseSprintId(sprintId)}
              onAssignSprint={projectData.handleAssignSprint}
              onReorderTask={projectData.handleReorderTask}
              hasMore={projectData.hasMore}
              onLoadMore={projectData.loadMoreTasks}
              showArchived={filtering.showArchived}
              onToggleShowArchived={() => filtering.setShowArchived(!filtering.showArchived)}
              epicMap={projectData.epicMap}
            />
          ) : projectData.view === 'calendar' ? (
            <CalendarView
              tasks={filtering.filteredTasks}
              selectedTask={projectData.selectedTask}
              onSelectTask={projectData.selectTask}
            />
          ) : projectData.view === 'table' ? (
            <TableView
              tasks={filtering.filteredTasks}
              sprints={projectData.sprints}
              orgUsers={projectData.orgUsers}
              selectedTask={projectData.selectedTask}
              selectedTaskIds={projectData.selectedTaskIds}
              statuses={projectData.projectStatuses}
              onSelectTask={projectData.selectTask}
              onToggleTaskId={handleToggleTaskId}
              onToggleAll={handleToggleAll}
              onStatusChange={handleStatusChange}
              onAssignUser={handleAssignUser}
              onDueDateChange={handleDueDateChange}
              onAssignSprint={handleAssignSprint}
            />
          ) : projectData.activeSprint ? (
            <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4 flex flex-col">
              <div className="flex items-center gap-2 mb-3 flex-shrink-0">
                <label htmlFor="groupby-select" className="text-xs text-slate-500 dark:text-slate-400">Group by</label>
                <select
                  id="groupby-select"
                  value={groupBy ?? ''}
                  onChange={(e) => {
                    const val = e.target.value as 'assignee' | 'priority' | 'epic' | '';
                    const next = val || null;
                    setGroupBy(next);
                    if (next) localStorage.setItem('kanban-groupBy', next);
                    else localStorage.removeItem('kanban-groupBy');
                  }}
                  className="text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                >
                  <option value="">None</option>
                  <option value="assignee">By Assignee</option>
                  <option value="priority">By Priority</option>
                  <option value="epic">By Epic</option>
                </select>
              </div>
              <div className="flex-1 min-h-0">
                <KanbanBoard
                  columns={parseColumns(projectData.activeSprint.columns)}
                  tasks={filtering.filteredTasks.filter((t) => t.sprintId === projectData.activeSprint!.sprintId && !t.archived)}
                  subtasks={projectData.subtasks}
                  selectedTask={projectData.selectedTask}
                  onSelectTask={projectData.selectTask}
                  onColumnChange={projectData.handleSprintColumnChange}
                  epicMap={projectData.epicMap}
                  groupBy={groupBy}
                  orgUsers={projectData.orgUsers}
                  wipLimits={projectData.activeSprint.wipLimits ? (() => { try { return JSON.parse(projectData.activeSprint.wipLimits!); } catch { return undefined; } })() : undefined}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <p className="text-slate-500 dark:text-slate-300 text-sm">No active sprint. Set a sprint as active to see the board.</p>
                <button
                  type="button"
                  onClick={() => projectData.setShowSprintModal(true)}
                  disabled={!projectData.can('MANAGE_SPRINTS')}
                  title={!projectData.can('MANAGE_SPRINTS') ? "You don't have permission to manage sprints" : undefined}
                  className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
                >
                  + Create Sprint
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: task detail panel — sidebar on md+, full-screen drawer on mobile */}
        {projectData.selectedTask && (
          <>
            {/* Desktop sidebar */}
            <div className="hidden md:flex w-[440px] flex-shrink-0 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 flex-col overflow-hidden">
              <div className="px-4 pt-2 pb-1 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleSaveAsTemplate}
                  className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
                >
                  Save as Template
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                <TaskDetailPanel
                  task={projectData.selectedTask}
                  subtasks={projectData.subtasks[projectData.selectedTask.taskId] ?? []}
                  onClose={() => projectData.setSelectedTask(null)}
                  {...detailPanelProps}
                />
              </div>
            </div>

            {/* Mobile drawer overlay */}
            <div className="md:hidden fixed inset-0 z-40 flex">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/50 transition-opacity"
                onClick={() => projectData.setSelectedTask(null)}
              />
              {/* Drawer panel */}
              <div className="relative ml-auto w-full max-w-lg bg-white dark:bg-slate-900 flex flex-col overflow-hidden shadow-xl animate-slide-in-right">
                <div className="px-4 pt-3 pb-1 border-b border-slate-100 dark:border-slate-700 flex-shrink-0 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={handleSaveAsTemplate}
                    className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 border border-slate-200 rounded hover:bg-slate-50"
                  >
                    Save as Template
                  </button>
                  <button
                    type="button"
                    onClick={() => projectData.setSelectedTask(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                    aria-label="Close"
                  >
                    <IconClose className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <TaskDetailPanel
                    task={projectData.selectedTask}
                    subtasks={projectData.subtasks[projectData.selectedTask.taskId] ?? []}
                    onClose={() => projectData.setSelectedTask(null)}
                    isDrawer
                    {...detailPanelProps}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={projectData.selectedTaskIds.size}
        statuses={projectData.projectStatuses}
        sprints={projectData.sprints}
        orgUsers={projectData.orgUsers}
        onBulkUpdate={handleBulkUpdate}
        onClearSelection={() => projectData.setSelectedTaskIds(new Set())}
      />

      {/* Sprint create modal */}
      {projectData.showSprintModal && projectData.projectId && (
        <Suspense fallback={lazyFallback}>
          <SprintCreateModal
            projectId={projectData.projectId}
            onCreated={projectData.handleCreateSprint}
            onClose={() => projectData.setShowSprintModal(false)}
          />
        </Suspense>
      )}

      {/* Sprint edit modal */}
      {projectData.editingSprint && projectData.projectId && (
        <Suspense fallback={lazyFallback}>
          <SprintCreateModal
            projectId={projectData.projectId}
            initialSprint={projectData.editingSprint}
            onCreated={projectData.handleCreateSprint}
            onUpdated={projectData.handleSprintUpdated}
            onClose={() => projectData.setEditingSprint(null)}
          />
        </Suspense>
      )}

      {/* Sprint plan modal */}
      {projectData.showSprintPlanModal && projectData.projectId && (
        <Suspense fallback={lazyFallback}>
          <SprintPlanModal
            projectId={projectData.projectId}
            tasks={projectData.tasks}
            onCreated={projectData.handleSprintPlanCreated}
            onTasksUpdated={projectData.loadTasks}
            onClose={() => projectData.setShowSprintPlanModal(false)}
          />
        </Suspense>
      )}

      {/* Close sprint modal */}
      {projectData.closeSprintId && (() => {
        const closingSprint = projectData.sprints.find((s) => s.sprintId === projectData.closeSprintId);
        if (!closingSprint) return null;
        return (
          <Suspense fallback={lazyFallback}>
            <CloseSprintModal
              sprint={closingSprint}
              sprintTasks={projectData.tasks.filter((t) => t.sprintId === projectData.closeSprintId)}
              otherSprints={projectData.sprints.filter((s) => !s.closedAt && s.sprintId !== projectData.closeSprintId)}
              onClosed={projectData.handleSprintClosed}
              onActivateNext={projectData.handleActivateSprint}
              onCreateSprint={() => projectData.setShowSprintModal(true)}
              onClose={() => projectData.setCloseSprintId(null)}
            />
          </Suspense>
        );
      })()}

      {/* Task plan approval dialog */}
      {projectData.previewTasks !== null && (
        <Suspense fallback={lazyFallback}>
          <TaskPlanApprovalDialog
            tasks={projectData.previewTasks}
            loading={projectData.previewLoading}
            error={projectData.previewError}
            onApprove={projectData.handleCommitPlan}
            onRedo={(ctx) => projectData.openPreview(ctx)}
            onAddMore={(ctx) => projectData.openPreview(ctx, projectData.previewTasks!.map((t) => t.title))}
            onCancel={() => { projectData.setPreviewTasks(null); projectData.setPreviewError(null); }}
          />
        </Suspense>
      )}

      {/* GitHub repo modal */}
      {activeModal === 'github' && projectData.projectId && (
        <Suspense fallback={lazyFallback}>
          <GitHubRepoModal
            projectId={projectData.projectId}
            installations={gitHubInstallations}
            currentRepo={gitHubRepo}
            onConnected={(repo) => { setGitHubRepo(repo); setActiveModal(null); }}
            onDisconnected={() => { setGitHubRepo(null); setActiveModal(null); }}
            onClose={() => setActiveModal(null)}
          />
        </Suspense>
      )}

      {/* Meeting notes dialog */}
      {activeModal === 'meeting-notes' && projectData.projectId && (
        <Suspense fallback={lazyFallback}>
          <MeetingNotesDialog
            projectId={projectData.projectId}
            onTasksCreated={() => { projectData.loadTasks(); setActiveModal(null); }}
            onClose={() => setActiveModal(null)}
          />
        </Suspense>
      )}

      {/* CSV Import modal */}
      {activeModal === 'csv-import' && (
        <Suspense fallback={lazyFallback}>
          <CSVImportModal
            onImport={handleCSVImport}
            onClose={() => setActiveModal(null)}
          />
        </Suspense>
      )}

      {/* Sprint transition modal */}
      {showTransition && (
        <Suspense fallback={lazyFallback}>
          <SprintTransitionModal
            sprintId={showTransition.sprintId}
            sprintName={showTransition.sprintName}
            onApply={async (carryOverIds, deprioritizeIds) => {
              for (const taskId of deprioritizeIds) {
                await projectData.handleAssignSprint(taskId, null);
              }
              addToast('success', `${carryOverIds.length} tasks carried over, ${deprioritizeIds.length} moved to backlog`);
            }}
            onClose={() => setShowTransition(null)}
          />
        </Suspense>
      )}

      {/* Bug report modal */}
      {activeModal === 'bug-report' && (
        <Suspense fallback={lazyFallback}>
          <BugReportModal
            onSubmit={async (bugReport) => {
              await projectData.handleParseBugReport(bugReport);
              addToast('success', 'Bug report parsed and task created');
            }}
            onClose={() => setActiveModal(null)}
          />
        </Suspense>
      )}

      {/* PRD breakdown modal */}
      {activeModal === 'prd-breakdown' && (
        <Suspense fallback={lazyFallback}>
          <PRDBreakdownModal
            onPreview={projectData.handlePreviewPRD}
            onCommit={async (epics) => {
              await projectData.handleCommitPRD(epics);
              addToast('success', 'Tasks created from PRD');
            }}
            onClose={() => setActiveModal(null)}
          />
        </Suspense>
      )}

      {/* Hierarchical plan dialog */}
      {activeModal === 'hierarchical-plan' && projectData.projectId && (
        <Suspense fallback={lazyFallback}>
          <HierarchicalPlanDialog
            isOpen
            onClose={() => setActiveModal(null)}
            projectId={projectData.projectId}
            onPlanCommitted={() => {
              addToast('success', 'Hierarchical plan committed');
              setActiveModal(null);
              projectData.loadTasks();
            }}
          />
        </Suspense>
      )}

      {/* Knowledge base panel */}
      {activeModal === 'knowledge-base' && projectData.projectId && (
        <Suspense fallback={lazyFallback}>
          <KnowledgeBasePanel
            isOpen
            onClose={() => setActiveModal(null)}
            projectId={projectData.projectId}
            knowledgeBase={projectData.project?.knowledgeBase ?? null}
            onRefreshFromRepo={projectData.handleRefreshRepoProfile}
            hasGitHubRepo={!!(projectData.project?.githubRepositoryName)}
            onRunInterview={undefined}
          />
        </Suspense>
      )}

      {/* Project setup wizard (shown after project creation) */}
      {showSetup && projectData.projectId && (
        <Suspense fallback={lazyFallback}>
          <ProjectSetupWizard
            isOpen
            projectId={projectData.projectId}
            onComplete={() => setShowSetup(false)}
            onSkip={() => setShowSetup(false)}
          />
        </Suspense>
      )}

      {/* Project settings modal */}
      {activeModal === 'project-settings' && projectData.projectId && (
        <Suspense fallback={lazyFallback}>
          <ProjectSettingsModal
            projectId={projectData.projectId}
            orgUsers={projectData.orgUsers}
            onClose={() => setActiveModal(null)}
          />
        </Suspense>
      )}

      {/* Action plan dialog */}
      {projectData.actionPlanPreview && projectData.selectedTask && (
        <Suspense fallback={lazyFallback}>
          <ActionPlanDialog
            preview={projectData.actionPlanPreview}
            onCommitAndExecute={async (actions) => {
              const plan = await projectData.handleCommitActionPlan(projectData.selectedTask!.taskId, actions);
              if (plan) {
                await projectData.handleExecuteActionPlan(plan.id);
              }
            }}
            onClose={() => projectData.setActionPlanPreview(null)}
          />
        </Suspense>
      )}

      {/* Release create modal */}
      {projectData.showReleaseCreateModal && (
        <Suspense fallback={lazyFallback}>
          <ReleaseModal
            onSubmit={projectData.createRelease}
            onClose={() => projectData.setShowReleaseCreateModal(false)}
          />
        </Suspense>
      )}

      {/* Keyboard shortcut help */}
      {activeModal === 'shortcut-help' && <KeyboardShortcutHelp onClose={() => setActiveModal(null)} />}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Confirm dialog for nav-away during AI generation */}
      <projectData.ConfirmDialogPortal />
    </div>
    </PermissionProvider>
  );
}
