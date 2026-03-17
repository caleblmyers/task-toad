import { useRef, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { gql, TOKEN_KEY } from '../api/client';
import type { ProjectData } from '../hooks/useProjectData';
import type { TaskFiltering } from '../hooks/useTaskFiltering';
import type { GitHubRepoLink } from '../types';
import { statusLabel } from '../utils/taskHelpers';
import SearchInput from './shared/SearchInput';
import FilterBar from './shared/FilterBar';
import Button from './shared/Button';
import { IconList, IconBoard, IconTable, IconCalendar, IconClose, IconPlus, IconRefresh, IconSummary, IconFilter, IconKeyboard, IconGitHub } from './shared/Icons';

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
  const [editingProjectName, setEditingProjectName] = useState(false);
  const [editProjectNameValue, setEditProjectNameValue] = useState('');
  const [showStatusEditor, setShowStatusEditor] = useState(false);
  const [newStatusValue, setNewStatusValue] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  const [templateList, setTemplateList] = useState<Array<{ taskTemplateId: string; name: string; description: string | null; instructions: string | null; acceptanceCriteria: string | null; priority: string; taskType: string }>>([]);
  const [templateTitle, setTemplateTitle] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const templateMenuRef = useRef<HTMLDivElement>(null);
  const templateBtnRef = useRef<HTMLButtonElement>(null);

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
      <button onClick={() => { d.switchView('dashboard'); setTimelineView(false); onLoadProjectActivities(); }} className={d.view === 'dashboard' && !timelineView ? activeClass : inactiveClass} disabled={d.isGenerating}>
        <span className="flex items-center gap-1">📊 Dashboard</span>
      </button>
    </div>
  );

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
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
              className="text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-text hover:underline decoration-dashed"
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
            ref={searchRef as React.RefObject<HTMLInputElement>}
            value={filtering.searchQuery}
            onChange={filtering.setSearchQuery}
            placeholder="Search tasks…"
            className="w-48"
          />
          <button
            type="button"
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1 text-sm px-2 py-1 rounded-md transition-colors ${filtering.hasActiveFilters || showFilters ? 'text-slate-800 dark:text-slate-200 bg-slate-100 dark:bg-slate-700' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'}`}
            title="Toggle filters"
          >
            <IconFilter className="w-3.5 h-3.5" />
            {filtering.hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onOpenModal('project-settings')}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-600 px-1.5 py-1 text-sm"
            title="Project Settings"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" /></svg>
          </button>
          <button
            type="button"
            onClick={() => onOpenModal('knowledge-base')}
            className="flex items-center gap-1 text-slate-400 hover:text-slate-600 px-1.5 py-1 text-sm"
            title="Project Knowledge Base"
          >
            <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor"><path d="M9 4.804A7.968 7.968 0 005.5 4c-1.255 0-2.443.29-3.5.804v10A7.969 7.969 0 015.5 14c1.669 0 3.218.51 4.5 1.385A7.962 7.962 0 0114.5 14c1.255 0 2.443.29 3.5.804v-10A7.968 7.968 0 0014.5 4c-1.255 0-2.443.29-3.5.804V12a1 1 0 11-2 0V4.804z" /></svg>
            KB
          </button>
          <button
            type="button"
            onClick={() => onOpenModal('github')}
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
            onClick={() => onOpenModal('shortcut-help')}
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
          <Button variant="ghost" size="sm" onClick={() => onOpenModal('standup')} disabled={d.isGenerating}>
            Standup
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenModal('health')} disabled={d.isGenerating}>
            Health
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenModal('trends')} disabled={d.isGenerating}>
            Trends
          </Button>
          {d.activeSprint && (
            <Button variant="ghost" size="sm" onClick={() => onOpenModal(`transition:${d.activeSprint!.sprintId}:${d.activeSprint!.name}`)} disabled={d.isGenerating}>
              Transition
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => onOpenModal('meeting-notes')} disabled={d.isGenerating}>
            Notes
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenModal('bug-report')} disabled={d.isGenerating}>
            Bug
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onOpenModal('prd-breakdown')} disabled={d.isGenerating}>
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
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-2 z-50 min-w-[260px] p-3 space-y-2">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Create from template</p>
                {templateList.length === 0 ? (
                  <p className="text-xs text-slate-400">No templates. Create one in Project Settings.</p>
                ) : (
                  <>
                    <select
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
          </div>
          <div className="relative">
            <Button variant="ghost" size="sm" onClick={() => setShowExportMenu((v) => !v)}>
              Import/Export
            </Button>
            {showExportMenu && (
              <div className="absolute right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg py-1 z-50 min-w-[180px]">
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  onClick={() => { downloadExport(`project/${d.projectId}/csv`, `${d.project?.name ?? 'tasks'}.csv`); setShowExportMenu(false); }}
                >
                  Export Tasks (CSV)
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  onClick={() => { downloadExport(`project/${d.projectId}/json`, `${d.project?.name ?? 'tasks'}.json`); setShowExportMenu(false); }}
                >
                  Export Tasks (JSON)
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  onClick={() => { downloadExport(`project/${d.projectId}/activity/csv`, `${d.project?.name ?? 'activity'}-activity.csv`); setShowExportMenu(false); }}
                >
                  Export Activity (CSV)
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  onClick={() => { downloadExport(`project/${d.projectId}/activity/json`, `${d.project?.name ?? 'activity'}-activity.json`); setShowExportMenu(false); }}
                >
                  Export Activity (JSON)
                </button>
                <hr className="my-1 border-slate-100" />
                <button
                  className="w-full text-left px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                  onClick={() => { onOpenModal('csv-import'); setShowExportMenu(false); }}
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
          />
        </div>
      )}
    </>
  );
}
