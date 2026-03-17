import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '../api/client';
import type { Project } from '../types';
import { useAuth } from '../auth/context';
import ErrorBanner from '../components/shared/ErrorBanner';

export default function Projects() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'org:admin';
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProjects = useCallback(() => {
    setLoading(true);
    setError(null);
    gql<{ projects: Project[] }>(
      `query ($includeArchived: Boolean) { projects(includeArchived: $includeArchived) { projectId name description createdAt archived } }`,
      { includeArchived: showArchived }
    )
      .then((data) => setProjects(data.projects))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load projects'))
      .finally(() => setLoading(false));
  }, [showArchived]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await gql<{ projects: Project[] }>(
          `query ($includeArchived: Boolean) { projects(includeArchived: $includeArchived) { projectId name description createdAt archived } }`,
          { includeArchived: showArchived },
        );
        if (!cancelled) setProjects(data.projects);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Failed to load projects');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [showArchived]);

  const handleArchive = async (projectId: string, archived: boolean) => {
    try {
      await gql<{ archiveProject: Project }>(
        `mutation ArchiveProject($projectId: ID!, $archived: Boolean!) {
          archiveProject(projectId: $projectId, archived: $archived) { projectId archived }
        }`,
        { projectId, archived }
      );
      if (!showArchived) {
        setProjects((prev) => prev.filter((p) => p.projectId !== projectId || !archived));
      } else {
        setProjects((prev) =>
          prev.map((p) => p.projectId === projectId ? { ...p, archived } : p)
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to archive project');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Projects</h1>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <label className="flex items-center gap-1.5 text-sm text-slate-500 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
                className="rounded border-slate-300"
              />
              Show archived
            </label>
          )}
          <Link
            to="/app"
            className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover"
          >
            New project
          </Link>
        </div>
      </div>

      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={fetchProjects} onDismiss={() => setError(null)} />
        </div>
      )}

      {loading ? (
        <p className="text-slate-600">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-slate-600">No projects yet. <Link to="/app" className="underline">Start one.</Link></p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.projectId} className="flex items-center gap-2">
              <Link
                to={`/app/projects/${p.projectId}`}
                className={`flex-1 block p-4 bg-white rounded-lg shadow hover:bg-slate-50 ${p.archived ? 'opacity-60' : ''}`}
              >
                <p className={`font-medium text-slate-800 ${p.archived ? 'italic' : ''}`}>
                  {p.name}
                  {p.archived && <span className="ml-2 text-xs text-slate-500 font-normal not-italic">(archived)</span>}
                </p>
                {p.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{p.description}</p>
                )}
              </Link>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => handleArchive(p.projectId, !p.archived)}
                  className="text-xs text-slate-500 hover:text-slate-600 px-2 py-1 border border-slate-200 rounded hover:bg-slate-50 flex-shrink-0"
                >
                  {p.archived ? 'Unarchive' : 'Archive'}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
