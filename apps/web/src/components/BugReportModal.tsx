import { useState } from 'react';
import { IconClose } from './shared/Icons';

interface BugReportModalProps {
  onSubmit: (bugReport: string) => Promise<void>;
  onClose: () => void;
}

export default function BugReportModal({ onSubmit, onClose }: BugReportModalProps) {
  const [bugReport, setBugReport] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (!bugReport.trim()) return;
    setLoading(true);
    setError(null);
    try {
      await onSubmit(bugReport);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse bug report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Parse Bug Report</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <IconClose className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <textarea
            value={bugReport}
            onChange={(e) => setBugReport(e.target.value)}
            placeholder="Paste bug report, error log, or user feedback..."
            rows={10}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg resize-y focus:outline-none focus:ring-1 focus:ring-slate-400"
            disabled={loading}
            autoFocus
          />

          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-slate-100">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !bugReport.trim()}
            className="px-4 py-1.5 text-sm bg-slate-700 text-white rounded-lg hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Parsing...' : 'Create Task from Bug Report'}
          </button>
        </div>
      </div>
    </div>
  );
}
