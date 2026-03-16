import { useState, useEffect, useCallback } from 'react';
import { gql } from '../api/client';
import { computeDiff, type DiffLine } from '../utils/diff';
import Modal from './shared/Modal';
import Button from './shared/Button';

interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  description: string;
}

interface SubtaskItem {
  taskId: string;
  title: string;
  description?: string | null;
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
  projectId?: string;
  hasRepo?: boolean;
  delegationHint?: string | null;
  subtasks?: SubtaskItem[];
  parentTaskId?: string;
  onGenerateFromSubtask?: (taskId: string, subtaskId: string) => Promise<{ files: GeneratedFile[]; summary: string; estimatedTokensUsed: number } | null>;
}

const STYLE_GUIDE_KEY_PREFIX = 'tasktoad-style-guide-';

function DiffView({ diffLines }: { diffLines: DiffLine[] }) {
  return (
    <pre className="p-4 text-sm overflow-x-auto whitespace-pre-wrap font-mono">
      {diffLines.map((line, i) => {
        const bg =
          line.type === 'added'
            ? 'bg-green-900/40 text-green-200'
            : line.type === 'removed'
              ? 'bg-red-900/40 text-red-200'
              : 'text-slate-400';
        const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
        const lineNum =
          line.type === 'removed'
            ? String(line.oldLineNumber ?? '').padStart(4)
            : line.type === 'added'
              ? String(line.newLineNumber ?? '').padStart(4)
              : String(line.oldLineNumber ?? '').padStart(4);
        return (
          <div key={i} className={`${bg} px-2`}>
            <span className="text-slate-600 select-none mr-2">{lineNum}</span>
            <span className="select-none mr-1">{prefix}</span>
            {line.content}
          </div>
        );
      })}
    </pre>
  );
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
  projectId,
  hasRepo,
  delegationHint,
  subtasks,
  parentTaskId,
  onGenerateFromSubtask,
}: CodePreviewModalProps) {
  const [expandedIndex, setExpandedIndex] = useState(0);
  const [regeneratingPath, setRegeneratingPath] = useState<string | null>(null);
  const [subtaskFiles, setSubtaskFiles] = useState<Map<string, GeneratedFile[]>>(new Map());
  const [generatingSubtaskId, setGeneratingSubtaskId] = useState<string | null>(null);
  const [subtaskTokens, setSubtaskTokens] = useState(0);
  const [feedbackPath, setFeedbackPath] = useState<string | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [showStyleGuide, setShowStyleGuide] = useState(false);
  const [styleGuideText, setStyleGuideText] = useState('');
  const [diffMode, setDiffMode] = useState<Record<string, boolean>>({});
  const [originalContents, setOriginalContents] = useState<Record<string, string | null>>({});
  const [loadingDiff, setLoadingDiff] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen && projectId) {
      const saved = localStorage.getItem(`${STYLE_GUIDE_KEY_PREFIX}${projectId}`);
      setStyleGuideText(saved ?? '');
    }
  }, [isOpen, projectId]);

  const isSubtaskMode = !!(subtasks && subtasks.length > 0 && onGenerateFromSubtask && parentTaskId);

  const allSubtaskFiles = isSubtaskMode
    ? Array.from(subtaskFiles.entries()).flatMap(([subtaskId, sf]) =>
        sf.map((f) => ({ ...f, _subtaskId: subtaskId, _subtaskTitle: subtasks!.find((s) => s.taskId === subtaskId)?.title ?? '' }))
      )
    : [];

  const handleGenerateSubtask = useCallback(async (subtaskId: string) => {
    if (!onGenerateFromSubtask || !parentTaskId) return;
    setGeneratingSubtaskId(subtaskId);
    try {
      const result = await onGenerateFromSubtask(parentTaskId, subtaskId);
      if (result) {
        setSubtaskFiles((prev) => {
          const next = new Map(prev);
          next.set(subtaskId, result.files);
          return next;
        });
        setSubtaskTokens((prev) => prev + result.estimatedTokensUsed);
      }
    } finally {
      setGeneratingSubtaskId(null);
    }
  }, [onGenerateFromSubtask, parentTaskId]);

  const fetchOriginalContent = useCallback(
    async (filePath: string) => {
      if (!projectId || originalContents[filePath] !== undefined) return;
      setLoadingDiff((prev) => ({ ...prev, [filePath]: true }));
      try {
        const result = await gql<{ fetchRepoFileContent: string | null }>(
          `query($projectId: ID!, $filePath: String!) { fetchRepoFileContent(projectId: $projectId, filePath: $filePath) }`,
          { projectId, filePath }
        );
        setOriginalContents((prev) => ({ ...prev, [filePath]: result.fetchRepoFileContent }));
      } catch {
        setOriginalContents((prev) => ({ ...prev, [filePath]: null }));
      } finally {
        setLoadingDiff((prev) => ({ ...prev, [filePath]: false }));
      }
    },
    [projectId, originalContents]
  );

  const toggleDiff = useCallback(
    (filePath: string) => {
      const newState = !diffMode[filePath];
      setDiffMode((prev) => ({ ...prev, [filePath]: newState }));
      if (newState) {
        fetchOriginalContent(filePath);
      }
    },
    [diffMode, fetchOriginalContent]
  );

  if (!isOpen) return null;

  const hasStyleGuide = styleGuideText.trim().length > 0;

  const toggleFile = (index: number) => {
    setExpandedIndex(expandedIndex === index ? -1 : index);
  };

  const handleCreatePR = () => {
    if (isSubtaskMode && allSubtaskFiles.length > 0) {
      onCreatePR(allSubtaskFiles.map(({ path, content }) => ({ path, content })));
    } else {
      onCreatePR(files.map(({ path, content }) => ({ path, content })));
    }
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

  const handleStyleGuideBlur = () => {
    if (projectId) {
      const trimmed = styleGuideText.trim();
      if (trimmed) {
        localStorage.setItem(`${STYLE_GUIDE_KEY_PREFIX}${projectId}`, trimmed);
      } else {
        localStorage.removeItem(`${STYLE_GUIDE_KEY_PREFIX}${projectId}`);
      }
    }
  };

  const renderFileContent = (file: GeneratedFile) => {
    const isDiffActive = diffMode[file.path];
    const isLoadingDiff = loadingDiff[file.path];
    const original = originalContents[file.path];

    if (!isDiffActive) {
      return (
        <pre className="p-4 text-sm bg-slate-900 text-slate-100 overflow-x-auto whitespace-pre-wrap">
          <code>{file.content}</code>
        </pre>
      );
    }

    if (isLoadingDiff) {
      return (
        <div className="p-4 text-sm text-slate-400 bg-slate-900 flex items-center gap-2">
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading original file...
        </div>
      );
    }

    if (original === null) {
      return (
        <div className="bg-slate-900">
          <div className="px-4 py-2 text-xs text-green-400 bg-green-900/30 border-b border-slate-700">
            New file
          </div>
          <pre className="p-4 text-sm text-green-200 overflow-x-auto whitespace-pre-wrap">
            <code>{file.content}</code>
          </pre>
        </div>
      );
    }

    const oldLines = original.split('\n');
    const newLines = file.content.split('\n');
    const diffLines = computeDiff(oldLines, newLines);

    return (
      <div className="bg-slate-900">
        <DiffView diffLines={diffLines} />
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Generated Code" size="lg">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-200 flex-shrink-0">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold text-slate-800">Generated Code</h2>
          <div className="flex items-center gap-3">
            {hasStyleGuide && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                Style guide active
              </span>
            )}
            <span className="text-xs text-slate-400">
              Tokens: {(isSubtaskMode ? subtaskTokens : estimatedTokensUsed).toLocaleString()} · Cost: ~${((isSubtaskMode ? subtaskTokens : estimatedTokensUsed) * 0.000005).toFixed(4)}
            </span>
          </div>
        </div>
        <p className="text-sm text-slate-600">{summary}</p>
        {delegationHint && (
          <div className="mt-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-sm text-amber-800">
              <span className="font-medium">Tip:</span> {delegationHint}
            </p>
          </div>
        )}
      </div>

      {/* File list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {/* Subtask generation mode */}
        {isSubtaskMode && (
          <div className="border border-slate-200 rounded-lg overflow-hidden mb-4">
            <div className="px-4 py-3 bg-blue-50 border-b border-slate-200">
              <h3 className="text-sm font-medium text-slate-700">Generate by Subtask</h3>
              <p className="text-xs text-slate-500 mt-0.5">Generate code for each subtask individually for better-scoped output.</p>
            </div>
            <div className="divide-y divide-slate-100">
              {subtasks!.map((st) => {
                const isGenerated = subtaskFiles.has(st.taskId);
                const isGenerating = generatingSubtaskId === st.taskId;
                const fileCount = subtaskFiles.get(st.taskId)?.length ?? 0;
                return (
                  <div key={st.taskId} className="flex items-center justify-between px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-slate-800 truncate block">{st.title}</span>
                      {st.description && <span className="text-xs text-slate-500 truncate block">{st.description}</span>}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-3">
                      {isGenerated && (
                        <span className="text-xs text-green-600">{fileCount} file{fileCount !== 1 ? 's' : ''}</span>
                      )}
                      <Button
                        variant={isGenerated ? 'secondary' : 'primary'}
                        onClick={() => handleGenerateSubtask(st.taskId)}
                        loading={isGenerating}
                        disabled={generatingSubtaskId !== null}
                        className="text-xs px-3 py-1 rounded"
                      >
                        {isGenerating ? 'Generating…' : isGenerated ? 'Regenerate' : 'Generate'}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
            {allSubtaskFiles.length > 0 && (
              <div className="px-4 py-2 bg-slate-50 border-t border-slate-200 text-xs text-slate-500">
                {allSubtaskFiles.length} file{allSubtaskFiles.length !== 1 ? 's' : ''} total · {subtaskTokens.toLocaleString()} tokens
              </div>
            )}
          </div>
        )}

        {/* Generated files — show subtask files in subtask mode, or regular files otherwise */}
        {(isSubtaskMode ? allSubtaskFiles : files).map((file, index) => {
          const isRegenerating = regeneratingPath === file.path;
          const subtaskTitle = '_subtaskTitle' in file ? (file as GeneratedFile & { _subtaskTitle: string })._subtaskTitle : null;
          const fileKey = '_subtaskId' in file ? `${(file as GeneratedFile & { _subtaskId: string })._subtaskId}-${file.path}` : file.path;
          return (
            <div key={fileKey} className={`border border-slate-200 rounded-lg overflow-hidden ${isRegenerating ? 'opacity-60' : ''}`}>
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
                    {subtaskTitle && (
                      <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded flex-shrink-0 truncate max-w-[200px]">
                        {subtaskTitle}
                      </span>
                    )}
                  </div>
                  <span className="text-slate-400 flex-shrink-0 ml-auto">
                    {expandedIndex === index ? '▾' : '▸'}
                  </span>
                </button>
                <div className="flex items-center gap-1 px-2 flex-shrink-0">
                  {hasRepo && (
                    <button
                      type="button"
                      onClick={() => toggleDiff(file.path)}
                      className={`text-xs px-2 py-1 rounded ${
                        diffMode[file.path]
                          ? 'bg-amber-100 text-amber-700'
                          : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                      }`}
                      title={diffMode[file.path] ? 'Show generated code' : 'Show diff'}
                      aria-label={diffMode[file.path] ? 'Show generated code' : 'Show diff'}
                    >
                      Diff
                    </button>
                  )}
                  {onRegenerateFile && (
                    <>
                      <button
                        type="button"
                        onClick={() => toggleFeedback(file.path)}
                        disabled={isRegenerating}
                        className="text-xs text-slate-400 hover:text-slate-600 px-1.5 py-1 disabled:opacity-50"
                        title="Add feedback"
                        aria-label="Add feedback"
                      >
                        ✎
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRegenerate(file.path)}
                        disabled={isRegenerating || regeneratingPath !== null}
                        className="text-xs text-blue-500 hover:text-blue-700 px-2 py-1 rounded hover:bg-blue-50 disabled:opacity-50 flex items-center gap-1"
                        title="Regenerate this file"
                        aria-label="Regenerate this file"
                      >
                        {isRegenerating ? (
                          <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                        ) : (
                          '↻'
                        )}
                        {isRegenerating ? 'Regenerating…' : 'Regenerate'}
                      </button>
                    </>
                  )}
                </div>
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
                  {renderFileContent(file)}
                </div>
              )}
            </div>
          );
        })}

        {/* Style Guide section */}
        {projectId && (
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowStyleGuide(!showStyleGuide)}
              className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Style Guide</span>
                {hasStyleGuide && (
                  <span className="w-2 h-2 bg-blue-500 rounded-full" />
                )}
              </div>
              <span className="text-slate-400 flex-shrink-0">
                {showStyleGuide ? '▾' : '▸'}
              </span>
            </button>
            {showStyleGuide && (
              <div className="p-4 border-t border-slate-200">
                <p className="text-xs text-slate-500 mb-2">
                  Define coding conventions for this project. These will be included in code generation prompts.
                </p>
                <textarea
                  value={styleGuideText}
                  onChange={(e) => setStyleGuideText(e.target.value)}
                  onBlur={handleStyleGuideBlur}
                  placeholder="e.g., Use functional components with hooks. Prefer named exports. Use camelCase for variables..."
                  className="w-full text-sm px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-400 resize-y min-h-[80px]"
                  rows={4}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-end gap-3 flex-shrink-0">
        <Button variant="secondary" onClick={onClose} disabled={isCreatingPR} className="rounded-lg">
          Cancel
        </Button>
        <Button
          onClick={handleCreatePR}
          loading={isCreatingPR}
          disabled={isSubtaskMode && allSubtaskFiles.length === 0}
          className="rounded-lg bg-slate-700 hover:bg-slate-600"
        >
          {isCreatingPR ? 'Creating PR…' : 'Create Pull Request'}
        </Button>
      </div>
    </Modal>
  );
}
