import { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gql } from '../api/client';
import type { Task, Project } from '../types';
import { statusLabel } from '../utils/taskHelpers';
import ErrorBanner from '../components/shared/ErrorBanner';

interface TaskSearchHit {
  task: Task;
  projectName: string;
}

interface GlobalSearchResult {
  tasks: TaskSearchHit[];
  projects: Project[];
}

const statusColors: Record<string, string> = {
  done: 'bg-green-100 text-green-700',
  in_progress: 'bg-blue-100 text-blue-700',
  in_review: 'bg-amber-100 text-amber-700',
  todo: 'bg-slate-100 text-slate-500',
};

const QUERY = `query GlobalSearch($query: String!, $limit: Int) {
  globalSearch(query: $query, limit: $limit) {
    tasks { task { taskId title status assigneeId projectId description } projectName }
    projects { projectId name description }
  }
}`;

export default function Search() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(null); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ globalSearch: GlobalSearchResult }>(QUERY, { query: q, limit: 20 });
      setResults(data.globalSearch);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(val), 300);
  };

  const hasResults = results && (results.projects.length > 0 || results.tasks.length > 0);

  return (
    <div className="max-w-3xl mx-auto">
      {/* Search input */}
      <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-xl px-4 py-3 shadow-sm mb-6">
        <svg className="w-5 h-5 text-slate-400 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search across all your projects..."
          className="flex-1 text-base text-slate-800 outline-none bg-transparent placeholder:text-slate-400"
          autoFocus
        />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={() => search(query)} onDismiss={() => setError(null)} />
        </div>
      )}

      {/* Empty state */}
      {!query && !loading && (
        <div className="text-center py-16">
          <svg className="w-10 h-10 text-slate-300 mx-auto mb-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" strokeLinecap="round" />
          </svg>
          <p className="text-slate-400 text-sm">Search across all your projects and tasks</p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-white border border-slate-200 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-slate-100 rounded w-3/5 mb-2" />
              <div className="h-3 bg-slate-100 rounded w-2/5" />
            </div>
          ))}
        </div>
      )}

      {/* No results */}
      {!loading && query && !hasResults && (
        <div className="text-center py-16">
          <p className="text-slate-400 text-sm">No results for &ldquo;{query}&rdquo;</p>
        </div>
      )}

      {/* Results */}
      {!loading && hasResults && (
        <div className="space-y-6">
          {/* Projects */}
          {results!.projects.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Projects</h3>
              <div className="grid gap-2">
                {results!.projects.map((p) => (
                  <button
                    key={p.projectId}
                    onClick={() => navigate(`/app/projects/${p.projectId}`)}
                    className="bg-white border border-slate-200 rounded-lg p-4 text-left hover:border-slate-300 hover:shadow-sm transition-all"
                  >
                    <p className="text-sm font-medium text-slate-800">{p.name}</p>
                    {p.description && (
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tasks */}
          {results!.tasks.length > 0 && (
            <div>
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Tasks</h3>
              <div className="bg-white border border-slate-200 rounded-lg divide-y divide-slate-100">
                {results!.tasks.map((hit) => (
                  <button
                    key={hit.task.taskId}
                    onClick={() => navigate(`/app/projects/${hit.task.projectId}?task=${hit.task.taskId}`)}
                    className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors flex items-center gap-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{hit.task.title}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{hit.projectName}</p>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded font-medium flex-shrink-0 ${statusColors[hit.task.status] ?? 'bg-slate-100 text-slate-500'}`}>
                      {statusLabel(hit.task.status)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
