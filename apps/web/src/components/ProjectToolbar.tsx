import { useRef, useState, useEffect, useCallback } from 'react';
import { useConfirmDialog } from './shared/ConfirmDialog';
import { Link } from 'react-router-dom';
import { gql } from '../api/client';
import { AUTO_START_PROJECT_MUTATION } from '../api/queries';
import type { ProjectData } from '../hooks/useProjectData';
import type { TaskFiltering } from '../hooks/useTaskFiltering';
import type { GitHubRepoLink } from '../types';
import { statusLabel } from '../utils/taskHelpers';
import SearchInput from './shared/SearchInput';
import FilterBar, { type SavedFilter } from './shared/FilterBar';
import SavedViewPicker from './shared/SavedViewPicker';
import Button from './shared/Button';
import DropdownMenu, { type DropdownMenuItem } from './shared/DropdownMenu';
import { IconList, IconBoard, IconTable, IconCalendar, IconClose, IconPlus, IconRefresh, IconSummary, IconFilter, IconKeyboard, IconGitHub, IconSparkle, IconClock } from './shared/Icons';
import { useFocusTrap } from '../hooks/useFocusTrap';

const activeClass = 'px-3 py-1 text-sm rounded-md bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 font-medium shadow-sm';
const inactiveClass = 'px-3 py-1 text-sm rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200';

interface ProjectToolbarProps {
  d: ProjectData;
  filtering: TaskFiltering;
  searchRef: React.RefObject<HTMLInputElement | null>;
  timelineView: boolean;
  setTimelineView: (v: boolean) => void;
  gitHubRepo: GitHubRepoLink | null;
  addToast: (type: 'success' | 'error', message: string) => void;
  onOpenModal: (modal: string) => void;
  onLoadProjectActivities: () => void;
}

