import { useState, useCallback } from 'react';
import { gql } from '../api/client';
import {
  RELEASES_QUERY,
  RELEASE_QUERY,
  CREATE_RELEASE_MUTATION,
  UPDATE_RELEASE_MUTATION,
  DELETE_RELEASE_MUTATION,
  ADD_TASK_TO_RELEASE_MUTATION,
  REMOVE_TASK_FROM_RELEASE_MUTATION,
  GENERATE_RELEASE_NOTES_MUTATION,
} from '../api/queries';
import type { Release, Task } from '../types';

interface ReleaseConnection {
  releases: Release[];
  hasMore: boolean;
  nextCursor: string | null;
}

interface UseReleaseManagementOptions {
  projectId: string | undefined;
  setErr: (err: string | null) => void;
}

export function useReleaseManagement({ projectId, setErr }: UseReleaseManagementOptions) {
  const [releases, setReleases] = useState<Release[]>([]);
  const [selectedRelease, setSelectedRelease] = useState<Release | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingRelease, setEditingRelease] = useState<Release | null>(null);
  const [loading, setLoading] = useState(false);

  const loadReleases = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    try {
      const data = await gql<{ releases: ReleaseConnection }>(RELEASES_QUERY, { projectId });
      setReleases(data.releases.releases);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const createRelease = useCallback(async (args: { name: string; version: string; description?: string; releaseDate?: string }) => {
    if (!projectId) return;
    try {
      const data = await gql<{ createRelease: Release }>(CREATE_RELEASE_MUTATION, { projectId, ...args });
      setReleases((prev) => [data.createRelease, ...prev]);
      setShowCreateModal(false);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create release');
    }
  }, [projectId, setErr]);

  const updateRelease = useCallback(async (releaseId: string, updates: Partial<Pick<Release, 'name' | 'version' | 'description' | 'status' | 'releaseDate' | 'releaseNotes'>>) => {
    try {
      const data = await gql<{ updateRelease: Release }>(UPDATE_RELEASE_MUTATION, { releaseId, ...updates });
      setReleases((prev) => prev.map((r) => r.releaseId === releaseId ? data.updateRelease : r));
      setSelectedRelease((prev) => prev?.releaseId === releaseId ? data.updateRelease : prev);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update release');
    }
  }, [setErr]);

  const deleteRelease = useCallback(async (releaseId: string) => {
    try {
      await gql<{ deleteRelease: boolean }>(DELETE_RELEASE_MUTATION, { releaseId });
      setReleases((prev) => prev.filter((r) => r.releaseId !== releaseId));
      setSelectedRelease((prev) => prev?.releaseId === releaseId ? null : prev);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to delete release');
    }
  }, [setErr]);

  const addTaskToRelease = useCallback(async (releaseId: string, task: Task) => {
    try {
      await gql<{ addTaskToRelease: boolean }>(ADD_TASK_TO_RELEASE_MUTATION, { releaseId, taskId: task.taskId });
      setReleases((prev) => prev.map((r) => r.releaseId === releaseId ? { ...r, tasks: [...(r.tasks ?? []), task] } : r));
      setSelectedRelease((prev) => prev?.releaseId === releaseId ? { ...prev, tasks: [...(prev.tasks ?? []), task] } : prev);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to add task');
    }
  }, [setErr]);

  const removeTaskFromRelease = useCallback(async (releaseId: string, taskId: string) => {
    try {
      await gql<{ removeTaskFromRelease: boolean }>(REMOVE_TASK_FROM_RELEASE_MUTATION, { releaseId, taskId });
      setReleases((prev) => prev.map((r) => r.releaseId === releaseId ? { ...r, tasks: (r.tasks ?? []).filter((t) => t.taskId !== taskId) } : r));
      setSelectedRelease((prev) => prev?.releaseId === releaseId ? { ...prev, tasks: (prev.tasks ?? []).filter((t) => t.taskId !== taskId) } : prev);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to remove task');
    }
  }, [setErr]);

  const generateReleaseNotes = useCallback(async (releaseId: string) => {
    try {
      const data = await gql<{ generateReleaseNotes: Release }>(GENERATE_RELEASE_NOTES_MUTATION, { releaseId });
      setReleases((prev) => prev.map((r) => r.releaseId === releaseId ? data.generateReleaseNotes : r));
      setSelectedRelease((prev) => prev?.releaseId === releaseId ? data.generateReleaseNotes : prev);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to generate release notes');
    }
  }, [setErr]);

  const loadRelease = useCallback(async (releaseId: string) => {
    try {
      const data = await gql<{ release: Release }>(RELEASE_QUERY, { releaseId });
      setSelectedRelease(data.release);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to load release');
    }
  }, [setErr]);

  return {
    releases,
    selectedRelease,
    showCreateModal,
    editingRelease,
    loading,
    loadReleases,
    loadRelease,
    createRelease,
    updateRelease,
    deleteRelease,
    addTaskToRelease,
    removeTaskFromRelease,
    generateReleaseNotes,
    setSelectedRelease,
    setShowCreateModal,
    setEditingRelease,
  };
}
