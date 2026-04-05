import { useState, useCallback, useMemo } from 'react';
import { gql } from '../api/client';
import { PROJECT_QUERY, ORG_USERS_QUERY, PROJECT_STATS_QUERY, UPDATE_PROJECT_MUTATION, EPICS_QUERY, REFRESH_REPO_PROFILE_MUTATION } from '../api/queries';
import { parseStatuses } from '../utils/jsonHelpers';
import type { OrgUser, Project, ProjectStats, Epic } from '../types';

const VIEW_KEY = 'task-toad-view';

type ViewType = 'autopilot' | 'backlog' | 'board' | 'dashboard' | 'table' | 'calendar' | 'epics' | 'releases' | 'timesheet';

interface UseProjectStateOptions {
  projectId: string | undefined;
  setErr: (err: string | null) => void;
}

export function useProjectState({ projectId, setErr }: UseProjectStateOptions) {
  const [project, setProject] = useState<Project | null>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [dashboardStats, setDashboardStats] = useState<ProjectStats | null>(null);
  const [epics, setEpics] = useState<Epic[]>([]);

  const stored = localStorage.getItem(VIEW_KEY);
  const validViews = ['autopilot', 'backlog', 'board', 'dashboard', 'table', 'calendar', 'epics', 'releases', 'timesheet'];
  const [view, setView] = useState<ViewType>(
    validViews.includes(stored ?? '') ? (stored as ViewType) : 'autopilot'
  );

  const projectStatuses: string[] = useMemo(() => {
    if (!project) return ['todo', 'in_progress', 'done'];
    return parseStatuses(project.statuses);
  }, [project]);

  const epicMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const e of epics) map.set(e.taskId, e.title);
    return map;
  }, [epics]);

  // ── Loaders ──

  const loadProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await gql<{ project: Project | null }>(PROJECT_QUERY, { projectId });
      if (data.project) setProject(data.project);
    } catch {
      // ignore
    }
  }, [projectId]);

  const loadOrgUsers = useCallback(async () => {
    try {
      const data = await gql<{ orgUsers: OrgUser[] }>(ORG_USERS_QUERY);
      setOrgUsers(data.orgUsers);
    } catch {
      // ignore
    }
  }, []);

  const loadEpics = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await gql<{ epics: Epic[] }>(EPICS_QUERY, { projectId });
      setEpics(data.epics);
    } catch {
      // ignore
    }
  }, [projectId]);

  const loadDashboardStats = useCallback(async () => {
    if (!projectId) return;
    try {
      const data = await gql<{ projectStats: ProjectStats }>(PROJECT_STATS_QUERY, { projectId });
      setDashboardStats(data.projectStats);
    } catch {
      // ignore
    }
  }, [projectId]);

  // ── Mutations ──

  const handleUpdateProject = useCallback(async (data: { name?: string; description?: string; prompt?: string; knowledgeBase?: string; statuses?: string }) => {
    if (!projectId) return;
    try {
      const result = await gql<{ updateProject: Project }>(UPDATE_PROJECT_MUTATION, { projectId, ...data });
      setProject(result.updateProject);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to update project');
    }
  }, [projectId, setErr]);

  const handleRefreshRepoProfile = useCallback(async () => {
    if (!projectId) return;
    try {
      const result = await gql<{ refreshRepoProfile: Project }>(REFRESH_REPO_PROFILE_MUTATION, { projectId });
      setProject(result.refreshRepoProfile);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to refresh repo profile');
    }
  }, [projectId, setErr]);

  const switchView = useCallback((v: ViewType) => {
    setView(v);
    localStorage.setItem(VIEW_KEY, v);
    if (v === 'dashboard') loadDashboardStats();
  }, [loadDashboardStats]);

  return {
    project, orgUsers, dashboardStats, epics, epicMap, view, projectStatuses,
    loadProject, loadOrgUsers, loadEpics, loadDashboardStats,
    handleUpdateProject, handleRefreshRepoProfile, switchView,
  };
}
