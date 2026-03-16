import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gql } from '../api/client';
import type { Task, Project } from '../types';
import { statusLabel } from '../utils/taskHelpers';
import Modal from './shared/Modal';

interface TaskSearchHit {
  task: Task;
  projectName: string;
}

interface GlobalSearchResult {
  tasks: TaskSearchHit[];
  projects: Project[];
}

interface GlobalSearchModalProps {
  onClose: () => void;
}

export default function GlobalSearchModal({ onClose }: GlobalSearchModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults(null); setError(null); return; }
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ globalSearch: GlobalSearchResult }>(
        `query GlobalSearch($query: String!) { globalSearch(query: $query, limit: 10) {
          tasks { task { taskId title status projectId } projectName }
          projects { projectId name }
        } }`,
        { query: q }
      );
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

  const handleProjectClick = (projectId: string) => {
    navigate(`/app/projects/${projectId}`);
    onClose();
  };

  const handleTaskClick = (projectId: string) => {
    navigate(`/app/projects/${projectId}`);
    onClose();
  };

  const hasResults = results && (results.projects.length > 0 || results.tasks.length > 0);

  return (
    <Modal isOpen={true} onClose={onClose} title="Global Search" size="md" variant="top-aligned">
      {/* Search input */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-slate-200">
        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5L14 14" strokeLinecap="round" />
        </svg>
        <label htmlFor="global-search-input" className="sr-only">Search across all projects</label>
        <input
          id="global-search-input"
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          placeholder="Search across all projects…"
          className="flex-1 text-sm text-slate-800 outline-none bg-transparent placeholder:text-slate-400"
        />
        <kbd className="text-[10px] text-slate-400 border border-slate-200 rounded px-1.5 py-0.5">ESC</kbd>
      </div>

      {error && (
        <p className="text-xs text-red-500 px-4 py-1">{error}</p>
      )}

      {/* Results */}
      <div className="max-h-[50vh] overflow-y-auto">
        {loading && (
          <p className="text-xs text-slate-400 text-center py-6">Searching...</p>
        )}

        {!loading && !query && (
          <p className="text-xs text-slate-400 text-center py-6">Type to search across all projects</p>
        )}

        {!loading && query && !hasResults && (
          <p className="text-xs text-slate-400 text-center py-6">No results found</p>
        )}

        {!loading && hasResults && (
          <div>
            {results!.projects.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide px-4 pt-3 pb-1">Projects</p>
                {results!.projects.map((p) => (
                  <button
                    key={p.projectId}
                    onClick={() => handleProjectClick(p.projectId)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <span className="text-sm text-slate-700">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
            {results!.tasks.length > 0 && (
              <div>
                <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide px-4 pt-3 pb-1">Tasks</p>
                {results!.tasks.map((hit) => (
                  <button
                    key={hit.task.taskId}
                    onClick={() => handleTaskClick(hit.task.projectId)}
                    className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-700 truncate">{hit.task.title}</p>
                      <p className="text-xs text-slate-400">{hit.projectName}</p>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded flex-shrink-0">
                      {statusLabel(hit.task.status)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
