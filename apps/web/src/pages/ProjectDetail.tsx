import { useRef, useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useProjectData } from '../hooks/useProjectData';
import { useTaskFiltering } from '../hooks/useTaskFiltering';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../hooks/useToast';
import { useTimeTracking } from '../hooks/useTimeTracking';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import { useSSEListener } from '../hooks/useEventSource';
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
const KnowledgeBaseModal = lazyWithRetry(() => import('../components/KnowledgeBaseModal'));
const BugReportModal = lazyWithRetry(() => import('../components/BugReportModal'));
const PRDBreakdownModal = lazyWithRetry(() => import('../components/PRDBreakdownModal'));
const SprintTransitionModal = lazyWithRetry(() => import('../components/SprintTransitionModal'));
const ActionPlanDialog = lazyWithRetry(() => import('../components/ActionPlanDialog'));
const ReleaseListPanel = lazyWithRetry(() => import('../components/ReleaseListPanel'));
const ReleaseModal = lazyWithRetry(() => import('../components/ReleaseModal'));
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
  const d = useProjectData();
  const filtering = useTaskFiltering(d.rootTasks);
  const { toasts, addToast, removeToast } = useToast();
  const { user } = useAuth();
  const { timeSummary, loadTimeSummary, logTime, deleteTimeEntry } = useTimeTracking();
  const searchRef = useRef<HTMLInputElement>(null);

  // Load time summary when task is selected
  const selectedTaskId = d.selectedTask?.taskId;
  useEffect(() => {
    if (selectedTaskId) {
      void loadTimeSummary(selectedTaskId);
    }
  }, [selectedTaskId, loadTimeSummary]);

  // Re-fetch tasks when server-side filter changes
  const filterInput = filtering.filterInput;
  useEffect(() => {
    if (d.projectId) {
      void d.loadTasks(filterInput);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterInput]);

  // Consolidated modal state — replaces 8+ individual booleans
  const [activeModal, setActiveModal] = useState<string | null>(null);
  // View panels that replace the main content (not modal overlays)
  const [activePanel, setActivePanel] = useState<'standup' | 'health' | 'trends' | 'cycle-time' | null>(null);
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
    selectedTask: d.selectedTask,
    onSelectTask: d.selectTask,
    onCloseTask: () => d.setSelectedTask(null),
    onNewTask: () => d.setShowAddForm(true),
    onFocusSearch: () => searchRef.current?.focus(),
    onShowHelp: () => setActiveModal((v) => v === 'shortcut-help' ? null : 'shortcut-help'),
    enabled: !d.isGenerating,
  });

  // SSE: refresh action plan when action events arrive for the selected task
  useSSEListener(
    ['task.action_completed', 'task.action_plan_completed', 'task.updated'],
    (event: string, data: unknown) => {
      if (event === 'task.action_completed' || event === 'task.action_plan_completed') {
        const payload = data as { taskId?: string };
        if (payload?.taskId && d.selectedTask?.taskId === payload.taskId) {
          void d.loadActionPlan(payload.taskId);
        }
      }
      if (event === 'task.updated') {
        const payload = data as { taskId?: string };
        if (payload?.taskId) {
          void d.loadTasks(filterInput);
        }
      }
    },
  );

  // Handle ?task=<taskId> deep-link from search results
  useEffect(() => {
    const taskId = searchParams.get('task');
    if (taskId && d.rootTasks.length > 0) {
      const task = d.rootTasks.find((t) => t.taskId === taskId);
      if (task) {
        d.selectTask(task);
        setSearchParams((prev) => {
          prev.delete('task');
          return prev;
        }, { replace: true });
      }
    }
  }, [searchParams, d.rootTasks]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load GitHub repo link + installations
  useEffect(() => {
    if (!d.projectId) return;
    gql<{ githubProjectRepo: GitHubRepoLink | null }>(
      `query GitHubRepo($projectId: ID!) { githubProjectRepo(projectId: $projectId) { repositoryId repositoryName repositoryOwner installationId defaultBranch } }`,
      { projectId: d.projectId }
    )
      .then((data) => setGitHubRepo(data.githubProjectRepo))
      .catch(() => {/* non-critical */});
    gql<{ githubInstallations: GitHubInstallation[] }>(
      `query { githubInstallations { installationId accountLogin accountType orgId createdAt } }`
    )
      .then((data) => setGitHubInstallations(data.githubInstallations))
      .catch(() => {/* non-critical */});
  }, [d.projectId]);

  // Load project-level activities when switching to dashboard
  const loadProjectActivities = useCallback(async () => {
    if (!d.projectId) return;
    try {
      const data = await gql<{ activities: Activity[] }>(
        `query Activities($projectId: ID!) { activities(projectId: $projectId, limit: 50) { activityId projectId taskId sprintId userId userEmail action field oldValue newValue createdAt } }`,
        { projectId: d.projectId }
      );
      setProjectActivities(data.activities);
    } catch {
      // ignore
    }
  }, [d.projectId]);

  // Handle modal/panel open requests from toolbar
  const handleOpenModal = (modal: string) => {
    // Panels that replace main content
    if (modal === 'standup') {
      setActivePanel('standup');
      d.setSummary(null);
      return;
    }
    if (modal === 'health') {
      setActivePanel('health');
      d.setSummary(null);
      return;
    }
    if (modal === 'trends') {
      setActivePanel('trends');
      d.setSummary(null);
      return;
    }
    if (modal === 'cycle-time') {
      setActivePanel('cycle-time');
      d.setSummary(null);
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
    await d.handleStatusChange(taskId, status);
    addToast('success', `Status updated to ${statusLabel(status)}`);
  };
  const handleAssignUser = async (taskId: string, assigneeId: string | null) => {
    await d.handleAssignUser(taskId, assigneeId);
    addToast('success', assigneeId ? 'Task assigned' : 'Task unassigned');
  };
  const handleDueDateChange = async (taskId: string, dueDate: string | null) => {
    await d.handleDueDateChange(taskId, dueDate);
    addToast('success', dueDate ? 'Due date set' : 'Due date cleared');
  };
  const handleAssignSprint = async (taskId: string, sprintId: string | null) => {
    await d.handleAssignSprint(taskId, sprintId);
    addToast('success', sprintId ? 'Moved to sprint' : 'Moved to backlog');
  };

  const handleToggleTaskId = (taskId: string) => {
    d.setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId); else next.add(taskId);
      return next;
    });
  };

  const handleToggleAll = (taskIds: string[]) => {
    d.setSelectedTaskIds((prev) => {
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
    const ids = Array.from(d.selectedTaskIds);
    await d.handleBulkUpdate(ids, updates);
    addToast('success', `Updated ${ids.length} tasks`);
  };

  const handleCSVImport = async (tasks: Array<{ title: string; description?: string; status?: string; priority?: string }>) => {
    await d.handleBulkCreateTasks(tasks);
    addToast('success', `Imported ${tasks.length} tasks`);
    setActiveModal(null);
  };

  const handleSaveAsTemplate = async () => {
    if (!d.selectedTask || !d.projectId) return;
    const t = d.selectedTask;
    try {
      await gql<{ createTaskTemplate: { taskTemplateId: string } }>(
        `mutation SaveAsTemplate($projectId: ID, $name: String!, $description: String, $instructions: String, $acceptanceCriteria: String, $priority: String, $taskType: String) {
          createTaskTemplate(projectId: $projectId, name: $name, description: $description, instructions: $instructions, acceptanceCriteria: $acceptanceCriteria, priority: $priority, taskType: $taskType) { taskTemplateId }
        }`,
        { projectId: d.projectId, name: `Template: ${t.title}`, description: t.description, instructions: t.instructions ?? null, acceptanceCriteria: t.acceptanceCriteria ?? null, priority: t.priority, taskType: t.taskType },
      );
      addToast('success', 'Saved as template');
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to save template');
    }
  };

  if (!d.projectId) return null;

  const detailPanelProps = {
    editingTitle: d.editingTitle,
    editTitleValue: d.editTitleValue,
    titleEditRef: d.titleEditRef,
    generatingInstructions: d.generatingInstructions,
    sprints: d.sprints,
    orgUsers: d.orgUsers,
    statuses: d.projectStatuses,
    allTasks: d.rootTasks,
    comments: d.selectedTask ? (d.comments[d.selectedTask.taskId] ?? []) : [],
    activities: d.selectedTask ? (d.taskActivities[d.selectedTask.taskId] ?? []) : [],
    currentUserId: user?.userId ?? '',
    isAdmin: user?.role === 'org:admin',
    disabled: d.isGenerating,
    onStartEditTitle: d.startEditTitle,
    onTitleChange: d.setEditTitleValue,
    onTitleSave: d.handleTitleSave,
    onTitleKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') d.handleTitleSave();
      if (e.key === 'Escape') d.setEditingTitle(false);
    },
    onStatusChange: handleStatusChange,
    onSubtaskStatusChange: d.handleSubtaskStatusChange,
    onGenerateInstructions: d.handleGenerateInstructions,
    onAssignSprint: handleAssignSprint,
    onAssignUser: handleAssignUser,
    onDueDateChange: handleDueDateChange,
    onAddDependency: d.handleAddDependency,
    onRemoveDependency: d.handleRemoveDependency,
    onCreateComment: async (content: string, parentId?: string) => {
      if (d.selectedTask) await d.handleCreateComment(d.selectedTask.taskId, content, parentId);
    },
    onUpdateComment: d.handleUpdateComment,
    onDeleteComment: async (commentId: string) => {
      if (d.selectedTask) await d.handleDeleteComment(commentId, d.selectedTask.taskId);
    },
    onUpdateTask: d.handleUpdateTask,
    labels: d.labels,
    onAddTaskLabel: d.handleAddTaskLabel,
    onRemoveTaskLabel: d.handleRemoveTaskLabel,
    onCreateLabel: d.handleCreateLabel,
    onAddWatcher: d.handleAddWatcher,
    onRemoveWatcher: d.handleRemoveWatcher,
    onArchiveTask: async (taskId: string, archived: boolean) => {
      await d.handleArchiveTask(taskId, archived);
      addToast('success', archived ? 'Task archived' : 'Task unarchived');
    },
    onAutoComplete: d.handlePreviewActionPlan,
    autoCompleteLoading: d.actionPlanPreviewLoading,
    actionPlan: d.actionPlan,
    onCompleteManualAction: d.handleCompleteManualAction,
    onSkipAction: d.handleSkipAction,
    onRetryAction: d.handleRetryAction,
    onCancelActionPlan: d.handleCancelActionPlan,
    timeSummary,
    onLogTime: logTime,
    onDeleteTimeEntry: deleteTimeEntry,
    onSelectTask: d.selectTask,
  };

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar + status editor + filter bar */}
      <ProjectToolbar
        d={d}
        filtering={filtering}
        searchRef={searchRef}
        timelineView={timelineView}
        setTimelineView={setTimelineView}
        gitHubRepo={gitHubRepo}
        addToast={addToast}
        onOpenModal={handleOpenModal}
        onLoadProjectActivities={loadProjectActivities}
      />

      {/* Inline add form */}
      {d.showAddForm && !d.isGenerating && (
        <div className="px-6 py-3 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <form onSubmit={d.handleAddTask} className="flex items-center gap-2">
            <input
              type="text"
              value={d.newTaskTitle}
              onChange={(e) => d.setNewTaskTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 max-w-sm px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded focus:outline-none focus:ring-1 focus:ring-brand-green dark:bg-slate-700 dark:text-slate-200"
              required
              autoFocus
            />
            <button type="submit" className="px-3 py-1.5 bg-brand-green text-white text-sm rounded hover:bg-brand-green-hover">
              Add
            </button>
            {d.addErr && <p className="text-xs text-red-600">{d.addErr}</p>}
          </form>
        </div>
      )}

      {/* Error banner */}
      {d.err && (
        <div className="px-6 py-2 bg-red-50 text-sm text-red-600 border-b border-red-100 flex-shrink-0 flex items-center justify-between">
          <span>{d.err}</span>
          <button type="button" onClick={() => d.setErr(null)} className="text-red-400 hover:text-red-600 ml-2">
            <IconClose className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Main content row */}
      <div className="flex flex-1 min-h-0">
        {/* Left: board / backlog / dashboard / states */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {activePanel === 'standup' && d.projectId ? (
            <Suspense fallback={lazyFallback}>
              <StandupReportPanel
                projectId={d.projectId}
                disabled={d.isGenerating}
                onClose={() => setActivePanel(null)}
              />
            </Suspense>
          ) : activePanel === 'health' && d.projectId ? (
            <Suspense fallback={lazyFallback}>
              <ProjectHealthPanel
                projectId={d.projectId}
                disabled={d.isGenerating}
                onClose={() => setActivePanel(null)}
              />
            </Suspense>
          ) : activePanel === 'trends' && d.projectId ? (
            <Suspense fallback={lazyFallback}>
              <TrendAnalysisPanel
                projectId={d.projectId}
                disabled={d.isGenerating}
                onClose={() => setActivePanel(null)}
              />
            </Suspense>
          ) : activePanel === 'cycle-time' && d.projectId ? (
            <Suspense fallback={lazyFallback}>
              <CycleTimePanel
                projectId={d.projectId}
                sprints={d.sprints}
                disabled={d.isGenerating}
                onClose={() => setActivePanel(null)}
              />
            </Suspense>
          ) : d.summary ? (
            <div className="flex-1 flex items-center justify-center px-8">
              <div className="max-w-lg w-full">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Project Summary</p>
                  <button type="button" onClick={() => d.setSummary(null)} className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600">
                    <IconClose className="w-3 h-3" /> Dismiss
                  </button>
                </div>
                <p className="text-slate-700 dark:text-slate-300 leading-relaxed">{d.summary}</p>
              </div>
            </div>
          ) : timelineView ? (
            <Suspense fallback={lazyFallback}>
              <GanttChart
                tasks={filtering.filteredTasks}
                onSelectTask={d.selectTask}
              />
            </Suspense>
          ) : d.view === 'dashboard' ? (
            <ProjectDashboard
              stats={d.dashboardStats}
              activities={projectActivities}
              loading={!d.dashboardStats}
              projectId={d.projectId!}
              sprints={d.sprints}
            />
          ) : d.view === 'epics' ? (
            <EpicsView
              projectId={d.projectId!}
              epics={d.epics}
              selectedTask={d.selectedTask}
              onSelectTask={d.selectTask}
            />
          ) : d.view === 'releases' ? (
            <Suspense fallback={lazyFallback}>
              <ReleaseListPanel
                releases={d.releases}
                selectedRelease={d.selectedRelease}
                projectTasks={d.tasks}
                loading={d.releasesLoading}
                onSelectRelease={d.setSelectedRelease}
                onCreateRelease={() => d.setShowReleaseCreateModal(true)}
                onUpdateRelease={d.updateRelease}
                onDeleteRelease={d.deleteRelease}
                onAddTask={d.addTaskToRelease}
                onRemoveTask={d.removeTaskFromRelease}
                onGenerateNotes={d.generateReleaseNotes}
              />
            </Suspense>
          ) : d.loading ? (
            d.view === 'board' ? <KanbanBoardSkeleton /> : <TaskListSkeleton count={6} />
          ) : d.view === 'backlog' ? (
            <BacklogView
              projectId={d.projectId!}
              tasks={filtering.filteredTasks}
              sprints={d.sprints}
              orgUsers={d.orgUsers}
              selectedTask={d.selectedTask}
              selectedTaskIds={d.selectedTaskIds}
              onSelectTask={d.selectTask}
              onToggleTaskId={handleToggleTaskId}
              onToggleAll={handleToggleAll}
              onCreateSprint={() => d.setShowSprintModal(true)}
              onEditSprint={(sprint) => d.setEditingSprint(sprint)}
              onDeleteSprint={d.handleDeleteSprint}
              onPlanSprints={() => d.setShowSprintPlanModal(true)}
              onActivateSprint={d.handleActivateSprint}
              onCloseSprint={(sprintId) => d.setCloseSprintId(sprintId)}
              onAssignSprint={d.handleAssignSprint}
              onReorderTask={d.handleReorderTask}
              hasMore={d.hasMore}
              onLoadMore={d.loadMoreTasks}
              showArchived={filtering.showArchived}
              onToggleShowArchived={() => filtering.setShowArchived(!filtering.showArchived)}
              epicMap={d.epicMap}
            />
          ) : d.view === 'calendar' ? (
            <CalendarView
              tasks={filtering.filteredTasks}
              selectedTask={d.selectedTask}
              onSelectTask={d.selectTask}
            />
          ) : d.view === 'table' ? (
            <TableView
              tasks={filtering.filteredTasks}
              sprints={d.sprints}
              orgUsers={d.orgUsers}
              selectedTask={d.selectedTask}
              selectedTaskIds={d.selectedTaskIds}
              statuses={d.projectStatuses}
              onSelectTask={d.selectTask}
              onToggleTaskId={handleToggleTaskId}
              onToggleAll={handleToggleAll}
              onStatusChange={handleStatusChange}
              onAssignUser={handleAssignUser}
              onDueDateChange={handleDueDateChange}
              onAssignSprint={handleAssignSprint}
            />
          ) : d.activeSprint ? (
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
                  columns={parseColumns(d.activeSprint.columns)}
                  tasks={filtering.filteredTasks.filter((t) => t.sprintId === d.activeSprint!.sprintId && !t.archived)}
                  subtasks={d.subtasks}
                  selectedTask={d.selectedTask}
                  onSelectTask={d.selectTask}
                  onColumnChange={d.handleSprintColumnChange}
                  epicMap={d.epicMap}
                  groupBy={groupBy}
                  orgUsers={d.orgUsers}
                  wipLimits={d.activeSprint.wipLimits ? (() => { try { return JSON.parse(d.activeSprint.wipLimits!); } catch { return undefined; } })() : undefined}
                />
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <p className="text-slate-500 dark:text-slate-300 text-sm">No active sprint. Set a sprint as active to see the board.</p>
                <button
                  type="button"
                  onClick={() => d.setShowSprintModal(true)}
                  className="text-sm text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800"
                >
                  + Create Sprint
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: task detail panel — sidebar on md+, full-screen drawer on mobile */}
        {d.selectedTask && (
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
                  task={d.selectedTask}
                  subtasks={d.subtasks[d.selectedTask.taskId] ?? []}
                  onClose={() => d.setSelectedTask(null)}
                  {...detailPanelProps}
                />
              </div>
            </div>

            {/* Mobile drawer overlay */}
            <div className="md:hidden fixed inset-0 z-40 flex">
              {/* Backdrop */}
              <div
                className="absolute inset-0 bg-black/50 transition-opacity"
                onClick={() => d.setSelectedTask(null)}
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
                    onClick={() => d.setSelectedTask(null)}
                    className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-1"
                    aria-label="Close"
                  >
                    <IconClose className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto">
                  <TaskDetailPanel
                    task={d.selectedTask}
                    subtasks={d.subtasks[d.selectedTask.taskId] ?? []}
                    onClose={() => d.setSelectedTask(null)}
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
        selectedCount={d.selectedTaskIds.size}
        statuses={d.projectStatuses}
        sprints={d.sprints}
        orgUsers={d.orgUsers}
        onBulkUpdate={handleBulkUpdate}
        onClearSelection={() => d.setSelectedTaskIds(new Set())}
      />

      {/* Sprint create modal */}
      {d.showSprintModal && d.projectId && (
        <Suspense fallback={lazyFallback}>
          <SprintCreateModal
            projectId={d.projectId}
            onCreated={d.handleCreateSprint}
            onClose={() => d.setShowSprintModal(false)}
          />
        </Suspense>
      )}

      {/* Sprint edit modal */}
      {d.editingSprint && d.projectId && (
        <Suspense fallback={lazyFallback}>
          <SprintCreateModal
            projectId={d.projectId}
            initialSprint={d.editingSprint}
            onCreated={d.handleCreateSprint}
            onUpdated={d.handleSprintUpdated}
            onClose={() => d.setEditingSprint(null)}
          />
        </Suspense>
      )}

      {/* Sprint plan modal */}
      {d.showSprintPlanModal && d.projectId && (
        <Suspense fallback={lazyFallback}>
          <SprintPlanModal
            projectId={d.projectId}
            tasks={d.tasks}
            onCreated={d.handleSprintPlanCreated}
            onTasksUpdated={d.loadTasks}
            onClose={() => d.setShowSprintPlanModal(false)}
          />
        </Suspense>
      )}

      {/* Close sprint modal */}
      {d.closeSprintId && (() => {
        const closingSprint = d.sprints.find((s) => s.sprintId === d.closeSprintId);
        if (!closingSprint) return null;
        return (
          <Suspense fallback={lazyFallback}>
            <CloseSprintModal
              sprint={closingSprint}
              sprintTasks={d.tasks.filter((t) => t.sprintId === d.closeSprintId)}
              otherSprints={d.sprints.filter((s) => !s.closedAt && s.sprintId !== d.closeSprintId)}
              onClosed={d.handleSprintClosed}
              onActivateNext={d.handleActivateSprint}
              onCreateSprint={() => d.setShowSprintModal(true)}
              onClose={() => d.setCloseSprintId(null)}
            />
          </Suspense>
        );
      })()}

      {/* Task plan approval dialog */}
      {d.previewTasks !== null && (
        <Suspense fallback={lazyFallback}>
          <TaskPlanApprovalDialog
            tasks={d.previewTasks}
            loading={d.previewLoading}
            error={d.previewError}
            onApprove={d.handleCommitPlan}
            onRedo={(ctx) => d.openPreview(ctx)}
            onAddMore={(ctx) => d.openPreview(ctx, d.previewTasks!.map((t) => t.title))}
            onCancel={() => { d.setPreviewTasks(null); d.setPreviewError(null); }}
          />
        </Suspense>
      )}

      {/* GitHub repo modal */}
      {activeModal === 'github' && d.projectId && (
        <Suspense fallback={lazyFallback}>
          <GitHubRepoModal
            projectId={d.projectId}
            installations={gitHubInstallations}
            currentRepo={gitHubRepo}
            onConnected={(repo) => { setGitHubRepo(repo); setActiveModal(null); }}
            onDisconnected={() => { setGitHubRepo(null); setActiveModal(null); }}
            onClose={() => setActiveModal(null)}
          />
        </Suspense>
      )}

      {/* Meeting notes dialog */}
      {activeModal === 'meeting-notes' && d.projectId && (
        <Suspense fallback={lazyFallback}>
          <MeetingNotesDialog
            projectId={d.projectId}
            onTasksCreated={() => { d.loadTasks(); setActiveModal(null); }}
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
                await d.handleAssignSprint(taskId, null);
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
              await d.handleParseBugReport(bugReport);
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
            onPreview={d.handlePreviewPRD}
            onCommit={async (epics) => {
              await d.handleCommitPRD(epics);
              addToast('success', 'Tasks created from PRD');
            }}
            onClose={() => setActiveModal(null)}
          />
        </Suspense>
      )}

      {/* Knowledge base modal */}
      <Suspense fallback={lazyFallback}>
        <KnowledgeBaseModal
          isOpen={activeModal === 'knowledge-base'}
          onClose={() => setActiveModal(null)}
          knowledgeBase={d.project?.knowledgeBase ?? null}
          onSave={(kb) => d.handleUpdateProject({ knowledgeBase: kb })}
          onRefreshFromRepo={d.handleRefreshRepoProfile}
          hasGitHubRepo={!!(d.project?.githubRepositoryName)}
        />
      </Suspense>

      {/* Project settings modal */}
      {activeModal === 'project-settings' && d.projectId && (
        <Suspense fallback={lazyFallback}>
          <ProjectSettingsModal
            projectId={d.projectId}
            orgUsers={d.orgUsers}
            onClose={() => setActiveModal(null)}
          />
        </Suspense>
      )}

      {/* Action plan dialog */}
      {d.actionPlanPreview && d.selectedTask && (
        <Suspense fallback={lazyFallback}>
          <ActionPlanDialog
            preview={d.actionPlanPreview}
            onCommitAndExecute={async (actions) => {
              const plan = await d.handleCommitActionPlan(d.selectedTask!.taskId, actions);
              if (plan) {
                await d.handleExecuteActionPlan(plan.id);
              }
            }}
            onClose={() => d.setActionPlanPreview(null)}
          />
        </Suspense>
      )}

      {/* Release create modal */}
      {d.showReleaseCreateModal && (
        <Suspense fallback={lazyFallback}>
          <ReleaseModal
            onSubmit={d.createRelease}
            onClose={() => d.setShowReleaseCreateModal(false)}
          />
        </Suspense>
      )}

      {/* Keyboard shortcut help */}
      {activeModal === 'shortcut-help' && <KeyboardShortcutHelp onClose={() => setActiveModal(null)} />}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Confirm dialog for nav-away during AI generation */}
      <d.ConfirmDialogPortal />
    </div>
  );
}
