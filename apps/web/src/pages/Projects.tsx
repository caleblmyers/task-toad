import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '../api/client';
import type { Project } from '../types';

export default function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    gql<{ projects: Project[] }>(
      'query { projects { projectId name description createdAt } }'
    )
      .then((data) => setProjects(data.projects))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Projects</h1>
        <Link
          to="/app"
          className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700"
        >
          New project
        </Link>
      </div>

      {loading ? (
        <p className="text-slate-600">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-slate-600">No projects yet. <Link to="/app" className="underline">Start one.</Link></p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.projectId}>
              <Link
                to={`/app/projects/${p.projectId}`}
                className="block p-4 bg-white rounded-lg shadow hover:bg-slate-50"
              >
                <p className="font-medium text-slate-800">{p.name}</p>
                {p.description && (
                  <p className="text-sm text-slate-500 mt-0.5">{p.description}</p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
