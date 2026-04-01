import React, { useState, useRef, useCallback, useEffect } from 'react';
import Badge from './shared/Badge';
import PlanDependencyEditor from './PlanDependencyEditor';

// ── Types ────────────────────────────────────────────────────────────────

export interface DecisionOptionPreview {
  label: string;
  description: string;
  recommended?: boolean;
}

export interface DependencyRef {
  title: string;
  linkType: string;
}

export interface HierarchicalSubtaskPreview {
  title: string;
  description: string;
  estimatedHours: number | null;
  priority: string | null;
  acceptanceCriteria: string | null;
}

export interface HierarchicalTaskPreview {
  title: string;
  description: string;
  instructions: string | null;
  estimatedHours: number | null;
  priority: string | null;
  acceptanceCriteria: string | null;
  autoComplete: boolean | null;
  taskKind: string | null;
  options: DecisionOptionPreview[] | null;
  selectedOption: string | null;
  dependsOn: DependencyRef[] | null;
  subtasks: HierarchicalSubtaskPreview[] | null;
}

export interface HierarchicalEpicPreview {
  title: string;
  description: string;
  instructions: string | null;
  estimatedHours: number | null;
  priority: string | null;
  acceptanceCriteria: string | null;
  autoComplete: boolean | null;
  dependsOn: DependencyRef[] | null;
  tasks: HierarchicalTaskPreview[] | null;
}

export interface HierarchicalPlanPreview {
  epics: HierarchicalEpicPreview[];
}

// ── Decision validation helper ──────────────────────────────────────────

/** Count decision tasks that have no selectedOption. */
export function countUnresolvedDecisions(plan: HierarchicalPlanPreview): number {
  let count = 0;
  for (const epic of plan.epics) {
    for (const task of epic.tasks ?? []) {
      if (task.taskKind === 'decision' && !task.selectedOption) {
        count++;
      }
    }
  }
  return count;
}

// ── Internal mutable node type (union of all levels) ─────────────────────

type NodeKey = string;

function makeKey(
  epicIdx: number,
  taskIdx?: number,
  subtaskIdx?: number,
): NodeKey {
  if (subtaskIdx !== undefined && taskIdx !== undefined)
    return `subtask-${epicIdx}-${taskIdx}-${subtaskIdx}`;
  if (taskIdx !== undefined) return `task-${epicIdx}-${taskIdx}`;
  return `epic-${epicIdx}`;
}

// ── Priority mapping ─────────────────────────────────────────────────────

function priorityVariant(
  p: string | null,
): 'danger' | 'warning' | 'info' | 'neutral' | 'success' {
  switch (p) {
    case 'critical':
    case 'urgent':
      return 'danger';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    case 'low':
      return 'success';
    default:
      return 'neutral';
  }
}

const TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> =
  {
    epic: {
      bg: 'bg-amber-100 dark:bg-amber-900/30',
      text: 'text-amber-700 dark:text-amber-400',
      label: 'Epic',
    },
    task: {
      bg: 'bg-blue-100 dark:bg-blue-900/30',
      text: 'text-blue-700 dark:text-blue-400',
      label: 'Task',
    },
    subtask: {
      bg: 'bg-slate-100 dark:bg-slate-700',
      text: 'text-slate-600 dark:text-slate-300',
      label: 'Subtask',
    },
  };

// ── Props ────────────────────────────────────────────────────────────────

interface HierarchicalPlanEditorProps {
  plan: HierarchicalPlanPreview;
  onChange: (plan: HierarchicalPlanPreview) => void;
  /** When provided, enables selection mode with a "Refine selected" button. */
  onRefine?: (selectedTaskKeys: Set<string>, refinementPrompt: string) => void;
  /** Whether a refinement is currently in progress. */
  refining?: boolean;
}

// ── Component ────────────────────────────────────────────────────────────

