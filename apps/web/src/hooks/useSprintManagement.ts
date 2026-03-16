import { useState, useCallback, useMemo } from 'react';
import { gql } from '../api/client';
import { SPRINTS_QUERY, ACTIVATE_SPRINT_MUTATION, DELETE_SPRINT_MUTATION } from '../api/queries';
import type { Sprint, CloseSprintResult, Task } from '../types';

interface UseSprintManagementOptions {
  projectId: string | undefined;
  onTasksChanged: (updater: (tasks: Task[]) => Task[]) => void;
  setErr: (err: string | null) => void;
}

export function useSprintManagement({ projectId, onTasksChanged, setErr }: UseSprintManagementOptions) {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [showSprintModal, setShowSprintModal] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [showSprintPlanModal, setShowSprintPlanModal] = useState(false);
  const [closeSprintId, setCloseSprintId] = useState<string | null>(null);

  const activeSprint = useMemo(() => sprints.find((s) => s.isActive), [sprints]);

  const loadSprints = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await gql<{ sprints: Sprint[] }>(SPRINTS_QUERY, { projectId });
      setSprints(data.sprints);
    } catch {
      // ignore
    }
  }, [projectId]);

  const handleActivateSprint = useCallback(async (sprintId: string) => {
    try {
      await gql<{ updateSprint: Sprint }>(ACTIVATE_SPRINT_MUTATION, { sprintId, isActive: true });
      setSprints((prev) => prev.map((s) => ({ ...s, isActive: s.sprintId === sprintId })));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to activate sprint');
    }
  }, [setErr]);

  const handleCreateSprint = useCallback((sprint: Sprint) => {
    setSprints((prev) => [...prev, sprint]);
    setShowSprintModal(false);
  }, []);

  const handleSprintPlanCreated = useCallback((newSprints: Sprint[]) => {
    setSprints((prev) => [...prev, ...newSprints]);
    setShowSprintPlanModal(false);
  }, []);

  const handleSprintClosed = useCallback((result: CloseSprintResult, loadTasks: () => Promise<Task[]>) => {
    setSprints((prev) =>
      prev.map((s) => s.sprintId === result.sprint.sprintId ? result.sprint : s)
    );
    setCloseSprintId(null);
    loadTasks();
  }, []);

  const handleSprintUpdated = useCallback((sprint: Sprint) => {
    setSprints((prev) => prev.map((s) => s.sprintId === sprint.sprintId ? sprint : s));
    setEditingSprint(null);
  }, []);

  const handleDeleteSprint = useCallback(async (sprintId: string) => {
    try {
      await gql<{ deleteSprint: boolean }>(DELETE_SPRINT_MUTATION, { sprintId });
      setSprints((prev) => prev.filter((s) => s.sprintId !== sprintId));
      onTasksChanged((prev) => prev.map((t) => t.sprintId === sprintId ? { ...t, sprintId: null, sprintColumn: null } : t));
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to delete sprint');
    }
  }, [onTasksChanged, setErr]);

  return {
    sprints,
    activeSprint,
    showSprintModal,
    editingSprint,
    showSprintPlanModal,
    closeSprintId,
    loadSprints,
    handleActivateSprint,
    handleCreateSprint,
    handleSprintPlanCreated,
    handleSprintClosed,
    handleSprintUpdated,
    handleDeleteSprint,
    setShowSprintModal,
    setEditingSprint,
    setShowSprintPlanModal,
    setCloseSprintId,
  };
}
