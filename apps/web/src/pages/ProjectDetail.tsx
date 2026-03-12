import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useProjectData } from '../hooks/useProjectData';
import { useTaskFiltering } from '../hooks/useTaskFiltering';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../hooks/useToast';
import KanbanBoard from '../components/KanbanBoard';
import TaskDetailPanel from '../components/TaskDetailPanel';
import TaskPlanApprovalDialog from '../components/TaskPlanApprovalDialog';
import BacklogView from '../components/BacklogView';
import SprintCreateModal from '../components/SprintCreateModal';
import SprintPlanModal from '../components/SprintPlanModal';
import CloseSprintModal from '../components/CloseSprintModal';
import { TaskListSkeleton, KanbanBoardSkeleton } from '../components/Skeleton';
import SearchInput from '../components/shared/SearchInput';
import FilterBar from '../components/shared/FilterBar';
import ToastContainer from '../components/shared/ToastContainer';
import KeyboardShortcutHelp from '../components/shared/KeyboardShortcutHelp';
import { IconList, IconBoard, IconClose, IconPlus, IconRefresh, IconSummary, IconFilter, IconKeyboard } from '../components/shared/Icons';

const activeClass = 'px-3 py-1 text-sm rounded-md bg-white text-slate-800 font-medium shadow-sm';
const inactiveClass = 'px-3 py-1 text-sm rounded-md text-slate-500 hover:text-slate-700';

export default function ProjectDetail() {
  const d = useProjectData();
  const filtering = useTaskFiltering(d.rootTasks);
  const { toasts, addToast, removeToast } = useToast();
  const searchRef = useRef<HTMLInputElement>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);

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

  // Wrap handlers to show toasts on success
  const handleStatusChange = async (taskId: string, status: 'todo' | 'in_progress' | 'done') => {
    await d.handleStatusChange(taskId, status);
    addToast('success', `Status updated to ${status.replace('_', ' ')}`);
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

  if (!d.projectId) return null;

  const detailPanelProps = {
    editingTitle: d.editingTitle,
    editTitleValue: d.editTitleValue,
    titleEditRef: d.titleEditRef,
    generatingInstructions: d.generatingInstructions,
    sprints: d.sprints,
    orgUsers: d.orgUsers,
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
  };

  const viewToggle = (
    <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
      <button onClick={() => d.switchView('backlog')} className={d.view === 'backlog' ? activeClass : inactiveClass} disabled={d.isGenerating}>
        <span className="flex items-center gap-1"><IconList className="w-3.5 h-3.5" /> Backlog</span>
      </button>
      <button onClick={() => d.switchView('board')} className={d.view === 'board' ? activeClass : inactiveClass} disabled={d.isGenerating}>
        <span className="flex items-center gap-1"><IconBoard className="w-3.5 h-3.5" /> Board</span>
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
          <h1 className="text-sm font-semibold text-slate-800">Tasks</h1>
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
            onClick={() => setShowShortcutHelp((v) => !v)}
            className="text-slate-400 hover:text-slate-600 px-1.5 py-1"
            title="Keyboard shortcuts (?)"
          >
            <IconKeyboard className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => d.setShowAddForm(!d.showAddForm)}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={d.isGenerating}
          >
            {d.showAddForm ? <><IconClose className="w-3.5 h-3.5" /> Cancel</> : <><IconPlus className="w-3.5 h-3.5" /> Add task</>}
          </button>
          <button
            type="button"
            onClick={() => d.openPreview()}
            disabled={d.isGenerating}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconRefresh className="w-3.5 h-3.5" />
            {d.previewLoading ? 'Planning…' : 'Regenerate'}
          </button>
          <button
            type="button"
            onClick={() => { d.handleSummarize(); d.setShowAddForm(false); }}
            disabled={d.isGenerating}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800 px-2 py-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <IconSummary className="w-3.5 h-3.5" />
            {d.summarizing ? 'Summarizing…' : 'Summarize'}
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && (
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-100 flex-shrink-0 animate-fade-in">
          <FilterBar
            statusFilter={filtering.statusFilter}
            priorityFilter={filtering.priorityFilter}
            assigneeFilter={filtering.assigneeFilter}
            orgUsers={d.orgUsers}
            onStatusChange={(v) => filtering.setStatusFilter(v as 'todo' | 'in_progress' | 'done' | 'all')}
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
              className="flex-1 max-w-sm px-2 py-1.5 text-sm border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-slate-400"
              required
              autoFocus
            />
            <button type="submit" className="px-3 py-1.5 bg-slate-700 text-white text-sm rounded hover:bg-slate-600">
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
        {/* Left: board / backlog / states */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          {d.summary ? (
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
          ) : d.loading ? (
            d.view === 'board' ? <KanbanBoardSkeleton /> : <TaskListSkeleton count={6} />
          ) : d.view === 'backlog' ? (
            <BacklogView
              tasks={filtering.filteredTasks}
              sprints={d.sprints}
              orgUsers={d.orgUsers}
              selectedTask={d.selectedTask}
              onSelectTask={d.selectTask}
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
            />
          ) : d.activeSprint ? (
            <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-4">
              <KanbanBoard
                columns={JSON.parse(d.activeSprint.columns) as string[]}
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

      {/* Sprint create modal */}
      {d.showSprintModal && d.projectId && (
        <SprintCreateModal
          projectId={d.projectId}
          onCreated={d.handleCreateSprint}
          onClose={() => d.setShowSprintModal(false)}
        />
      )}

      {/* Sprint edit modal */}
      {d.editingSprint && d.projectId && (
        <SprintCreateModal
          projectId={d.projectId}
          initialSprint={d.editingSprint}
          onCreated={d.handleCreateSprint}
          onUpdated={d.handleSprintUpdated}
          onClose={() => d.setEditingSprint(null)}
        />
      )}

      {/* Sprint plan modal */}
      {d.showSprintPlanModal && d.projectId && (
        <SprintPlanModal
          projectId={d.projectId}
          tasks={d.tasks}
          onCreated={d.handleSprintPlanCreated}
          onTasksUpdated={d.loadTasks}
          onClose={() => d.setShowSprintPlanModal(false)}
        />
      )}

      {/* Close sprint modal */}
      {d.closeSprintId && (() => {
        const closingSprint = d.sprints.find((s) => s.sprintId === d.closeSprintId);
        if (!closingSprint) return null;
        return (
          <CloseSprintModal
            sprint={closingSprint}
            sprintTasks={d.tasks.filter((t) => t.sprintId === d.closeSprintId && !t.parentTaskId)}
            otherSprints={d.sprints.filter((s) => !s.closedAt && s.sprintId !== d.closeSprintId)}
            onClosed={d.handleSprintClosed}
            onActivateNext={d.handleActivateSprint}
            onCreateSprint={() => d.setShowSprintModal(true)}
            onClose={() => d.setCloseSprintId(null)}
          />
        );
      })()}

      {/* Task plan approval dialog */}
      {d.previewTasks !== null && (
        <TaskPlanApprovalDialog
          tasks={d.previewTasks}
          loading={d.previewLoading}
          error={d.previewError}
          onApprove={d.handleCommitPlan}
          onRedo={(ctx) => d.openPreview(ctx)}
          onAddMore={(ctx) => d.openPreview(ctx, d.previewTasks!.map((t) => t.title))}
          onCancel={() => { d.setPreviewTasks(null); d.setPreviewError(null); }}
        />
      )}

      {/* Keyboard shortcut help */}
      {showShortcutHelp && <KeyboardShortcutHelp onClose={() => setShowShortcutHelp(false)} />}

      {/* Toast notifications */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
