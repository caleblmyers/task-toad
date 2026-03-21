import { useState, useEffect, useRef, useCallback } from 'react';
import type { SavedFilter } from './FilterBar';
import type { ViewConfig } from '../../hooks/useTaskFiltering';
import { gql } from '../../api/client';
import { SHARED_VIEWS_QUERY, SAVE_VIEW_MUTATION, DELETE_FILTER_MUTATION } from '../../api/queries';
import { IconList, IconBoard, IconTable } from './Icons';

interface SavedViewPickerProps {
  projectId: string;
  savedFilters: SavedFilter[];
  onSavedFiltersChange: (filters: SavedFilter[]) => void;
  onLoadFilter: (filtersJson: string, viewConfig?: ViewConfig) => void;
  currentViewType?: string;
}

const viewTypeIcon: Record<string, React.ReactNode> = {
  list: <IconList className="w-3 h-3" />,
  board: <IconBoard className="w-3 h-3" />,
  table: <IconTable className="w-3 h-3" />,
};

export default function SavedViewPicker({
  projectId,
  savedFilters,
  onSavedFiltersChange,
  onLoadFilter,
  currentViewType,
}: SavedViewPickerProps) {
  const [open, setOpen] = useState(false);
  const [showSave, setShowSave] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [saveViewTypeOverride, setSaveViewTypeOverride] = useState<string | null>(null);
  const saveViewType = saveViewTypeOverride ?? currentViewType ?? 'list';
  const [saveSortBy, setSaveSortBy] = useState('');
  const [saveSortOrder, setSaveSortOrder] = useState('asc');
  const [saveGroupBy, setSaveGroupBy] = useState('');
  const [saveIsShared, setSaveIsShared] = useState(false);
  const [sharedViews, setSharedViews] = useState<SavedFilter[]>([]);
  const [error, setError] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Fetch shared views when opening
  const fetchSharedViews = useCallback(async () => {
    try {
      const { sharedViews: views } = await gql<{ sharedViews: SavedFilter[] }>(
        SHARED_VIEWS_QUERY,
        { projectId },
      );
      setSharedViews(views);
    } catch { /* non-critical */ }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- data-fetching on open is valid
    if (open) fetchSharedViews();
  }, [open, fetchSharedViews]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setShowSave(false);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpen(false); setShowSave(false); }
    };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [open]);

  const handleLoadView = (view: SavedFilter) => {
    onLoadFilter(view.filters, {
      viewType: view.viewType,
      sortBy: view.sortBy,
      sortOrder: view.sortOrder,
      groupBy: view.groupBy,
    });
    setOpen(false);
  };

  const handleSaveView = async () => {
    if (!saveName.trim()) return;
    try {
      setError(null);
      const { saveFilter } = await gql<{ saveFilter: SavedFilter }>(
        SAVE_VIEW_MUTATION,
        {
          projectId,
          name: saveName.trim(),
          filters: '{}',
          viewType: saveViewType || null,
          sortBy: saveSortBy || null,
          sortOrder: saveSortOrder || null,
          groupBy: saveGroupBy || null,
          isShared: saveIsShared,
        },
      );
      onSavedFiltersChange([...savedFilters, saveFilter]);
      setSaveName('');
      setSaveViewTypeOverride(null);
      setShowSave(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save view');
    }
  };

  const handleDeleteView = async (filterId: string) => {
    try {
      setError(null);
      await gql<{ deleteFilter: boolean }>(
        DELETE_FILTER_MUTATION,
        { savedFilterId: filterId },
      );
      onSavedFiltersChange(savedFilters.filter((f) => f.savedFilterId !== filterId));
      setSharedViews((prev) => prev.filter((f) => f.savedFilterId !== filterId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete view');
    }
  };

  // Shared views that aren't also in the user's own list
  const ownIds = new Set(savedFilters.map((f) => f.savedFilterId));
  const otherSharedViews = sharedViews.filter((v) => !ownIds.has(v.savedFilterId));

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-sm px-2 py-1 rounded-md text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
      >
        <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <path d="M2 6h12M6 6v8" />
        </svg>
        Views
        {(savedFilters.length > 0 || otherSharedViews.length > 0) && (
          <span className="text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-full px-1.5">
            {savedFilters.length + otherSharedViews.length}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg z-50 min-w-[260px] py-1">
          {error && <p className="text-xs text-red-500 px-3 py-1">{error}</p>}

          {/* Personal views */}
          {savedFilters.length > 0 && (
            <>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide px-3 pt-2 pb-1">My Views</p>
              {savedFilters.map((view) => (
                <div key={view.savedFilterId} className="flex items-center justify-between px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700 group">
                  <button
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 text-left flex-1 min-w-0"
                    onClick={() => handleLoadView(view)}
                  >
                    {view.viewType ? viewTypeIcon[view.viewType] ?? null : null}
                    <span className="truncate">{view.name}</span>
                    {view.isShared && (
                      <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded px-1">shared</span>
                    )}
                  </button>
                  <button
                    onClick={() => handleDeleteView(view.savedFilterId)}
                    className="text-xs text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 ml-2"
                    title="Delete view"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </>
          )}

          {/* Shared views from others */}
          {otherSharedViews.length > 0 && (
            <>
              <p className="text-[10px] font-medium text-slate-400 uppercase tracking-wide px-3 pt-2 pb-1">Shared Views</p>
              {otherSharedViews.map((view) => (
                <div key={view.savedFilterId} className="flex items-center px-3 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-700">
                  <button
                    className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300 text-left flex-1 min-w-0"
                    onClick={() => handleLoadView(view)}
                  >
                    {view.viewType ? viewTypeIcon[view.viewType] ?? null : null}
                    <span className="truncate">{view.name}</span>
                    <span className="text-[10px] bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded px-1">shared</span>
                  </button>
                </div>
              ))}
            </>
          )}

          {savedFilters.length === 0 && otherSharedViews.length === 0 && !showSave && (
            <p className="text-xs text-slate-400 px-3 py-2">No saved views yet.</p>
          )}

          <hr className="my-1 border-slate-100 dark:border-slate-700" />

          {/* Save new view */}
          {showSave ? (
            <div className="px-3 py-2 space-y-2">
              <input
                type="text"
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                placeholder="View name"
                className="w-full text-sm border border-slate-300 dark:border-slate-600 rounded px-2 py-1 dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-brand-green"
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveView(); }}
                autoFocus
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">View Type</label>
                  <select
                    value={saveViewType}
                    onChange={(e) => setSaveViewTypeOverride(e.target.value)}
                    className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="list">List</option>
                    <option value="board">Board</option>
                    <option value="table">Table</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Sort By</label>
                  <select
                    value={saveSortBy}
                    onChange={(e) => setSaveSortBy(e.target.value)}
                    className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="">Default</option>
                    <option value="priority">Priority</option>
                    <option value="dueDate">Due Date</option>
                    <option value="createdAt">Created</option>
                    <option value="title">Title</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Order</label>
                  <select
                    value={saveSortOrder}
                    onChange={(e) => setSaveSortOrder(e.target.value)}
                    className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400 uppercase">Group By</label>
                  <select
                    value={saveGroupBy}
                    onChange={(e) => setSaveGroupBy(e.target.value)}
                    className="w-full text-xs border border-slate-300 dark:border-slate-600 rounded px-1.5 py-1 dark:bg-slate-700 dark:text-slate-200"
                  >
                    <option value="">None</option>
                    <option value="assignee">Assignee</option>
                    <option value="priority">Priority</option>
                    <option value="epic">Epic</option>
                    <option value="status">Status</option>
                  </select>
                </div>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={saveIsShared}
                  onChange={(e) => setSaveIsShared(e.target.checked)}
                  className="rounded border-slate-300"
                />
                Share with team
              </label>
              <div className="flex gap-2">
                <button
                  onClick={handleSaveView}
                  disabled={!saveName.trim()}
                  className="flex-1 px-2 py-1 bg-brand-green text-white text-xs rounded hover:bg-brand-green-hover disabled:opacity-50"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowSave(false)}
                  className="px-2 py-1 text-xs text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowSave(true)}
              className="w-full text-left px-3 py-1.5 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              + Save Current View
            </button>
          )}
        </div>
      )}
    </div>
  );
}