export default function ProjectToolbar({
  d,
  filtering,
  searchRef,
  timelineView,
  setTimelineView,
  gitHubRepo,
  addToast,
  onOpenModal,
  onLoadProjectActivities,
}: ProjectToolbarProps) {
  const { confirm, ConfirmDialogPortal } = useConfirmDialog();
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [editProjectNameValue, setEditProjectNameValue] = useState('');
  const [showStatusEditor, setShowStatusEditor] = useState(false);
  const [newStatusValue, setNewStatusValue] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>([]);

  // Fetch saved filters on mount
  const fetchSavedFilters = useCallback(async () => {
    if (!d.projectId) return;
    try {
      const data = await gql<{ savedFilters: SavedFilter[] }>(
        `query SavedFilters($projectId: ID!) { savedFilters(projectId: $projectId) { savedFilterId name filters viewType sortBy sortOrder groupBy visibleColumns isShared isDefault createdAt } }`,
        { projectId: d.projectId },
      );
      setSavedFilters(data.savedFilters);
    } catch { /* non-critical */ }
  }, [d.projectId]);

  useEffect(() => { fetchSavedFilters(); }, [fetchSavedFilters]);

  // Wire up view config callback so loading a view can switch the active tab
  useEffect(() => {
    filtering.setOnViewConfigApplied((config) => {
      const viewMap: Record<string, 'backlog' | 'board' | 'table'> = { list: 'backlog', board: 'board', table: 'table' };
      if (config.viewType && viewMap[config.viewType]) {
        d.switchView(viewMap[config.viewType]);
        setTimelineView(false);
      }
    });
    return () => filtering.setOnViewConfigApplied(undefined);
  }, [d, filtering, setTimelineView]);

  const handleLoadFilter = useCallback((filtersJson: string, viewConfig?: { viewType?: string | null; sortBy?: string | null; sortOrder?: string | null; groupBy?: string | null }) => {
    filtering.loadSavedFilter(filtersJson, viewConfig);
  }, [filtering]);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templateList, setTemplateList] = useState<Array<{ taskTemplateId: string; name: string; description: string | null; instructions: string | null; acceptanceCriteria: string | null; priority: string; taskType: string }>>([]);
  const [templateTitle, setTemplateTitle] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [autoStarting, setAutoStarting] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const templateSelectRef = useRef<HTMLSelectElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const exportItemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [activeExportIndex, setActiveExportIndex] = useState(0);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  const { handleFocusTrapKeyDown: handleTemplateTrapKeyDown } = useFocusTrap(templateMenuRef, showTemplateMenu);
  const { handleFocusTrapKeyDown: handleExportTrapKeyDown } = useFocusTrap(exportMenuRef, showExportMenu);

  // Close template menu on Escape or click-outside
  useEffect(() => {
    if (!showTemplateMenu) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowTemplateMenu(false);
        previousFocusRef.current?.focus();
      }
    };
    const handleClickOutside = (e: MouseEvent) => {
      if (templateMenuRef.current && !templateMenuRef.current.contains(e.target as Node)) {
        setShowTemplateMenu(false);
        previousFocusRef.current?.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTemplateMenu]);

  // Close export menu on click-outside
  useEffect(() => {
    if (!showExportMenu) return;
    setActiveExportIndex(0);
    const handleClickOutside = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
        previousFocusRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showExportMenu]);

  const handleProjectNameSave = async () => {
    if (!editProjectNameValue.trim()) return;
    setEditingProjectName(false);
    await d.handleUpdateProject({ name: editProjectNameValue });
    addToast('success', 'Project name updated');
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
    const res = await fetch(`/api/export/${path}`, {
      credentials: 'include',
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadTemplates = useCallback(async () => {
    if (!d.projectId) return;
    try {
      const data = await gql<{ taskTemplates: typeof templateList }>(
        `query TaskTemplates($projectId: ID) { taskTemplates(projectId: $projectId) { taskTemplateId name description instructions acceptanceCriteria priority taskType } }`,
        { projectId: d.projectId },
      );
      setTemplateList(data.taskTemplates);
    } catch { /* non-critical */ }
  }, [d.projectId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const viewToggle = (
    <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
      <button onClick={() => { d.switchView('backlog'); setTimelineView(false); }} className={d.view === 'backlog' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating} title="Backlog">
        <span className="flex items-center gap-1"><IconList className="w-3.5 h-3.5" /><span className="hidden sm:inline">Backlog</span></span>
      </button>
      <button onClick={() => { d.switchView('board'); setTimelineView(false); }} className={d.view === 'board' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating} title="Board">
        <span className="flex items-center gap-1"><IconBoard className="w-3.5 h-3.5" /><span className="hidden sm:inline">Board</span></span>
      </button>
      <button onClick={() => { d.switchView('table'); setTimelineView(false); }} className={d.view === 'table' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating} title="Table">
        <span className="flex items-center gap-1"><IconTable className="w-3.5 h-3.5" /><span className="hidden sm:inline">Table</span></span>
      </button>
      <button onClick={() => { d.switchView('calendar'); setTimelineView(false); }} className={d.view === 'calendar' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating} title="Calendar">
        <span className="flex items-center gap-1"><IconCalendar className="w-3.5 h-3.5" /><span className="hidden sm:inline">Calendar</span></span>
      </button>
      <button onClick={() => { d.switchView('calendar'); setTimelineView(true); }} className={timelineView ? activeClass : inactiveClass} disabled={d.isGenerating} title="Timeline">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="1" y="3" width="14" height="2" rx="0.5" /><rect x="4" y="7" width="10" height="2" rx="0.5" /><rect x="2" y="11" width="8" height="2" rx="0.5" /></svg>
          <span className="hidden sm:inline">Timeline</span>
        </span>
      </button>
      <button onClick={() => { d.switchView('epics'); setTimelineView(false); }} className={d.view === 'epics' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating} title="Epics">
        <span className="flex items-center gap-1">
          <span className="w-2 h-2 rounded-full bg-purple-500 inline-block" />
          <span className="hidden sm:inline">Epics</span>
        </span>
      </button>
      <button onClick={() => { d.switchView('releases'); setTimelineView(false); }} className={d.view === 'releases' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating} title="Releases">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 3h10v10H3z" /><path d="M3 7h10M7 3v10" /></svg>
          <span className="hidden sm:inline">Releases</span>
        </span>
      </button>
      <button onClick={() => { d.switchView('timesheet'); setTimelineView(false); }} className={d.view === 'timesheet' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating} title="Timesheet">
        <span className="flex items-center gap-1"><IconClock className="w-3.5 h-3.5" /><span className="hidden sm:inline">Timesheet</span></span>
      </button>
      <button onClick={() => { d.switchView('dashboard'); setTimelineView(false); onLoadProjectActivities(); }} className={d.view === 'dashboard' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating} title="Dashboard">
        <span className="flex items-center gap-1">📊<span className="hidden sm:inline">Dashboard</span></span>
      </button>
    </div>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/app/projects" className={`text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 ${d.isGenerating ? 'pointer-events-none opacity-50' : ''}`}>
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
              className="text-sm font-semibold text-slate-800 dark:text-slate-200 border-b-2 border-slate-400 focus:outline-none bg-transparent w-48"
              autoFocus
            />
          ) : (
            <h1
              className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-text hover:underline decoration-dashed truncate max-w-[120px] sm:max-w-none"
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
          <div className="hidden sm:block">
            <SearchInput
              ref={searchRef as React.RefObject<HTMLInputElement>}
              value={filtering.searchQuery}
              onChange={filtering.setSearchQuery}
              placeholder="Search tasks…"
              className="w-48"
            />
          </div>
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1 text-sm px-2 py-1 rounded-md transition-colors ${filtering.hasActiveFilters || showFilters ? 'text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            title="Toggle filters"
          >
            <IconFilter className="w-3.5 h-3.5" />
            {filtering.hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
          </button>
          {d.projectId && (
            <SavedViewPicker
              projectId={d.projectId}
              savedFilters={savedFilters}
              onSavedFiltersChange={setSavedFilters}
              onLoadFilter={handleLoadFilter}
              currentViewType={d.view === 'backlog' ? 'list' : d.view === 'board' ? 'board' : d.view === 'table' ? 'table' : undefined}
            />
          )}
        </div>
        <div className="relative flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => d.setShowAddForm(!d.showAddForm)} disabled={d.isGenerating || !d.can('CREATE_TASKS')} title={!d.can('CREATE_TASKS') ? "You don't have permission to create tasks" : undefined}>
            {d.showAddForm ? <><IconClose className="w-3.5 h-3.5" /> Cancel</> : <><IconPlus className="w-3.5 h-3.5" /> Add task</>}
          </Button>

          {/* AI actions dropdown */}
          <DropdownMenu
            trigger={
              <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors text-slate-600 dark:text-slate-300 hover:text-slate-800 dark:hover:text-slate-200">
                <IconSparkle className="w-3.5 h-3.5" />
                AI
                <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 5l3 3 3-3" /></svg>
              </span>
            }
            items={[
              { label: d.previewLoading ? 'Planning…' : 'Regenerate', icon: <IconRefresh className="w-3.5 h-3.5" />, onClick: () => d.openPreview(), disabled: d.isGenerating },
              { label: d.summarizing ? 'Summarizing…' : 'Summarize', icon: <IconSummary className="w-3.5 h-3.5" />, onClick: () => { d.handleSummarize(); d.setShowAddForm(false); }, disabled: d.isGenerating },
              { label: 'Standup', onClick: () => onOpenModal('standup'), disabled: d.isGenerating },
              { label: 'Health', onClick: () => onOpenModal('health'), disabled: d.isGenerating },
              { label: 'Trends', onClick: () => onOpenModal('trends'), disabled: d.isGenerating },
              { label: 'Cycle Time', onClick: () => onOpenModal('cycle-time'), disabled: d.isGenerating },
              ...(d.activeSprint ? [{ label: 'Transition', onClick: () => onOpenModal(`transition:${d.activeSprint!.sprintId}:${d.activeSprint!.name}`), disabled: d.isGenerating }] : []),
              { label: 'Notes', onClick: () => onOpenModal('meeting-notes'), disabled: d.isGenerating },
              { label: 'Bug Report', onClick: () => onOpenModal('bug-report'), disabled: d.isGenerating },
              { label: 'PRD Breakdown', onClick: () => onOpenModal('prd-breakdown'), disabled: d.isGenerating },
              { label: 'Hierarchical Plan', onClick: () => onOpenModal('hierarchical-plan'), disabled: d.isGenerating },
              { label: 'Execution Dashboard', onClick: () => onOpenModal('execution-dashboard') },
              ...(gitHubRepo && d.rootTasks.length < 5 ? [{
                label: bootstrapping ? 'Bootstrapping…' : 'Bootstrap from Repo',
                onClick: async () => {
                  if (!await confirm({ title: 'Bootstrap from repo', message: 'Analyze linked repo and generate initial tasks?', confirmLabel: 'Bootstrap', variant: 'warning' as const })) return;
                  setBootstrapping(true);
                  try {
                    await d.handleBootstrapFromRepo();
                    addToast('success', 'Tasks generated from repo');
                  } catch (err) {
                    addToast('error', err instanceof Error ? err.message : 'Bootstrap failed');
                  } finally {
                    setBootstrapping(false);
                  }
                },
                disabled: d.isGenerating || bootstrapping,
              }] : []),
              ...(gitHubRepo ? [{
                label: autoStarting ? 'Starting…' : 'Auto-Start Project',
                onClick: async () => {
                  if (!d.projectId) return;
                  setAutoStarting(true);
                  try {
                    await gql<{ autoStartProject: { projectId: string } }>(
                      AUTO_START_PROJECT_MUTATION,
                      { projectId: d.projectId }
                    );
                    addToast('success', 'Project auto-start triggered — tasks will begin executing');
                  } catch (err) {
                    addToast('error', err instanceof Error ? err.message : 'Auto-start failed');
                  } finally {
                    setAutoStarting(false);
                  }
                },
                disabled: d.isGenerating || autoStarting,
              }] : []),
            ] satisfies DropdownMenuItem[]}
          />

          {/* Overflow menu */}
          <DropdownMenu
            trigger={
              <span className="inline-flex items-center px-2 py-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded transition-colors" title="More actions">
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><circle cx="3" cy="8" r="1.5" /><circle cx="8" cy="8" r="1.5" /><circle cx="13" cy="8" r="1.5" /></svg>
              </span>
            }
            items={[
              { label: 'Template', onClick: () => { previousFocusRef.current = document.activeElement as HTMLElement; setShowTemplateMenu((v) => { if (!v) loadTemplates(); return !v; }); setShowExportMenu(false); }, disabled: d.isGenerating },
              { label: 'Import/Export', onClick: () => { previousFocusRef.current = document.activeElement as HTMLElement; setShowExportMenu((v) => !v); setShowTemplateMenu(false); } },
              { label: 'Project Settings', onClick: () => onOpenModal('project-settings'), disabled: !d.can('MANAGE_PROJECT_SETTINGS') },
              { label: 'Knowledge Base', onClick: () => onOpenModal('knowledge-base') },
              { label: 'Onboarding Interview', icon: <IconSparkle className="w-3.5 h-3.5" />, onClick: () => onOpenModal('onboarding') },
              { label: gitHubRepo ? `GitHub: ${gitHubRepo.repositoryOwner}/${gitHubRepo.repositoryName}` : 'Connect GitHub', icon: <IconGitHub className="w-3.5 h-3.5" />, onClick: () => onOpenModal('github') },
              { label: 'Keyboard Shortcuts', icon: <IconKeyboard className="w-3.5 h-3.5" />, onClick: () => onOpenModal('shortcut-help') },
            ] satisfies DropdownMenuItem[]}
          />

          {/* Template menu overlay */}
          {showTemplateMenu && (
            <div ref={templateMenuRef} role="dialog" aria-label="Create from template" tabIndex={-1} onKeyDown={handleTemplateTrapKeyDown} className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-2 z-50 min-w-[260px] p-3 space-y-2">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Create from template</p>
              {templateList.length === 0 ? (
                <p className="text-xs text-slate-400">No templates. Create one in Project Settings.</p>
              ) : (
                <>
                  <select
                    ref={templateSelectRef}
                    value={selectedTemplateId ?? ''}
                    onChange={(e) => setSelectedTemplateId(e.target.value || null)}
                    className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 dark:bg-slate-700 dark:text-slate-200"
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
                        className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1.5 dark:bg-slate-700 dark:text-slate-200"
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

          {/* Export menu overlay */}
          {showExportMenu && (
            <div
              ref={exportMenuRef}
              role="menu"
              aria-label="Export options"
              tabIndex={-1}
              className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50 min-w-[180px]"
              onKeyDown={(e) => {
                handleExportTrapKeyDown(e);
                const itemCount = exportItemRefs.current.length;
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  const next = (activeExportIndex + 1) % itemCount;
                  setActiveExportIndex(next);
                  exportItemRefs.current[next]?.focus();
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  const prev = (activeExportIndex - 1 + itemCount) % itemCount;
                  setActiveExportIndex(prev);
                  exportItemRefs.current[prev]?.focus();
                } else if (e.key === 'Enter') {
                  e.preventDefault();
                  exportItemRefs.current[activeExportIndex]?.click();
                } else if (e.key === 'Escape') {
                  setShowExportMenu(false);
                  previousFocusRef.current?.focus();
                }
              }}
            >
              <button
                ref={(el) => { exportItemRefs.current[0] = el; }}
                role="menuitem"
                tabIndex={activeExportIndex === 0 ? 0 : -1}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => { downloadExport(`project/${d.projectId}/csv`, `${d.project?.name ?? 'tasks'}.csv`); setShowExportMenu(false); }}
              >
                Export Tasks (CSV)
              </button>
              <button
                ref={(el) => { exportItemRefs.current[1] = el; }}
                role="menuitem"
                tabIndex={activeExportIndex === 1 ? 0 : -1}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => { downloadExport(`project/${d.projectId}/json`, `${d.project?.name ?? 'tasks'}.json`); setShowExportMenu(false); }}
              >
                Export Tasks (JSON)
              </button>
              <button
                ref={(el) => { exportItemRefs.current[2] = el; }}
                role="menuitem"
                tabIndex={activeExportIndex === 2 ? 0 : -1}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => { downloadExport(`project/${d.projectId}/activity/csv`, `${d.project?.name ?? 'activity'}-activity.csv`); setShowExportMenu(false); }}
              >
                Export Activity (CSV)
              </button>
              <button
                ref={(el) => { exportItemRefs.current[3] = el; }}
                role="menuitem"
                tabIndex={activeExportIndex === 3 ? 0 : -1}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => { downloadExport(`project/${d.projectId}/activity/json`, `${d.project?.name ?? 'activity'}-activity.json`); setShowExportMenu(false); }}
              >
                Export Activity (JSON)
              </button>
              <hr className="my-1 border-slate-100" />
              <button
                ref={(el) => { exportItemRefs.current[4] = el; }}
                role="menuitem"
                tabIndex={activeExportIndex === 4 ? 0 : -1}
                className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                onClick={() => { onOpenModal('csv-import'); setShowExportMenu(false); }}
              >
                Import CSV
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Status editor */}
      {showStatusEditor && (
        <div className="px-6 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex-shrink-0 animate-fade-in">
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
        <div className="px-6 py-2 bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700 flex-shrink-0 animate-fade-in">
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
            projectId={d.projectId}
            savedFilters={savedFilters}
            onSavedFiltersChange={setSavedFilters}
            onLoadFilter={(filtersJson) => filtering.loadSavedFilter(filtersJson)}
            filterGroup={filtering.filterGroup}
            onFilterGroupChange={filtering.setFilterGroup}
          />
        </div>
      )}
      <ConfirmDialogPortal />
    </>
  );
}