export function HierarchicalPlanEditor({
  plan,
  onChange,
  onRefine,
  refining,
}: HierarchicalPlanEditorProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    plan.epics.forEach((_, i) => ids.add(makeKey(i)));
    return ids;
  });

  // Reset expanded when epic count changes (e.g. regenerate)
  // The ref guards against the initial run — only resets on actual count change.
  const epicCountRef = useRef(plan.epics.length);
  useEffect(() => {
    if (plan.epics.length === epicCountRef.current) return;
    epicCountRef.current = plan.epics.length;
    const ids = new Set<string>();
    plan.epics.forEach((_, i) => ids.add(makeKey(i)));
    setExpandedIds(ids); // eslint-disable-line react-hooks/set-state-in-effect -- intentional sync: regenerated plan resets UI
  }, [plan.epics.length]); // eslint-disable-line react-hooks/exhaustive-deps -- intentionally keyed on count only

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editRef = useRef<HTMLInputElement>(null);
  const [editingDepsKey, setEditingDepsKey] = useState<string | null>(null);

  // Selection mode for refinement
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [showRefinePrompt, setShowRefinePrompt] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState('');

  const toggleSelection = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const handleRefineSubmit = useCallback(() => {
    if (!onRefine || selectedKeys.size === 0 || !refinePrompt.trim()) return;
    onRefine(selectedKeys, refinePrompt.trim());
    setShowRefinePrompt(false);
    setRefinePrompt('');
    setSelectedKeys(new Set());
  }, [onRefine, selectedKeys, refinePrompt]);

  // Drag state
  const draggedKey = useRef<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const toggleExpand = useCallback((key: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ── Edit helpers ───────────────────────────────────────────────────────

  const startEdit = useCallback((key: string, currentTitle: string) => {
    setEditingKey(key);
    setEditValue(currentTitle);
    // Focus on next tick
    setTimeout(() => editRef.current?.focus(), 0);
  }, []);

  const saveEdit = useCallback(() => {
    if (!editingKey || !editValue.trim()) {
      setEditingKey(null);
      return;
    }
    const updated = structuredClone(plan);
    const parts = editingKey.split('-');
    if (parts[0] === 'epic') {
      updated.epics[Number(parts[1])].title = editValue.trim();
    } else if (parts[0] === 'task') {
      const tasks = updated.epics[Number(parts[1])].tasks;
      if (tasks) tasks[Number(parts[2])].title = editValue.trim();
    } else if (parts[0] === 'subtask') {
      const tasks = updated.epics[Number(parts[1])].tasks;
      const subtasks = tasks?.[Number(parts[2])]?.subtasks;
      if (subtasks) subtasks[Number(parts[3])].title = editValue.trim();
    }
    onChange(updated);
    setEditingKey(null);
  }, [editingKey, editValue, plan, onChange]);

  const handleEditKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveEdit();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        setEditingKey(null);
      }
    },
    [saveEdit],
  );

  // ── Delete helpers ─────────────────────────────────────────────────────

  const deleteNode = useCallback(
    (key: string) => {
      const updated = structuredClone(plan);
      const parts = key.split('-');
      if (parts[0] === 'epic') {
        updated.epics.splice(Number(parts[1]), 1);
      } else if (parts[0] === 'task') {
        const tasks = updated.epics[Number(parts[1])].tasks;
        if (tasks) tasks.splice(Number(parts[2]), 1);
      } else if (parts[0] === 'subtask') {
        const tasks = updated.epics[Number(parts[1])].tasks;
        const subtasks = tasks?.[Number(parts[2])]?.subtasks;
        if (subtasks) subtasks.splice(Number(parts[3]), 1);
      }
      onChange(updated);
    },
    [plan, onChange],
  );

  // ── AutoComplete toggle ────────────────────────────────────────────────

  const toggleAutoComplete = useCallback(
    (key: string) => {
      const updated = structuredClone(plan);
      const parts = key.split('-');
      if (parts[0] === 'task') {
        const tasks = updated.epics[Number(parts[1])].tasks;
        if (tasks) {
          const t = tasks[Number(parts[2])];
          t.autoComplete = !(t.autoComplete ?? false);
        }
      }
      onChange(updated);
    },
    [plan, onChange],
  );

  // ── Select decision option ───────────────────────────────────────────

  const selectDecisionOption = useCallback(
    (key: string, optionLabel: string) => {
      const updated = structuredClone(plan);
      const parts = key.split('-');
      if (parts[0] === 'task') {
        const tasks = updated.epics[Number(parts[1])].tasks;
        if (tasks) {
          const task = tasks[Number(parts[2])];
          task.selectedOption = optionLabel;
          // Fold selected option into instructions
          const opt = task.options?.find((o) => o.label === optionLabel);
          if (opt) {
            const selectionLine = `\nSelected: ${opt.label} — ${opt.description}`;
            // Remove any previous selection line
            const base = (task.instructions ?? '').replace(/\nSelected: .+$/, '');
            task.instructions = base + selectionLine;
          }
        }
      }
      onChange(updated);
    },
    [plan, onChange],
  );

  // ── Update node dependencies ─────────────────────────────────────────

  const updateNodeDeps = useCallback(
    (key: string, newDeps: DependencyRef[]) => {
      const updated = structuredClone(plan);
      const parts = key.split('-');
      if (parts[0] === 'epic') {
        updated.epics[Number(parts[1])].dependsOn = newDeps;
      } else if (parts[0] === 'task') {
        const tasks = updated.epics[Number(parts[1])].tasks;
        if (tasks) tasks[Number(parts[2])].dependsOn = newDeps;
      }
      onChange(updated);
    },
    [plan, onChange],
  );

  // ── Drag-to-reorder ────────────────────────────────────────────────────

  const handleDragStart = useCallback((key: string) => {
    draggedKey.current = key;
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, key: string) => {
      e.preventDefault();
      // Only allow drop at same level
      const dragged = draggedKey.current;
      if (!dragged) return;
      const dragParts = dragged.split('-');
      const dropParts = key.split('-');
      if (dragParts[0] !== dropParts[0]) return;
      // Same parent check for tasks/subtasks
      if (dragParts[0] === 'task' && dragParts[1] !== dropParts[1]) return;
      if (
        dragParts[0] === 'subtask' &&
        (dragParts[1] !== dropParts[1] || dragParts[2] !== dropParts[2])
      )
        return;
      setDropTarget(key);
    },
    [],
  );

  const handleDragLeave = useCallback(() => {
    setDropTarget(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, targetKey: string) => {
      e.preventDefault();
      setDropTarget(null);
      const sourceKey = draggedKey.current;
      draggedKey.current = null;
      if (!sourceKey || sourceKey === targetKey) return;

      const sourceParts = sourceKey.split('-');
      const targetParts = targetKey.split('-');
      if (sourceParts[0] !== targetParts[0]) return;

      const updated = structuredClone(plan);

      if (sourceParts[0] === 'epic') {
        const srcIdx = Number(sourceParts[1]);
        const tgtIdx = Number(targetParts[1]);
        const [moved] = updated.epics.splice(srcIdx, 1);
        updated.epics.splice(tgtIdx, 0, moved);
      } else if (sourceParts[0] === 'task') {
        if (sourceParts[1] !== targetParts[1]) return;
        const epicIdx = Number(sourceParts[1]);
        const tasks = updated.epics[epicIdx].tasks;
        if (!tasks) return;
        const srcIdx = Number(sourceParts[2]);
        const tgtIdx = Number(targetParts[2]);
        const [moved] = tasks.splice(srcIdx, 1);
        tasks.splice(tgtIdx, 0, moved);
      } else if (sourceParts[0] === 'subtask') {
        if (
          sourceParts[1] !== targetParts[1] ||
          sourceParts[2] !== targetParts[2]
        )
          return;
        const epicIdx = Number(sourceParts[1]);
        const taskIdx = Number(sourceParts[2]);
        const subtasks = updated.epics[epicIdx].tasks?.[taskIdx]?.subtasks;
        if (!subtasks) return;
        const srcIdx = Number(sourceParts[3]);
        const tgtIdx = Number(targetParts[3]);
        const [moved] = subtasks.splice(srcIdx, 1);
        subtasks.splice(tgtIdx, 0, moved);
      }

      onChange(updated);
    },
    [plan, onChange],
  );

  const handleDragEnd = useCallback(() => {
    draggedKey.current = null;
    setDropTarget(null);
  }, []);

  // ── Collect all node titles for dependency display ─────────────────────

  const allTitles = new Set<string>();
  const nodeLevels = new Map<string, 'epic' | 'task' | 'subtask'>();
  for (const epic of plan.epics) {
    allTitles.add(epic.title);
    nodeLevels.set(epic.title, 'epic');
    for (const task of epic.tasks ?? []) {
      allTitles.add(task.title);
      nodeLevels.set(task.title, 'task');
      for (const subtask of task.subtasks ?? []) {
        allTitles.add(subtask.title);
        nodeLevels.set(subtask.title, 'subtask');
      }
    }
  }

  // ── Render a single node ──────────────────────────────────────────────

  const renderNode = (
    nodeType: 'epic' | 'task' | 'subtask',
    title: string,
    _description: string,
    priority: string | null,
    estimatedHours: number | null,
    autoComplete: boolean | null,
    dependsOn: DependencyRef[] | null,
    hasChildren: boolean,
    key: NodeKey,
    depth: number,
    taskKind?: string | null,
    options?: DecisionOptionPreview[] | null,
    selectedOption?: string | null,
  ) => {
    const isExpanded = expandedIds.has(key);
    const isEditing = editingKey === key;
    const style = TYPE_STYLES[nodeType];
    const depCount = dependsOn?.length ?? 0;
    const isDropTarget = dropTarget === key;

    return (
      <React.Fragment key={key}>
      <div
        className={`group flex items-center gap-2 px-3 py-2 rounded-lg border transition-all mb-1
          ${isDropTarget ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'}
          bg-white dark:bg-slate-900`}
        style={{ marginLeft: `${depth * 24}px` }}
        draggable
        onDragStart={() => handleDragStart(key)}
        onDragOver={(e) => handleDragOver(e, key)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, key)}
        onDragEnd={handleDragEnd}
      >
        {/* Expand/Collapse */}
        {hasChildren ? (
          <button
            onClick={() => toggleExpand(key)}
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex-shrink-0"
            aria-label={isExpanded ? `Collapse ${title}` : `Expand ${title}`}
            aria-expanded={isExpanded}
          >
            {isExpanded ? '▼' : '▶'}
          </button>
        ) : (
          <span className="w-5 flex-shrink-0" />
        )}

        {/* Selection checkbox (task-level only, when onRefine is provided) */}
        {onRefine && nodeType === 'task' && (
          <input
            type="checkbox"
            checked={selectedKeys.has(key)}
            onChange={() => toggleSelection(key)}
            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 flex-shrink-0"
            aria-label={`Select ${title} for refinement`}
          />
        )}

        {/* Type badge */}
        <span
          className={`${style.bg} ${style.text} text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0`}
        >
          {style.label}
        </span>

        {/* Decision badge */}
        {taskKind === 'decision' && (
          <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0">
            Decision
          </span>
        )}

        {/* Title (inline editable) */}
        <div className="flex-1 min-w-0">
          {isEditing ? (
            <input
              ref={editRef}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={handleEditKeyDown}
              className="w-full text-sm font-medium text-slate-800 dark:text-slate-100 border-b-2 border-blue-400 focus:outline-none bg-transparent"
            />
          ) : (
            <span
              className="text-sm font-medium text-slate-800 dark:text-slate-100 cursor-text hover:underline decoration-dashed truncate block"
              onClick={() => startEdit(key, title)}
              title="Click to edit"
            >
              {title}
            </span>
          )}
        </div>

        {/* Priority badge */}
        {priority && (
          <Badge variant={priorityVariant(priority)} size="sm">
            {priority}
          </Badge>
        )}

        {/* Estimated hours */}
        {estimatedHours != null && (
          <span className="text-[10px] text-slate-400 dark:text-slate-500 flex-shrink-0">
            {estimatedHours}h
          </span>
        )}

        {/* Auto-complete toggle (task nodes only, not epics or subtasks) */}
        {nodeType === 'task' && (
          <label className="flex items-center gap-1 flex-shrink-0 cursor-pointer">
            <input
              type="checkbox"
              checked={autoComplete ?? false}
              onChange={() => toggleAutoComplete(key)}
              className="w-3.5 h-3.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              Auto
            </span>
          </label>
        )}

        {/* Dependency count badge */}
        {(nodeType === 'epic' || nodeType === 'task') && (
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full flex-shrink-0 cursor-pointer ${
              depCount > 0
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                : 'bg-slate-100 text-slate-400 dark:bg-slate-700 dark:text-slate-500'
            }`}
            title={
              depCount > 0
                ? dependsOn!.map((d) => `${d.linkType}: ${d.title}`).join(', ')
                : 'Add dependencies'
            }
            onClick={() =>
              setEditingDepsKey(editingDepsKey === key ? null : key)
            }
          >
            {depCount > 0
              ? `${depCount} dep${depCount > 1 ? 's' : ''}`
              : '+ dep'}
          </span>
        )}

        {/* Delete button */}
        <button
          onClick={() => deleteNode(key)}
          className="w-5 h-5 flex items-center justify-center text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
          aria-label={`Delete ${nodeType} '${title}'`}
        >
          ×
        </button>
      </div>
      {/* Inline dependency editor */}
      {editingDepsKey === key && (nodeType === 'epic' || nodeType === 'task') && (
        <div style={{ marginLeft: `${depth * 24 + 20}px` }} className="mb-1">
          <PlanDependencyEditor
            dependsOn={dependsOn ?? []}
            allTitles={Array.from(allTitles)}
            nodeTitle={title}
            onChange={(newDeps) => updateNodeDeps(key, newDeps)}
            nodeLevels={nodeLevels}
          />
        </div>
      )}
      {/* Decision options */}
      {taskKind === 'decision' && options && options.length > 0 && (
        <div style={{ marginLeft: `${depth * 24 + 20}px` }} className="mb-1 space-y-1">
          {options.map((opt) => {
            const isSelected = selectedOption === opt.label;
            return (
              <button
                key={opt.label}
                type="button"
                onClick={() => selectDecisionOption(key, opt.label)}
                className={`w-full text-left px-3 py-2 rounded-lg border transition-all text-sm ${
                  isSelected
                    ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-400'
                    : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 bg-white dark:bg-slate-900'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                    isSelected ? 'border-blue-500' : 'border-slate-300 dark:border-slate-600'
                  }`}>
                    {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />}
                  </span>
                  <span className="font-medium">{opt.label}</span>
                  {opt.recommended && (
                    <span className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                      Recommended
                    </span>
                  )}
                </span>
                <span className="block ml-[22px] text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  {opt.description}
                </span>
              </button>
            );
          })}
        </div>
      )}
      </React.Fragment>
    );
  };

  // ── Render tree ────────────────────────────────────────────────────────

  return (
    <div className="space-y-0.5">
      {plan.epics.length === 0 && (
        <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-8">
          No epics in plan. Generate a plan to get started.
        </p>
      )}
      {plan.epics.map((epic, epicIdx) => {
        const epicKey = makeKey(epicIdx);
        const epicExpanded = expandedIds.has(epicKey);
        const tasks = epic.tasks ?? [];

        return (
          <React.Fragment key={epicKey}>
            {renderNode(
              'epic',
              epic.title,
              epic.description,
              epic.priority,
              epic.estimatedHours,
              epic.autoComplete,
              epic.dependsOn,
              tasks.length > 0,
              epicKey,
              0,
            )}

            {epicExpanded &&
              tasks.map((task, taskIdx) => {
                const taskKey = makeKey(epicIdx, taskIdx);
                const taskExpanded = expandedIds.has(taskKey);
                const subtasks = task.subtasks ?? [];

                return (
                  <React.Fragment key={taskKey}>
                    {renderNode(
                      'task',
                      task.title,
                      task.description,
                      task.priority,
                      task.estimatedHours,
                      task.autoComplete,
                      task.dependsOn,
                      subtasks.length > 0,
                      taskKey,
                      1,
                      task.taskKind,
                      task.options,
                      task.selectedOption,
                    )}

                    {taskExpanded &&
                      subtasks.map((subtask, subtaskIdx) => {
                        const subtaskKey = makeKey(
                          epicIdx,
                          taskIdx,
                          subtaskIdx,
                        );
                        return renderNode(
                          'subtask',
                          subtask.title,
                          subtask.description,
                          subtask.priority,
                          subtask.estimatedHours,
                          null,
                          null,
                          false,
                          subtaskKey,
                          2,
                        );
                      })}
                  </React.Fragment>
                );
              })}
          </React.Fragment>
        );
      })}

      {/* Refinement bar */}
      {onRefine && selectedKeys.size > 0 && (
        <div className="mt-3 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-indigo-700 dark:text-indigo-300">
              {selectedKeys.size} task{selectedKeys.size !== 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => { setSelectedKeys(new Set()); setShowRefinePrompt(false); }}
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
              >
                Clear
              </button>
              {!showRefinePrompt && (
                <button
                  onClick={() => setShowRefinePrompt(true)}
                  className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg"
                  disabled={refining}
                >
                  Refine selected
                </button>
              )}
            </div>
          </div>
          {showRefinePrompt && (
            <div className="space-y-2">
              <textarea
                value={refinePrompt}
                onChange={(e) => setRefinePrompt(e.target.value)}
                placeholder="What should change about these tasks?"
                rows={3}
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-indigo-500"
                disabled={refining}
                autoFocus
              />
              <div className="flex items-center gap-2 justify-end">
                <button
                  onClick={() => setShowRefinePrompt(false)}
                  className="px-3 py-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                  disabled={refining}
                >
                  Cancel
                </button>
                <button
                  onClick={handleRefineSubmit}
                  className="px-3 py-1 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50"
                  disabled={refining || !refinePrompt.trim()}
                >
                  {refining ? 'Refining...' : 'Refine'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
