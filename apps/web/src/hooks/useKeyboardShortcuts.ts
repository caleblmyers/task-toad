import { useEffect, useRef, useCallback } from 'react';
import type { Task } from '../types';

interface KeyboardShortcutsOptions {
  tasks: Task[];
  selectedTask: Task | null;
  onSelectTask: (task: Task) => void;
  onCloseTask: () => void;
  onNewTask?: () => void;
  onFocusSearch?: () => void;
  onShowHelp?: () => void;
  enabled?: boolean;
}

export function useKeyboardShortcuts({
  tasks,
  selectedTask,
  onSelectTask,
  onCloseTask,
  onNewTask,
  onFocusSearch,
  onShowHelp,
  enabled = true,
}: KeyboardShortcutsOptions) {
  const focusIndexRef = useRef(-1);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!enabled) return;

    // Ignore when typing in inputs
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable) {
      if (e.key === 'Escape') {
        target.blur();
      }
      return;
    }

    switch (e.key) {
      case 'j': {
        e.preventDefault();
        const nextIdx = Math.min(focusIndexRef.current + 1, tasks.length - 1);
        if (tasks[nextIdx]) {
          focusIndexRef.current = nextIdx;
          onSelectTask(tasks[nextIdx]);
        }
        break;
      }
      case 'k': {
        e.preventDefault();
        const prevIdx = Math.max(focusIndexRef.current - 1, 0);
        if (tasks[prevIdx]) {
          focusIndexRef.current = prevIdx;
          onSelectTask(tasks[prevIdx]);
        }
        break;
      }
      case 'Escape':
        if (selectedTask) {
          e.preventDefault();
          onCloseTask();
          focusIndexRef.current = -1;
        }
        break;
      case 'n':
        if (onNewTask) {
          e.preventDefault();
          onNewTask();
        }
        break;
      case '/':
        if (onFocusSearch) {
          e.preventDefault();
          onFocusSearch();
        }
        break;
      case '?':
        if (onShowHelp) {
          e.preventDefault();
          onShowHelp();
        }
        break;
    }
  }, [enabled, tasks, selectedTask, onSelectTask, onCloseTask, onNewTask, onFocusSearch, onShowHelp]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Sync focus index when selected task changes externally
  useEffect(() => {
    if (selectedTask) {
      const idx = tasks.findIndex((t) => t.taskId === selectedTask.taskId);
      if (idx >= 0) focusIndexRef.current = idx;
    }
  }, [selectedTask, tasks]);

  return { focusIndex: focusIndexRef };
}
