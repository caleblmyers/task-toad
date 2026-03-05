import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { apiGet, apiPost } from '../api/client';
import type { Project } from '../types';

export default function Projects() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    const { data } = await apiGet<Project[]>('/projects');
    if (data) setProjects(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const { error } = await apiPost<Project>('/projects', { name });
    if (error) {
      setErr(error);
      return;
    }
    setName('');
    setShowForm(false);
    load();
  };

  const isAdmin = user?.role === 'org:admin';

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Projects</h1>
        {isAdmin && (
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2 bg-slate-800 text-white rounded"
          >
            {showForm ? 'Cancel' : 'New project'}
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="mb-6 p-4 bg-white rounded-lg shadow space-y-3">
          <input
            type="text"
            placeholder="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full max-w-xs px-3 py-2 border border-slate-300 rounded"
            required
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded">
            Create
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-slate-600">Loading…</p>
      ) : projects.length === 0 ? (
        <p className="text-slate-600">No projects yet. {isAdmin && 'Create one above.'}</p>
      ) : (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.projectId}>
              <Link
                to={`/app/projects/${p.projectId}`}
                className="block p-4 bg-white rounded-lg shadow hover:bg-slate-50"
              >
                <span className="font-medium text-slate-800">{p.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
