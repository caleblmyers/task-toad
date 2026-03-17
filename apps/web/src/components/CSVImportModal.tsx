import { useState, useCallback } from 'react';
import Modal from './shared/Modal';

interface CSVImportModalProps {
  onImport: (tasks: Array<{ title: string; description?: string; status?: string; priority?: string }>) => Promise<void>;
  onClose: () => void;
}

type TaskField = 'title' | 'description' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'storyPoints' | 'estimatedHours' | 'skip';

const FIELD_OPTIONS: { value: TaskField; label: string }[] = [
  { value: 'skip', label: '— Skip —' },
  { value: 'title', label: 'Title' },
  { value: 'description', label: 'Description' },
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'dueDate', label: 'Due Date' },
  { value: 'storyPoints', label: 'Story Points' },
  { value: 'estimatedHours', label: 'Estimated Hours' },
];

const AUTO_MAP: Record<string, TaskField> = {
  title: 'title',
  name: 'title',
  summary: 'title',
  description: 'description',
  desc: 'description',
  status: 'status',
  state: 'status',
  priority: 'priority',
  assignee: 'assignee',
  assigned: 'assignee',
  owner: 'assignee',
  due: 'dueDate',
  duedate: 'dueDate',
  'due date': 'dueDate',
  'due_date': 'dueDate',
  storypoints: 'storyPoints',
  'story points': 'storyPoints',
  'story_points': 'storyPoints',
  points: 'storyPoints',
  estimatedhours: 'estimatedHours',
  'estimated hours': 'estimatedHours',
  'estimated_hours': 'estimatedHours',
  hours: 'estimatedHours',
  estimate: 'estimatedHours',
};

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split('\n').filter((l) => l.trim());
  const parseLine = (line: string) => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());
    return fields;
  };
  return { headers: parseLine(lines[0]), rows: lines.slice(1).map(parseLine) };
}

export default function CSVImportModal({ onImport, onClose }: CSVImportModalProps) {
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null);
  const [mapping, setMapping] = useState<TaskField[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string;
        const result = parseCSV(text);
        if (result.headers.length === 0 || result.rows.length === 0) {
          setError('CSV file is empty or has no data rows.');
          return;
        }
        setParsed(result);
        // Auto-detect column mapping
        const autoMapping = result.headers.map((h) => {
          const normalized = h.toLowerCase().trim().replace(/[^a-z0-9_ ]/g, '');
          return AUTO_MAP[normalized] ?? 'skip';
        });
        setMapping(autoMapping);
      } catch {
        setError('Failed to parse CSV file.');
      }
    };
    reader.readAsText(file);
  }, []);

  const handleMappingChange = (index: number, value: TaskField) => {
    setMapping((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  };

  const hasTitleMapping = mapping.includes('title');

  const handleImport = async () => {
    if (!parsed || !hasTitleMapping) return;
    setImporting(true);
    setError(null);

    const titleIdx = mapping.indexOf('title');
    const descIdx = mapping.indexOf('description');
    const statusIdx = mapping.indexOf('status');
    const priorityIdx = mapping.indexOf('priority');

    const tasks = parsed.rows
      .filter((row) => row[titleIdx]?.trim())
      .map((row) => ({
        title: row[titleIdx].trim(),
        ...(descIdx >= 0 && row[descIdx] ? { description: row[descIdx].trim() } : {}),
        ...(statusIdx >= 0 && row[statusIdx] ? { status: row[statusIdx].trim().toLowerCase().replace(/\s+/g, '_') } : {}),
        ...(priorityIdx >= 0 && row[priorityIdx] ? { priority: row[priorityIdx].trim().toLowerCase() } : {}),
      }));

    setProgress({ current: 0, total: tasks.length });

    try {
      await onImport(tasks);
      setProgress({ current: tasks.length, total: tasks.length });
    } catch {
      setError('Some tasks failed to import.');
    } finally {
      setImporting(false);
    }
  };

  const previewRows = parsed ? parsed.rows.slice(0, 5) : [];

  return (
    <Modal isOpen={true} onClose={onClose} title="Import Tasks from CSV" size="md">
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-600">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Import Tasks from CSV</h2>
        <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-xl leading-none" aria-label="Close">&times;</button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {!parsed ? (
          <div className="space-y-3">
            <p className="text-sm text-slate-600 dark:text-slate-400">Upload a CSV file with task data. The first row should contain column headers.</p>
            <input
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 dark:text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-medium file:bg-slate-100 dark:file:bg-slate-600 file:text-slate-700 dark:file:text-slate-200 hover:file:bg-slate-200 dark:hover:file:bg-slate-500"
            />
          </div>
        ) : (
          <>
            {/* Column mapping */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Map CSV columns to task fields:</h3>
              <div className="grid grid-cols-2 gap-2">
                {parsed.headers.map((header, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="text-sm text-slate-600 dark:text-slate-400 truncate w-32" title={header}>{header}</span>
                    <span className="text-slate-400">&rarr;</span>
                    <select
                      value={mapping[i]}
                      onChange={(e) => handleMappingChange(i, e.target.value as TaskField)}
                      className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-brand-green"
                      aria-label={`Map column "${header}" to field`}
                    >
                      {FIELD_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              {!hasTitleMapping && (
                <p className="text-xs text-amber-600 mt-2">Please map at least one column to &quot;Title&quot;.</p>
              )}
            </div>

            {/* Preview */}
            <div>
              <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Preview (first {previewRows.length} rows):</h3>
              <div className="overflow-x-auto border border-slate-200 dark:border-slate-600 rounded">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-700/50">
                    <tr>
                      {parsed.headers.map((h, i) => (
                        <th key={i} className="px-3 py-1.5 text-left font-medium text-slate-500 dark:text-slate-400">
                          {mapping[i] !== 'skip' ? mapping[i] : <span className="text-slate-500 dark:text-slate-400">{h}</span>}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, ri) => (
                      <tr key={ri} className="border-t border-slate-100 dark:border-slate-700">
                        {row.map((cell, ci) => (
                          <td key={ci} className={`px-3 py-1 ${mapping[ci] === 'skip' ? 'text-slate-500 dark:text-slate-400' : 'text-slate-700 dark:text-slate-300'} max-w-[200px] truncate`}>
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{parsed.rows.length} total rows</p>
            </div>
          </>
        )}

        {importing && (
          <div className="space-y-1">
            <p className="text-sm text-slate-600 dark:text-slate-400">Importing {progress.current}/{progress.total}...</p>
            <div className="w-full bg-slate-200 dark:bg-slate-600 rounded-full h-2">
              <div
                className="bg-slate-600 dark:bg-slate-300 h-2 rounded-full transition-all"
                style={{ width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="flex items-center justify-end gap-2 px-6 py-3 border-t border-slate-200 dark:border-slate-600">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-300"
          disabled={importing}
        >
          Cancel
        </button>
        {parsed && (
          <button
            type="button"
            onClick={handleImport}
            disabled={!hasTitleMapping || importing}
            className="px-4 py-1.5 text-sm bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {importing ? `Importing...` : `Import ${parsed.rows.length} tasks`}
          </button>
        )}
      </div>
    </Modal>
  );
}
