import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { apiGet, apiPost, apiPatch } from '../api/client';
import type { Task } from '../types';

export default function ProjectDetail() {
  const { projectId } = useParams<{ projectId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const load = async () => {
    if (!projectId) return;
    const { data } = await apiGet<Task[]>(`/projects/${projectId}/tasks`);
    if (data) setTasks(data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [projectId]);

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) return;
    setErr(null);
    const { error } = await apiPost<Task>(`/projects/${projectId}/tasks`, { title });
    if (error) {
      setErr(error);
      return;
    }
    setTitle('');
    load();
  };

  const handleStatusChange = async (taskId: string, status: Task['status']) => {
    const { error } = await apiPatch<Task>(`/tasks/${taskId}`, { status });
    if (!error) load();
  };

  if (!projectId) return null;

  return (
    <div>
      <Link to="/app" className="text-slate-600 hover:underline mb-4 inline-block">
        ← Projects
      </Link>

      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Tasks</h1>

      <form onSubmit={handleCreateTask} className="mb-6 p-4 bg-white rounded-lg shadow space-y-3">
        <input
          type="text"
          placeholder="New task title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full max-w-md px-3 py-2 border border-slate-300 rounded"
          required
        />
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="submit" className="px-4 py-2 bg-slate-800 text-white rounded">
          Add task
        </button>
      </form>

      {loading ? (
        <p className="text-slate-600">Loading…</p>
      ) : tasks.length === 0 ? (
        <p className="text-slate-600">No tasks yet.</p>
      ) : (
        <ul className="space-y-2">
          {tasks.map((t) => (
            <li
              key={t.taskId}
              className="p-4 bg-white rounded-lg shadow flex items-center justify-between"
            >
              <span className="text-slate-800">{t.title}</span>
              <select
                value={t.status}
                onChange={(e) =>
                  handleStatusChange(t.taskId, e.target.value as Task['status'])
                }
                className="border border-slate-300 rounded px-2 py-1 text-sm"
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="done">Done</option>
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
