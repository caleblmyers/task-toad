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
  onRegenerateFile?: (filePath: string, feedback?: string) => Promise<GeneratedFile | null>;
}

export default function CodePreviewModal({
  isOpen,
  onClose,
  files,
  summary,
  estimatedTokensUsed,
  onCreatePR,
  isCreatingPR,
  onRegenerateFile,
}: CodePreviewModalProps) {
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [regeneratingPath, setRegeneratingPath] = useState<string | null>(null);
  const [feedbackPath, setFeedbackPath] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');

  if (!isOpen) return null;

  const toggleFile = (index: number) => {
    setExpandedIndex(expandedIndex === index ? -1 : index);
  };

  const handleCreatePR = () => {
    onCreatePR(files.map(({ path, content }) => ({ path, content })));
  };

  const handleRegenerate = async (filePath: string) => {
    if (!onRegenerateFile) return;
    setRegeneratingPath(filePath);
    try {
      const feedback = feedbackPath === filePath ? feedbackText.trim() || undefined : undefined;
      await onRegenerateFile(filePath, feedback);
      setFeedbackPath(null);
      setFeedbackText('');
    } finally {
      setRegeneratingPath(null);
    }
  };

  const toggleFeedback = (filePath: string) => {
    if (feedbackPath === filePath) {
      setFeedbackPath(null);
      setFeedbackText('');
    } else {
      setFeedbackPath(filePath);
      setFeedbackText('');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[85vh] flex flex-col mx-4">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold text-slate-800">Generated Code</h2>
            <span className="text-xs text-slate-400">
              Tokens: {estimatedTokensUsed.toLocaleString()} · Cost: ~${(estimatedTokensUsed * 0.000005).toFixed(4)}
            </span>
          </div>
          <p className="text-sm text-slate-600">{summary}</p>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {files.map((file, index) => {
            const isRegenerating = regeneratingPath === file.path;
            return (
              <div key={file.path} className={`border border-slate-200 rounded-lg overflow-hidden ${isRegenerating ? 'opacity-60' : ''}`}>
                <div className="flex items-center bg-slate-50">
                  <button
                    type="button"
                    onClick={() => toggleFile(index)}
                    className="flex-1 text-left px-4 py-3 hover:bg-slate-100 flex items-center gap-2 min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <code className="text-sm font-mono text-slate-800 truncate">{file.path}</code>
                      {file.language && (
                        <span className="text-xs bg-slate-200 text-slate-600 px-1.5 py-0.5 rounded flex-shrink-0">
                          {file.language}
                        </span>
                      )}
                    </div>
                    <span className="text-slate-400 flex-shrink-0 ml-auto">
                      {expandedIndex === index ? '▾' : '▸'}
                    </span>
                  </button>
                  {onRegenerateFile && (
                    <div className="flex items-center gap-1 px-2 flex-shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleFeedback(file.path)}
                        disabled={isRegenerating}
                        className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-1 disabled:opacity-50"
                        title="Add feedback"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegenerate(file.path)}
                        disabled={isRegenerating || regeneratingPath !== null}
                        className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1"
                        title="Regenerate this file"
                      >
                        {isRegenerating ? (
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          '↻'
                        )}
                        {isRegenerating ? 'Regenerating…' : 'Regenerate'}
                      </button>
                    </div>
                  )}
                </div>
                {feedbackPath === file.path && (
                  <div className="px-4 py-2 bg-blue-50 border-t border-slate-100">
                    <input
                      type="text"
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      placeholder="What should change? (optional)"
                      className="w-full text-sm px-2 py-1.5 border border-slate-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-400"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRegenerate(file.path);
                      }}
                    />
                  </div>
                )}
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
            );
          })}
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
