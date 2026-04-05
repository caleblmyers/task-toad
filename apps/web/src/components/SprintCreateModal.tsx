import { useState } from 'react';
import { gql } from '../api/client';
import { UPDATE_SPRINT_MUTATION, CREATE_SPRINT_MUTATION } from '../api/queries';
import type { Sprint } from '../types';
import { parseColumns } from '../utils/jsonHelpers';
import Modal from './shared/Modal';
import Button from './shared/Button';

interface SprintCreateModalProps {
  projectId: string;
  initialSprint?: Sprint;
  previousSprint?: { name: string; endDate?: string | null; startDate?: string | null };
  onCreated: (sprint: Sprint) => void;
  onUpdated?: (sprint: Sprint) => void;
  onClose: () => void;
}

const DEFAULT_COLUMNS = ['To Do', 'In Progress', 'In Review', 'Done'];

function computeDefaults(prev?: { name: string; endDate?: string | null; startDate?: string | null }) {
  if (!prev) return { name: '', startDate: '', endDate: '' };
  // Auto-increment name: "Session 1" → "Session 2", "Session 10" → "Session 11"
  const nameMatch = prev.name.match(/^(.+?)(\d+)$/);
  const nextName = nameMatch ? `${nameMatch[1]}${parseInt(nameMatch[2], 10) + 1}` : `${prev.name} 2`;
  // Start date = day after previous end date
  let nextStart = '';
  let nextEnd = '';
  if (prev.endDate) {
    const end = new Date(prev.endDate);
    end.setDate(end.getDate() + 1);
    nextStart = end.toISOString().slice(0, 10);
    // Same duration if both dates existed
    if (prev.startDate) {
      const duration = new Date(prev.endDate).getTime() - new Date(prev.startDate).getTime();
      const newEnd = new Date(end.getTime() + duration);
      nextEnd = newEnd.toISOString().slice(0, 10);
    }
  }
  return { name: nextName, startDate: nextStart, endDate: nextEnd };
}

export default function SprintCreateModal({ projectId, initialSprint, previousSprint, onCreated, onUpdated, onClose }: SprintCreateModalProps) {
  const isEdit = !!initialSprint;
  const defaults = !isEdit ? computeDefaults(previousSprint) : undefined;
  const [name, setName] = useState(initialSprint?.name ?? defaults?.name ?? '');
  const [goal, setGoal] = useState(initialSprint?.goal ?? '');
  const [startDate, setStartDate] = useState(initialSprint?.startDate ?? defaults?.startDate ?? '');
  const [endDate, setEndDate] = useState(initialSprint?.endDate ?? defaults?.endDate ?? '');
  const initialColumns = initialSprint ? parseColumns(initialSprint.columns) : DEFAULT_COLUMNS;
  const [columns, setColumns] = useState<string[]>(initialColumns);
  const [newCol, setNewCol] = useState('');
  const initialWipLimits: Record<string, number> = (() => {
    if (!initialSprint?.wipLimits) return {};
    try { return JSON.parse(initialSprint.wipLimits); } catch { return {}; }
  })();
  const [wipLimits, setWipLimits] = useState<Record<string, number>>(initialWipLimits);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editingVal, setEditingVal] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setErr(null);
    const wipLimitsJson = Object.keys(wipLimits).length > 0 ? JSON.stringify(wipLimits) : null;
    try {
      if (isEdit && initialSprint) {
        const data = await gql<{ updateSprint: Sprint }>(
          UPDATE_SPRINT_MUTATION,
          {
            sprintId: initialSprint.sprintId,
            name: name.trim(),
            goal: goal.trim() || null,
            columns: JSON.stringify(columns),
            startDate: startDate || null,
            endDate: endDate || null,
            wipLimits: wipLimitsJson,
          }
        );
        onUpdated?.(data.updateSprint);
      } else {
        const data = await gql<{ createSprint: Sprint }>(
          CREATE_SPRINT_MUTATION,
          {
            projectId,
            name: name.trim(),
            goal: goal.trim() || null,
            columns: JSON.stringify(columns),
            startDate: startDate || null,
            endDate: endDate || null,
            wipLimits: wipLimitsJson,
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
    <Modal isOpen={true} onClose={onClose} title={isEdit ? 'Edit Session' : 'Create Session'} size="sm">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">{isEdit ? 'Edit Session' : 'Create Session'}</h2>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg" aria-label="Close">✕</button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="sprint-name" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Name *</label>
            <input
              id="sprint-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Session 1"
              required
              autoFocus
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
          </div>

          <div>
            <label htmlFor="sprint-goal" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Session Goal (optional)</label>
            <textarea
              id="sprint-goal"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="What is this sprint's objective?"
              rows={2}
              className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green resize-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label htmlFor="sprint-start-date" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Start Date</label>
              <input
                id="sprint-start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="sprint-end-date" className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">End Date</label>
              <input
                id="sprint-end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Columns</label>
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
                    className="border border-blue-400 dark:border-blue-500 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-0.5 text-sm w-28 focus:outline-none"
                  />
                ) : (
                  <span
                    key={idx}
                    className="flex items-center gap-1 bg-slate-100 dark:bg-slate-600 text-slate-700 dark:text-slate-300 text-xs px-2 py-1 rounded-full"
                  >
                    <button type="button" onClick={() => startEditCol(idx)} className="hover:underline">{col}</button>
                    {columns.length > 1 && (
                      <button type="button" onClick={() => removeColumn(idx)} className="text-slate-400 hover:text-red-500 ml-0.5" aria-label={`Remove column ${col}`}>×</button>
                    )}
                  </span>
                )
              ))}
            </div>
            <div className="flex gap-2">
              <input
                id="sprint-add-column"
                type="text"
                value={newCol}
                onChange={(e) => setNewCol(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addColumn(); }}}
                placeholder="Add column…"
                aria-label="Add column"
                className="flex-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
              <button
                type="button"
                onClick={addColumn}
                className="px-3 py-1 text-sm border border-slate-300 dark:border-slate-600 dark:text-slate-300 rounded hover:bg-slate-50 dark:hover:bg-slate-700"
                aria-label="Add column"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">WIP Limits (optional)</label>
            <div className="space-y-2">
              {columns.map((col) => (
                <div key={col} className="flex items-center gap-2">
                  <span className="text-sm text-slate-600 dark:text-slate-300 w-32 truncate" title={col}>{col}</span>
                  <input
                    type="number"
                    min="1"
                    placeholder="No limit"
                    value={wipLimits[col] ?? ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setWipLimits((prev) => {
                        const next = { ...prev };
                        if (val === '' || val === '0') {
                          delete next[col];
                        } else {
                          next[col] = parseInt(val, 10);
                        }
                        return next;
                      });
                    }}
                    className="w-20 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
                  />
                </div>
              ))}
            </div>
          </div>

          {err && <p className="text-xs text-red-600">{err}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={loading}
              disabled={!name.trim()}
            >
              {loading ? (isEdit ? 'Saving…' : 'Creating…') : (isEdit ? 'Save Changes' : 'Create Session')}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
