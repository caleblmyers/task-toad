import { useState } from 'react';
import { gql } from '../api/client';
import type { Sprint } from '../types';

interface SprintCreateModalProps {
  projectId: string;
  initialSprint?: Sprint;
  onCreated: (sprint: Sprint) => void;
  onUpdated?: (sprint: Sprint) => void;
  onClose: () => void;
}

const DEFAULT_COLUMNS = ['To Do', 'In Progress', 'Done'];

export default function SprintCreateModal({ projectId, initialSprint, onCreated, onUpdated, onClose }: SprintCreateModalProps) {
  const isEdit = !!initialSprint;
  const [name, setName] = useState(initialSprint?.name ?? '');
  const [startDate, setStartDate] = useState(initialSprint?.startDate ?? '');
  const [endDate, setEndDate] = useState(initialSprint?.endDate ?? '');
  const initialColumns = initialSprint ? (() => { try { return JSON.parse(initialSprint.columns) as string[]; } catch { return DEFAULT_COLUMNS; } })() : DEFAULT_COLUMNS;
  const [columns, setColumns] = useState<string[]>(initialColumns);
  const [newCol, setNewCol] = useState('');
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingVal, setEditingVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      if (isEdit && initialSprint) {
        const data = await gql<{ updateSprint: Sprint }>(
          `mutation UpdateSprint($sprintId: ID!, $name: String, $columns: String, $startDate: String, $endDate: String) {
            updateSprint(sprintId: $sprintId, name: $name, columns: $columns, startDate: $startDate, endDate: $endDate) {
              sprintId projectId name isActive columns startDate endDate createdAt closedAt
            }
          }`,
          {
            sprintId: initialSprint.sprintId,
            name: name.trim(),
            columns: JSON.stringify(columns),
            startDate: startDate || null,
            endDate: endDate || null,
          }
        );
        onUpdated?.(data.updateSprint);
      } else {
        const data = await gql<{ createSprint: Sprint }>(
          `mutation CreateSprint($projectId: ID!, $name: String!, $columns: String, $startDate: String, $endDate: String) {
            createSprint(projectId: $projectId, name: $name, columns: $columns, startDate: $startDate, endDate: $endDate) {
              sprintId projectId name isActive columns startDate endDate createdAt closedAt
            }
          }`,
          {
            projectId,
            name: name.trim(),
            columns: JSON.stringify(columns),
            startDate: startDate || null,
            endDate: endDate || null,
          }
        );
        onCreated(data.createSprint);
      }
    } catch (error) {
      setErr(error instanceof Error ? error.message : isEdit ? 'Failed to update sprint' : 'Failed to create sprint');
    } finally {
      setLoading(false);
    }
  };

  const addColumn = () => {
    const val = newCol.trim();
    if (!val) return;
    setColumns((prev) => [...prev, val]);
    setNewCol('');
  };

  const removeColumn = (idx: number) => {
    if (columns.length <= 1) return;
    setColumns((prev) => prev.filter((_, i) => i !== idx));
  };

  const startEditCol = (idx: number) => {
    setEditingIdx(idx);
    setEditingVal(columns[idx]);
  };

  const saveEditCol = () => {
    if (editingIdx === null) return;
    if (editingVal.trim()) {
      setColumns((prev) => prev.map((c, i) => i === editingIdx ? editingVal.trim() : c));
    }
    setEditingIdx(null);
    setEditingVal('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">{isEdit ? 'Edit Sprint' : 'Create Sprint'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Sprint 1"
              required
              autoFocus
              className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Columns</label>
            <div className="flex flex-wrap gap-2 mb-2">
              {columns.map((col, idx) => (
                editingIdx === idx ? (
                  <input
                    key={idx}
                    type="text"
                    value={editingVal}
                    onChange={(e) => setEditingVal(e.target.value)}
                    onBlur={saveEditCol}
                    onKeyDown={(e) => { if (e.key === 'Enter') saveEditCol(); if (e.key === 'Escape') setEditingIdx(null); }}
                    autoFocus
                    className="border border-blue-400 rounded px-2 py-0.5 text-sm w-28 focus:outline-none"
                  />
                ) : (
                  <span
                    key={idx}
                    className="flex items-center gap-1 bg-slate-100 text-slate-700 text-xs px-2 py-1 rounded-full"
                  >
                    <button type="button" onClick={() => startEditCol(idx)} className="hover:underline">{col}</button>
                    {columns.length > 1 && (
                      <button type="button" onClick={() => removeColumn(idx)} className="text-slate-400 hover:text-red-500 ml-0.5">×</button>
                    )}
                  </span>
                )
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCol}
                onChange={(e) => setNewCol(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColumn(); }}}
                placeholder="Add column…"
                className="flex-1 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-slate-400"
              />
              <button
                type="button"
                onClick={addColumn}
                className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50"
              >
                +
              </button>
            </div>
          </div>

          {err && <p className="text-xs text-red-600">{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-1.5 text-sm text-slate-600 border border-slate-300 rounded hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="px-4 py-1.5 text-sm bg-slate-700 text-white rounded hover:bg-slate-600 disabled:opacity-50"
            >
              {loading ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Sprint')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
