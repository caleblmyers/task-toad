import { useRef, useState, useEffect, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { useProjectData } from '../hooks/useProjectData';
import { useTaskFiltering } from '../hooks/useTaskFiltering';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import type { Activity, GitHubRepoLink, GitHubInstallation } from '../types';
import KanbanBoard from '../components/KanbanBoard';
import TaskDetailPanel from '../components/TaskDetailPanel';
import BacklogView from '../components/BacklogView';
import TableView from '../components/TableView';
import CalendarView from '../components/CalendarView';
import BulkActionBar from '../components/BulkActionBar';
import ProjectDashboard from '../components/ProjectDashboard';
import { lazyWithRetry } from '../utils/lazyWithRetry';

// Lazy-load heavy modals — only rendered on user action
const GanttChart = lazyWithRetry(() => import('../components/GanttChart'));
const TaskPlanApprovalDialog = lazyWithRetry(() => import('../components/TaskPlanApprovalDialog'));
const CloseSprintModal = lazyWithRetry(() => import('../components/CloseSprintModal'));
const ProjectSettingsModal = lazyWithRetry(() => import('../components/ProjectSettingsModal'));
const CodePreviewModal = lazyWithRetry(() => import('../components/CodePreviewModal'));
const SprintCreateModal = lazyWithRetry(() => import('../components/SprintCreateModal'));
const SprintPlanModal = lazyWithRetry(() => import('../components/SprintPlanModal'));
const GitHubRepoModal = lazyWithRetry(() => import('../components/GitHubRepoModal'));
const StandupReportPanel = lazyWithRetry(() => import('../components/StandupReportPanel'));
const ProjectHealthPanel = lazyWithRetry(() => import('../components/ProjectHealthPanel'));
const TrendAnalysisPanel = lazyWithRetry(() => import('../components/TrendAnalysisPanel'));
const MeetingNotesDialog = lazyWithRetry(() => import('../components/MeetingNotesDialog'));
const CSVImportModal = lazyWithRetry(() => import('../components/CSVImportModal'));
const KnowledgeBaseModal = lazyWithRetry(() => import('../components/KnowledgeBaseModal'));
const BugReportModal = lazyWithRetry(() => import('../components/BugReportModal'));
const PRDBreakdownModal = lazyWithRetry(() => import('../components/PRDBreakdownModal'));
const SprintTransitionModal = lazyWithRetry(() => import('../components/SprintTransitionModal'));
import { TaskListSkeleton, KanbanBoardSkeleton } from '../components/Skeleton';
import SearchInput from '../components/shared/SearchInput';
import FilterBar from '../components/shared/FilterBar';
import ToastContainer from '../components/shared/ToastContainer';
import KeyboardShortcutHelp from '../components/shared/KeyboardShortcutHelp';
import Button from '../components/shared/Button';
import { IconList, IconBoard, IconTable, IconCalendar, IconClose, IconPlus, IconRefresh, IconSummary, IconFilter, IconKeyboard, IconGitHub } from '../components/shared/Icons';
import { TOKEN_KEY } from '../api/client';
import { statusLabel } from '../utils/taskHelpers';
import { parseColumns } from '../utils/jsonHelpers';

const activeClass = 'px-3 py-1 text-sm rounded-md bg-white text-slate-800 font-medium shadow-sm';
const inactiveClass = 'px-3 py-1 text-sm rounded-md text-slate-500 hover:text-slate-700';

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
  const searchRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [editProjectNameValue, setEditProjectNameValue] = useState('');
  const [showStatusEditor, setShowStatusEditor] = useState(false);
  const [newStatusValue, setNewStatusValue] = useState('');
  const [projectActivities, setProjectActivities] = useState<Activity[]>([]);
  const [showStandup, setShowStandup] = useState(false);
  const [showHealth, setShowHealth] = useState(false);
  const [showMeetingNotes, setShowMeetingNotes] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [gitHubRepo, setGitHubRepo] = useState<GitHubRepoLink | null>(null);
  const [gitHubInstallations, setGitHubInstallations] = useState<GitHubInstallation[]>([]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const [showPRDBreakdown, setShowPRDBreakdown] = useState(false);
  const [showTransition, setShowTransition] = useState<{ sprintId: string; sprintName: string } | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [timelineView, setTimelineView] = useState(false);
  const [showTrends, setShowTrends] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templateList, setTemplateList] = useState<Array<{ taskTemplateId: string; name: string; description: string | null; instructions: string | null; acceptanceCriteria: string | null; priority: string; taskType: string }>>([]);
  const [templateTitle, setTemplateTitle] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const templateBtnRef = useRef<HTMLButtonElement>(null);

  useKeyboardShortcuts({
    tasks: filtering.filteredTasks,
    selectedTask: d.selectedTask,
    onSelectTask: d.selectTask,
    onCloseTask: () => d.setSelectedTask(null),
    onNewTask: () => d.setShowAddForm(true),
    onFocusSearch: () => searchRef.current?.focus(),
    onShowHelp: () => setShowShortcutHelp((v) => !v),
    enabled: !d.isGenerating,
  });

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

  // Close template menu on Escape or click-outside
  useEffect(() => {
    if (!showTemplateMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTemplateMenu(false);
        templateBtnRef.current?.focus();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplateMenu(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTemplateMenu]);

  // Load project-level activities when switching to dashboard
  const loadProjectActivities = async () => {
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

  const handleProjectNameSave = async () => {
    if (!editProjectNameValue.trim()) return;
    setEditingProjectName(false);
    await d.handleUpdateProject({ name: editProjectNameValue });
    addToast('success', 'Project name updated');
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

  const handleAddStatus = () => {
    const slug = newStatusValue.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!slug || d.projectStatuses.includes(slug)) return;
    const updated = [...d.projectStatuses, slug];
    d.handleUpdateProject({ statuses: JSON.stringify(updated) });
    setNewStatusValue('');
  };

  const handleRemoveStatus = (status: string) => {
    if (d.projectStatuses.length <= 1) return;
    const updated = d.projectStatuses.filter((s) => s !== status);
    d.handleUpdateProject({ statuses: JSON.stringify(updated) });
  };

  const downloadExport = async (path: string, filename: string) => {
    const token = localStorage.getItem(TOKEN_KEY);
    const res = await fetch(`/api/export/${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCSVImport = async (tasks: Array<{ title: string; description?: string; status?: string; priority?: string }>) => {
    await d.handleBulkCreateTasks(tasks);
    addToast('success', `Imported ${tasks.length} tasks`);
    setShowCSVImport(false);
  };

  const loadTemplates = async () => {
    if (!d.projectId) return;
    try {
      const data = await gql<{ taskTemplates: typeof templateList }>(
        `query TaskTemplates($projectId: ID) { taskTemplates(projectId: $projectId) { taskTemplateId name description instructions acceptanceCriteria priority taskType } }`,
        { projectId: d.projectId },
      );
      setTemplateList(data.taskTemplates);
    } catch { /* non-critical */ }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplateId || !templateTitle.trim() || !d.projectId) return;
    try {
      await gql<{ createTaskFromTemplate: { taskId: string } }>(
        `mutation CreateFromTemplate($templateId: ID!, $projectId: ID!, $title: String!) {
          createTaskFromTemplate(templateId: $templateId, projectId: $projectId, title: $title) { taskId }
        }`,
        { templateId: selectedTemplateId, projectId: d.projectId, title: templateTitle.trim() },
      );
      addToast('success', 'Task created from template');
      setShowTemplateMenu(false);
      setTemplateTitle('');
      setSelectedTemplateId(null);
      d.loadTasks();
    } catch (err) {
      addToast('error', err instanceof Error ? err.message : 'Failed to create task');
    }
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
    onGenerateCode: d.handleGenerateCode,
    generatingCode: d.generatingCode,
    onAssignSprint: handleAssignSprint,
    onAssignUser: handleAssignUser,
    onDueDateChange: handleDueDateChange,
    onUpdateDependencies: d.handleUpdateDependencies,
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
    onArchiveTask: async (taskId: string, archived: boolean) => {
      await d.handleArchiveTask(taskId, archived);
      addToast('success', archived ? 'Task archived' : 'Task unarchived');
    },
  };

  const viewToggle = (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
      <button onClick={() => { d.switchView('backlog'); setTimelineView(false); }} className={d.view === 'backlog' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating}>
        <span className="flex items-center gap-1"><IconList className="w-3.5 h-3.5" /> Backlog</span>
      </button>
      <button onClick={() => { d.switchView('board'); setTimelineView(false); }} className={d.view === 'board' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating}>
        <span className="flex items-center gap-1"><IconBoard className="w-3.5 h-3.5" /> Board</span>
      </button>
      <button onClick={() => { d.switchView('table'); setTimelineView(false); }} className={d.view === 'table' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating}>
        <span className="flex items-center gap-1"><IconTable className="w-3.5 h-3.5" /> Table</span>
      </button>
      <button onClick={() => { d.switchView('calendar'); setTimelineView(false); }} className={d.view === 'calendar' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating}>
        <span className="flex items-center gap-1"><IconCalendar className="w-3.5 h-3.5" /> Calendar</span>
      </button>
      <button onClick={() => { d.switchView('calendar'); setTimelineView(true); }} className={timelineView ? activeClass : inactiveClass} disabled={d.isGenerating}>
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="14" height="2" rx="0.5" /><rect x="4" y="7" width="10" height="2" rx="0.5" /><rect x="2" y="11" width="8" height="2" rx="0.5" /></svg>
          Timeline
        </span>
      </button>
      <button onClick={() => { d.switchView('dashboard'); setTimelineView(false); loadProjectActivities(); }} className={d.view === 'dashboard' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating}>
        <span className="flex items-center gap-1">📊 Dashboard</span>
      </button>
    </div>
  );

  return (
    <div className="flex flex-col h-full -m-6">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/app/projects" className={`text-sm text-slate-500 hover:text-slate-700 ${d.isGenerating ? 'pointer-events-none opacity-50' : ''}`}>
            ← Projects
          </Link>
          <span className="text-slate-300">/</span>
          {editingProjectName ? (
            <input
              type="text"
              value={editProjectNameValue}
              onChange={(e) => setEditProjectNameValue(e.target.value)}
              onBlur={handleProjectNameSave}
              onKeyDown={(e) => { if (e.key === 'Enter') handleProjectNameSave(); if (e.key === 'Escape') setEditingProjectName(false); }}
              className="text-sm font-semibold text-slate-800 border-b-2 border-slate-400 focus:outline-none bg-transparent w-48"
              autoFocus
            />
          ) : (
            <h1
              className="text-sm font-semibold text-slate-800 cursor-text hover:underline decoration-dashed"
              onClick={() => {
                setEditProjectNameValue(d.project?.name ?? '');
                setEditingProjectName(true);
              }}
              title="Click to edit project name"
            >
              {d.project?.name ?? 'Tasks'}
            </h1>
          )}
          <button
            type="button"
            onClick={() => setShowStatusEditor((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600 px-1"
            title="Manage statuses"
          >
            ⚙
          </button>
          {viewToggle}
          <SearchInput
            ref={searchRef}
            value={filtering.searchQuery}
            onChange={filtering.setSearchQuery}
            placeholder="Search tasks…"
            className="w-48"
          />
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1 text-sm px-2 py-1 rounded-md transition-colors ${filtering.hasActiveFilters || showFilters ? 'text-slate-800 bg-slate-100' : 'text-slate-500 hover:text-slate-700'}`}
            title="Toggle filters"
          >
            <IconFilter className="w-3.5 h-3.5" />
            {filtering.hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowProjectSettings(true)}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-600 px-1.5 py-1 text-sm"
            title="Project Settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
          </button>
          <button
            type="button"
            onClick={() => setShowKnowledgeBase(true)}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-600 px-1.5 py-1 text-sm"
            title="Project Knowledge Base"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>
            KB
          </button>
          <button
            type="button"
            onClick={() => setShowGitHubModal(true)}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-600 px-1.5 py-1"
            title={gitHubRepo ? `${gitHubRepo.repositoryOwner}/${gitHubRepo.repositoryName}` : 'Connect GitHub repo'}
          >
            <IconGitHub className="w-4 h-4" />
            {gitHubRepo && (
              <span className="text-xs text-slate-500">{gitHubRepo.repositoryOwner}/{gitHubRepo.repositoryName}</span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setShowShortcutHelp((v) => !v)}
            className="text-slate-400 hover:text-slate-600 px-1.5 py-1"
            title="Keyboard shortcuts (?)"
          >
            <IconKeyboard className="w-4 h-4" />
          </button>
          <Button variant="ghost" size="sm" onClick={() => d.setShowAddForm(!d.showAddForm)} disabled={d.isGenerating}>
            {d.showAddForm ? <><IconClose className="w-3.5 h-3.5" /> Cancel</> : <><IconPlus className="w-3.5 h-3.5" /> Add task</>}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => d.openPreview()} disabled={d.isGenerating}>
            <IconRefresh className="w-3.5 h-3.5" />
            {d.previewLoading ? 'Planning…' : 'Regenerate'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { d.handleSummarize(); d.setShowAddForm(false); }} disabled={d.isGenerating}>
            <IconSummary className="w-3.5 h-3.5" />
            {d.summarizing ? 'Summarizing…' : 'Summarize'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowStandup(true); setShowHealth(false); setShowTrends(false); d.setSummary(null); }} disabled={d.isGenerating}>
            Standup
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowHealth(true); setShowStandup(false); setShowTrends(false); d.setSummary(null); }} disabled={d.isGenerating}>
            Health
          </Button>
          <Button variant="ghost" size="sm" onClick={() => { setShowTrends(true); setShowHealth(false); setShowStandup(false); d.setSummary(null); }} disabled={d.isGenerating}>
            Trends
          </Button>
          {d.activeSprint && (
            <Button variant="ghost" size="sm" onClick={() => setShowTransition({ sprintId: d.activeSprint!.sprintId, sprintName: d.activeSprint!.name })} disabled={d.isGenerating}>
              Transition
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => setShowMeetingNotes(true)} disabled={d.isGenerating}>
            Notes
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowBugReport(true)} disabled={d.isGenerating}>
            Bug
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setShowPRDBreakdown(true)} disabled={d.isGenerating}>
            PRD
          </Button>
          {gitHubRepo && d.rootTasks.length < 5 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                if (!confirm('Analyze linked repo and generate initial tasks?')) return;
                setBootstrapping(true);
                try {
                  await d.handleBootstrapFromRepo();
                  addToast('success', 'Tasks generated from repo');
                } catch (err) {
                  addToast('error', err instanceof Error ? err.message : 'Bootstrap failed');
                } finally {
                  setBootstrapping(false);
                }
              }}
              disabled={d.isGenerating || bootstrapping}
            >
              {bootstrapping ? 'Bootstrapping...' : 'Bootstrap'}
            </Button>
          )}
          <div className="relative" ref={templateMenuRef}>
            <Button ref={templateBtnRef} variant="ghost" size="sm" onClick={() => { setShowTemplateMenu((v) => !v); if (!showTemplateMenu) loadTemplates(); }} disabled={d.isGenerating}>
              Template
            </Button>
            {showTemplateMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-2 z-50 min-w-[260px] p-3 space-y-2">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Create from template</p>
                {templateList.length === 0 ? (
                  <p className="text-xs text-slate-400">No templates. Create one in Project Settings.</p>
                ) : (
                  <>
                    <select
                      value={selectedTemplateId ?? ''}
                      onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                      className="w-full text-sm border border-slate-300 rounded px-2 py-1"
                    >
                      <option value="">Select template...</option>
                      {templateList.map((t) => (
                        <option key={t.taskTemplateId} value={t.taskTemplateId}>{t.name}</option>
                      ))}
                    </select>
                    {selectedTemplateId && (
                      <>
                        <input
                          type="text"
                          value={templateTitle}
                          onChange={(e) => setTemplateTitle(e.target.value)}
                          placeholder="Task title"
                          className="w-full text-sm border border-slate-300 rounded px-2 py-1.5"
                          autoFocus
                        />
                        <button
                          onClick={handleCreateFromTemplate}
                          disabled={!templateTitle.trim()}
                          className="w-full px-3 py-1.5 bg-brand-green text-white text-sm rounded hover:bg-brand-green-hover disabled:opacity-50"
                        >
                          Create Task
                        </button>
                      </>
                    )}
                  </>
                )}
                <button
                  onClick={() => setShowTemplateMenu(false)}
                  className="text-xs text-slate-400 hover:text-slate-600"
                >
                  Close
                </button>
              </div>
            )}
          </div>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setShowExportMenu((v) => !v)}>
              Import/Export
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => { downloadExport(`project/${d.projectId}/csv`, `${d.project?.name ?? 'tasks'}.csv`); setShowExportMenu(false); }}
                >
                  Export Tasks (CSV)
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => { downloadExport(`project/${d.projectId}/json`, `${d.project?.name ?? 'tasks'}.json`); setShowExportMenu(false); }}
                >
                  Export Tasks (JSON)
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => { downloadExport(`project/${d.projectId}/activity/csv`, `${d.project?.name ?? 'activity'}-activity.csv`); setShowExportMenu(false); }}
                >
                  Export Activity (CSV)
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => { downloadExport(`project/${d.projectId}/activity/json`, `${d.project?.name ?? 'activity'}-activity.json`); setShowExportMenu(false); }}
                >
                  Export Activity (JSON)
                </button>
                <hr className="my-1 border-slate-100" />
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
                  onClick={() => { setShowCSVImport(true); setShowExportMenu(false); }}
                >
                  Import CSV
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Status editor */}
      {showStatusEditor && (
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex-shrink-0 animate-fade-in">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Statuses:</span>
            {d.projectStatuses.map((s) => (
              <span key={s} className="inline-flex items-center gap-1 text-xs bg-white border border-slate-200 px-2 py-0.5 rounded">
                {statusLabel(s)}
                {d.projectStatuses.length > 1 && (
                  <button onClick={() => handleRemoveStatus(s)} className="text-slate-400 hover:text-red-500">✕</button>
                )}
              </span>
            ))}
            <input
              type="text"
              value={newStatusValue}
              onChange={(e) => setNewStatusValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddStatus(); }}
              placeholder="Add status…"
              className="text-xs border border-slate-300 rounded px-2 py-0.5 w-28 focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
            <button onClick={handleAddStatus} className="text-xs text-slate-500 hover:text-slate-700">Add</button>
          </div>
        </div>
      )}

      {/* Filter bar */}
      {showFilters && (
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex-shrink-0 animate-fade-in">
          <FilterBar
            statusFilter={filtering.statusFilter}
            priorityFilter={filtering.priorityFilter}
            assigneeFilter={filtering.assigneeFilter}
            orgUsers={d.orgUsers}
            statuses={d.projectStatuses}
            labels={d.labels}
            labelFilter={filtering.labelFilter}
            onLabelChange={filtering.setLabelFilter}
            onStatusChange={filtering.setStatusFilter}
            onPriorityChange={filtering.setPriorityFilter}
            onAssigneeChange={filtering.setAssigneeFilter}
            onClear={filtering.clearFilters}
            hasActiveFilters={filtering.hasActiveFilters}
          />
        </div>
      )}

      {/* Inline add form */}
      {d.showAddForm && !d.isGenerating && (
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-100 flex-shrink-0">
          <form onSubmit={d.handleAddTask} className="flex items-center gap-2">
            <input
              type="text"
              value={d.newTaskTitle}
              onChange={(e) => d.setNewTaskTitle(e.target.value)}
              placeholder="Task title"
              className="flex-1 max-w-sm px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-brand-green"
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
          {showStandup && d.projectId ? (
            <Suspense fallback={lazyFallback}>
              <StandupReportPanel
                projectId={d.projectId}
                disabled={d.isGenerating}
                onClose={() => setShowStandup(false)}
              />
            </Suspense>
          ) : showHealth && d.projectId ? (
            <Suspense fallback={lazyFallback}>
              <ProjectHealthPanel
                projectId={d.projectId}
                disabled={d.isGenerating}
                onClose={() => setShowHealth(false)}
              />
            </Suspense>
          ) : showTrends && d.projectId ? (
            <Suspense fallback={lazyFallback}>
              <TrendAnalysisPanel
                projectId={d.projectId}
                disabled={d.isGenerating}
                onClose={() => setShowTrends(false)}
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
                <p className="text-slate-700 leading-relaxed">{d.summary}</p>
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
            <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
              <KanbanBoard
                columns={parseColumns(d.activeSprint.columns)}
                tasks={filtering.filteredTasks.filter((t) => t.sprintId === d.activeSprint!.sprintId && !t.archived)}
                subtasks={d.subtasks}
                selectedTask={d.selectedTask}
                onSelectTask={d.selectTask}
                onColumnChange={d.handleSprintColumnChange}
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-3">
                <p className="text-slate-500 text-sm">No active sprint. Set a sprint as active to see the board.</p>
                <button
                  type="button"
                  onClick={() => d.setShowSprintModal(true)}
                  className="text-sm text-slate-600 hover:text-slate-800 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
                >
                  + Create Sprint
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: task detail panel */}
        {d.selectedTask && (
          <div className="w-[440px] flex-shrink-0 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
            <div className="px-4 pt-2 pb-1 border-b border-slate-100 flex-shrink-0">
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
              sprintTasks={d.tasks.filter((t) => t.sprintId === d.closeSprintId && !t.parentTaskId)}
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
      {showGitHubModal && d.projectId && (
        <Suspense fallback={lazyFallback}>
          <GitHubRepoModal
            projectId={d.projectId}
            installations={gitHubInstallations}
            currentRepo={gitHubRepo}
            onConnected={(repo) => { setGitHubRepo(repo); setShowGitHubModal(false); }}
            onDisconnected={() => { setGitHubRepo(null); setShowGitHubModal(false); }}
            onClose={() => setShowGitHubModal(false)}
          />
        </Suspense>
      )}

      {/* Code preview modal */}
      <Suspense fallback={lazyFallback}>
        <CodePreviewModal
          isOpen={d.generatedCode !== null}
          onClose={() => d.setGeneratedCode(null)}
          files={d.generatedCode?.files ?? []}
          summary={d.generatedCode?.summary ?? ''}
          estimatedTokensUsed={d.generatedCode?.estimatedTokensUsed ?? 0}
          onCreatePR={d.handleCreatePR}
          isCreatingPR={d.creatingPR}
          delegationHint={d.generatedCode?.delegationHint}
        />
      </Suspense>

      {/* Meeting notes dialog */}
      {showMeetingNotes && d.projectId && (
        <Suspense fallback={lazyFallback}>
          <MeetingNotesDialog
            projectId={d.projectId}
            onTasksCreated={() => { d.loadTasks(); setShowMeetingNotes(false); }}
            onClose={() => setShowMeetingNotes(false)}
          />
        </Suspense>
      )}

      {/* CSV Import modal */}
      {showCSVImport && (
        <Suspense fallback={lazyFallback}>
          <CSVImportModal
            onImport={handleCSVImport}
            onClose={() => setShowCSVImport(false)}
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
              // Move deprioritized tasks to backlog (remove sprint)
              for (const taskId of deprioritizeIds) {
                await d.handleAssignSprint(taskId, null);
              }
              // Carry over tasks stay in sprint — they'll be moved when the sprint is closed
              addToast('success', `${carryOverIds.length} tasks carried over, ${deprioritizeIds.length} moved to backlog`);
            }}
            onClose={() => setShowTransition(null)}
          />
        </Suspense>
      )}

      {/* Bug report modal */}
      {showBugReport && (
        <Suspense fallback={lazyFallback}>
          <BugReportModal
            onSubmit={async (bugReport) => {
              await d.handleParseBugReport(bugReport);
              addToast('success', 'Bug report parsed and task created');
            }}
            onClose={() => setShowBugReport(false)}
          />
        </Suspense>
      )}

      {/* PRD breakdown modal */}
      {showPRDBreakdown && (
        <Suspense fallback={lazyFallback}>
          <PRDBreakdownModal
            onPreview={d.handlePreviewPRD}
            onCommit={async (epics) => {
              await d.handleCommitPRD(epics);
              addToast('success', 'Tasks created from PRD');
            }}
            onClose={() => setShowPRDBreakdown(false)}
          />
        </Suspense>
      )}

      {/* Knowledge base modal */}
      <Suspense fallback={lazyFallback}>
        <KnowledgeBaseModal
          isOpen={showKnowledgeBase}
          onClose={() => setShowKnowledgeBase(false)}
          knowledgeBase={d.project?.knowledgeBase ?? null}
          onSave={(kb) => d.handleUpdateProject({ knowledgeBase: kb })}
        />
      </Suspense>

      {/* Project settings modal */}
      {showProjectSettings && d.projectId && (
        <Suspense fallback={lazyFallback}>
          <ProjectSettingsModal
            projectId={d.projectId}
            orgUsers={d.orgUsers}
            onClose={() => setShowProjectSettings(false)}
          />
        </Suspense>
      )}

      {/* Keyboard shortcut help */}
      {showShortcutHelp && <KeyboardShortcutHelp onClose={() => setShowShortcutHelp(false)} />}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
