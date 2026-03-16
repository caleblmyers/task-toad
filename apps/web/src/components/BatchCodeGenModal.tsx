import { useState } from 'react';
import { gql } from '../api/client';
import { IconClose } from './shared/Icons';
import Modal from './shared/Modal';
import Button from './shared/Button';
import type { Task } from '../types';

interface GeneratedFile {
  path: string;
  content: string;
  language: string;
  description: string;
}

interface BatchCodeGenModalProps {
  projectId: string;
  tasks: Task[];
  onClose: () => void;
}

export default function BatchCodeGenModal({ projectId, tasks, onClose }: BatchCodeGenModalProps) {
  const tasksWithInstructions = tasks.filter((t) => t.instructions);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState<{ files: GeneratedFile[]; summary: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleTask = (taskId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else if (next.size < 5) next.add(taskId);
      return next;
    });
  };

  const handleGenerate = async () => {
    if (selectedIds.size === 0) return;
    setGenerating(true);
    setError(null);
    try {
      const styleGuide = localStorage.getItem(`tasktoad-style-guide-${projectId}`);
      const data = await gql<{ batchGenerateCode: { files: GeneratedFile[]; summary: string; estimatedTokensUsed: number } }>(
        `mutation BatchCodeGen($projectId: ID!, $taskIds: [ID!]!, $styleGuide: String) {
          batchGenerateCode(projectId: $projectId, taskIds: $taskIds, styleGuide: $styleGuide) {
            files { path content language description }
            summary
            estimatedTokensUsed
          }
        }`,
        { projectId, taskIds: [...selectedIds], styleGuide }
      );
      setResult(data.batchGenerateCode);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate code');
    } finally {
      setGenerating(false);
    }
  };

  const [expandedFile, setExpandedFile] = useState<number | null>(null);

  return (
    <Modal isOpen={true} onClose={onClose} title="Batch Code Generation" size="md">
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 flex-shrink-0">
        <h2 className="text-base font-semibold text-slate-800">Batch Code Generation</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600" aria-label="Close">
          <IconClose className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {!result ? (
          <>
            <p className="text-sm text-slate-500">
              Select up to 5 tasks with instructions to generate code for all at once.
            </p>
            {tasksWithInstructions.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">
                No tasks have instructions yet. Generate instructions for tasks first.
              </p>
            ) : (
              <div className="space-y-1.5">
                {tasksWithInstructions.map((task) => (
                  <label key={task.taskId} className="flex items-start gap-2 p-2 rounded hover:bg-slate-50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(task.taskId)}
                      onChange={() => toggleTask(task.taskId)}
                      className="mt-0.5"
                      disabled={generating}
                    />
                    <div className="min-w-0">
                      <p className="text-sm text-slate-700">{task.title}</p>
                      <p className="text-xs text-slate-400 truncate">{task.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            )}
            {error && <p className="text-sm text-red-600">{error}</p>}
          </>
        ) : (
          <div className="space-y-3">
            <div className="bg-slate-50 rounded-lg p-3">
              <p className="text-sm text-slate-700">{result.summary}</p>
            </div>
            <p className="text-xs text-slate-400">{result.files.length} files generated</p>
            {result.files.map((file, i) => (
              <div key={i} className="border border-slate-200 rounded-lg">
                <button
                  onClick={() => setExpandedFile(expandedFile === i ? null : i)}
                  className="w-full flex items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
                >
                  <div>
                    <span className="text-sm font-mono text-slate-700">{file.path}</span>
                    <span className="ml-2 text-xs text-slate-400">{file.language}</span>
                  </div>
                  <span className="text-slate-400 text-xs">{expandedFile === i ? '▼' : '▶'}</span>
                </button>
                {expandedFile === i && (
                  <div className="border-t border-slate-100 px-3 py-2">
                    <p className="text-xs text-slate-500 mb-2">{file.description}</p>
                    <pre className="text-xs bg-slate-900 text-slate-100 rounded p-3 overflow-x-auto max-h-64">
                      {file.content}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 flex-shrink-0">
        <div>
          {result && (
            <button
              onClick={() => { setResult(null); setError(null); }}
              className="text-sm text-slate-500 hover:text-slate-700"
            >
              Back to selection
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onClose}>
            Close
          </Button>
          {!result && (
            <Button size="sm" onClick={handleGenerate} loading={generating} disabled={selectedIds.size === 0} className="rounded-lg">
              {generating ? 'Generating...' : `Generate Code (${selectedIds.size})`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}
