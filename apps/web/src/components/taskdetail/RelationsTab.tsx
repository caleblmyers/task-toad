import { useState, useCallback } from 'react';
import type { Task, Attachment } from '../../types';
import { gql } from '../../api/client';
import TaskDependenciesSection from './TaskDependenciesSection';
import TaskSubtasksSection from './TaskSubtasksSection';
import Badge from '../shared/Badge';

const categoryVariant: Record<string, 'purple' | 'info' | 'warning' | 'success' | 'accent' | 'neutral'> = {
  'ai-model': 'purple',
  'code-editor': 'info',
  'design-tool': 'purple',
  'database': 'warning',
  'cloud-service': 'info',
  'communication': 'success',
  'testing': 'accent',
  'other': 'neutral',
};

function parseTools(raw?: string | null): Array<{ name: string; category: string; reason?: string }> {
  if (!raw) return [];
  try { return JSON.parse(raw); } catch { return []; }
}

export interface RelationsTabProps {
  task: Task;
  subtasks: Task[];
  statuses: string[];
  allTasks: Task[];
  disabled: boolean;
  generatingInstructions: string | null;
  onAddDependency: (sourceTaskId: string, targetTaskId: string, linkType: string) => Promise<void>;
  onRemoveDependency: (taskDependencyId: string) => Promise<void>;
  onSubtaskStatusChange: (parentId: string, taskId: string, status: string) => void;
  onGenerateInstructions: (task: Task) => void;
  onCreateSubtask?: (parentTaskId: string, title: string) => Promise<void>;
  onAutoComplete?: (task: Task) => void;
  autoCompleteLoading?: boolean;
}

export default function RelationsTab({
  task, subtasks, statuses, allTasks, disabled, generatingInstructions,
  onAddDependency, onRemoveDependency, onSubtaskStatusChange,
  onGenerateInstructions, onCreateSubtask, onAutoComplete, autoCompleteLoading,
}: RelationsTabProps) {
  const tools = parseTools(task.suggestedTools);
  const [uploading, setUploading] = useState(false);
  const [localAttachments, setLocalAttachments] = useState<Attachment[]>(task.attachments ?? []);

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/uploads/${task.taskId}`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (res.ok) {
        const attachment = await res.json() as Attachment;
        setLocalAttachments(prev => [attachment, ...prev]);
      }
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }, [task.taskId]);

  const handleDeleteAttachment = useCallback(async (attachmentId: string) => {
    try {
      await gql<{ deleteAttachment: boolean }>(
        `mutation($attachmentId: ID!) { deleteAttachment(attachmentId: $attachmentId) }`,
        { attachmentId },
      );
      setLocalAttachments(prev => prev.filter(a => a.attachmentId !== attachmentId));
    } catch { /* ignore */ }
  }, []);

  return (
    <section aria-labelledby="task-tab-relations-heading">
      <h3 id="task-tab-relations-heading" className="sr-only">Relations</h3>

      <TaskDependenciesSection
        task={task}
        allTasks={allTasks}
        disabled={disabled}
        onAddDependency={onAddDependency}
        onRemoveDependency={onRemoveDependency}
      />

      <TaskSubtasksSection
        task={task}
        subtasks={subtasks}
        statuses={statuses}
        generatingInstructions={generatingInstructions}
        disabled={disabled}
        onSubtaskStatusChange={onSubtaskStatusChange}
        onGenerateInstructions={onGenerateInstructions}
        onCreateSubtask={onCreateSubtask}
        onAutoComplete={onAutoComplete}
        autoCompleteLoading={autoCompleteLoading}
      />

      {/* Attachments */}
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Attachments</p>
        {localAttachments.length > 0 && (
          <ul className="space-y-1 mb-2">
            {localAttachments.map(a => (
              <li key={a.attachmentId} className="flex items-center justify-between text-sm bg-slate-50 dark:bg-slate-800 rounded px-2 py-1">
                <a
                  href={`/api/uploads/${a.attachmentId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 dark:text-blue-400 hover:underline truncate mr-2"
                >
                  {a.fileName}
                </a>
                <span className="flex items-center gap-2 text-xs text-slate-500 flex-shrink-0">
                  {a.sizeBytes < 1024 ? `${a.sizeBytes} B` : a.sizeBytes < 1048576 ? `${(a.sizeBytes / 1024).toFixed(1)} KB` : `${(a.sizeBytes / 1048576).toFixed(1)} MB`}
                  <button
                    onClick={() => handleDeleteAttachment(a.attachmentId)}
                    className="text-red-400 hover:text-red-600"
                    disabled={disabled}
                    aria-label={`Delete attachment ${a.fileName}`}
                  >
                    ✕
                  </button>
                </span>
              </li>
            ))}
          </ul>
        )}
        <label className={`inline-flex items-center gap-1 text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 rounded cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800 ${disabled || uploading ? 'opacity-50 pointer-events-none' : ''}`}>
          {uploading ? 'Uploading…' : '+ Attach file'}
          <input type="file" className="hidden" onChange={handleUpload} disabled={disabled || uploading} />
        </label>
      </div>

      {/* Suggested Tools */}
      {tools.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wide mb-2">Suggested Tools</p>
          <div className="flex flex-wrap gap-2">
            {tools.map((tool, i) => (
              <Badge key={i} variant={categoryVariant[tool.category] ?? 'neutral'} className="px-2.5 py-1.5 rounded-lg">
                <span className="font-semibold">{tool.name}</span>
                <span className="ml-1 opacity-60">· {tool.category}</span>
                {tool.reason && <p className="mt-0.5 opacity-75 font-normal">{tool.reason}</p>}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
