import { useState } from 'react';

interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  description: string;
}

interface CodePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  files: GeneratedFile[];
  summary: string;
  estimatedTokensUsed: number;
  onCreatePR: (files: Array<{ path: string; content: string }>) => Promise<void>;
  isCreatingPR: boolean;
}

export default function CodePreviewModal({
  isOpen,
  onClose,
  files,
  summary,
  estimatedTokensUsed,
  onCreatePR,
  isCreatingPR,
}: CodePreviewModalProps) {
  const [expandedIndex, setExpandedIndex] = useState(0);

  if (!isOpen) return null;

  const toggleFile = (index: number) => {
    setExpandedIndex(expandedIndex === index ? -1 : index);
  };

  const handleCreatePR = () => {
    onCreatePR(files.map(({ path, content }) => ({ path, content })));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-slate-800">Generated Code</h2>
            <span className="text-xs text-slate-400">
              Estimated tokens: {estimatedTokensUsed.toLocaleString()}
            </span>
          </div>
          <p className="text-sm text-slate-600">{summary}</p>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {files.map((file, index) => (
            <div key={file.path} className="border border-slate-200 rounded-lg overflow-hidden">
              <button
                type="button"
                onClick={() => toggleFile(index)}
                className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <code className="text-sm font-mono text-slate-800 truncate">{file.path}</code>
                  {file.language && (
                    <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">
                      {file.language}
                    </span>
                  )}
                </div>
                <span className="text-slate-400 flex-shrink-0">
                  {expandedIndex === index ? '▾' : '▸'}
                </span>
              </button>
              {file.description && (
                <p className="px-4 py-1.5 text-xs text-slate-500 bg-slate-50 border-t border-slate-100">
                  {file.description}
                </p>
              )}
              {expandedIndex === index && (
                <div className="border-t border-slate-200">
                  <pre className="p-4 text-sm bg-slate-900 text-slate-100 overflow-x-auto whitespace-pre-wrap">
                    <code>{file.content}</code>
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreatingPR}
            className="px-4 py-2 text-sm text-slate-600 hover:text-slate-800 border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCreatePR}
            disabled={isCreatingPR}
            className="px-4 py-2 text-sm text-white bg-slate-700 rounded-lg hover:bg-slate-600 disabled:opacity-50 flex items-center gap-2"
          >
            {isCreatingPR && (
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            )}
            {isCreatingPR ? 'Creating PR…' : 'Create Pull Request'}
          </button>
        </div>
      </div>
    </div>
  );
}
