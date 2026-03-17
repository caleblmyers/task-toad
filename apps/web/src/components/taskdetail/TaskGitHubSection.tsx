import { useState } from 'react';
import type { Task, TaskPullRequest, TaskCommit } from '../../types';
import Badge from '../shared/Badge';

interface TaskGitHubSectionProps {
  task: Task;
  projectHasRepo?: boolean;
  disabled?: boolean;
  onSyncToGitHub?: (taskId: string) => Promise<void>;
}

export default function TaskGitHubSection({
  task,
  projectHasRepo,
  disabled,
  onSyncToGitHub,
}: TaskGitHubSectionProps) {
  const [syncingGitHub, setSyncingGitHub] = useState(false);

  const showIssueSection = task.githubIssueNumber || (projectHasRepo && onSyncToGitHub);
  const pullRequests = (task.pullRequests ?? []) as TaskPullRequest[];
  const commits = (task.commits ?? []) as TaskCommit[];

  if (!showIssueSection && pullRequests.length === 0 && commits.length === 0) {
    return null;
  }

  return (
    <>
      {/* GitHub Issue */}
      {showIssueSection && (
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">GitHub Issue</label>
          {task.githubIssueNumber && task.githubIssueUrl ? (
            <div className="mt-1">
              <a
                href={task.githubIssueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-800 hover:underline"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0c4.42 0 8 3.58 8 8a8.013 8.013 0 0 1-5.45 7.59c-.4.08-.55-.17-.55-.38 0-.27.01-1.13.01-2.2 0-.75-.25-1.23-.54-1.48 1.78-.2 3.65-.88 3.65-3.95 0-.88-.31-1.59-.82-2.15.08-.2.36-1.02-.08-2.12 0 0-.67-.22-2.2.82-.64-.18-1.32-.27-2-.27-.68 0-1.36.09-2 .27-1.53-1.03-2.2-.82-2.2-.82-.44 1.1-.16 1.92-.08 2.12-.51.56-.82 1.28-.82 2.15 0 3.06 1.86 3.75 3.64 3.95-.23.2-.44.55-.51 1.07-.46.21-1.61.55-2.33-.66-.15-.24-.6-.83-1.23-.82-.67.01-.27.38.01.53.34.19.73.9.82 1.13.16.45.68 1.31 2.69.94 0 .67.01 1.3.01 1.49 0 .21-.15.45-.55.38A7.995 7.995 0 0 1 0 8c0-4.42 3.58-8 8-8Z"/></svg>
                #{task.githubIssueNumber}
              </a>
            </div>
          ) : projectHasRepo && onSyncToGitHub ? (
            <div className="mt-1">
              <button
                onClick={async () => {
                  setSyncingGitHub(true);
                  try { await onSyncToGitHub(task.taskId); } finally { setSyncingGitHub(false); }
                }}
                disabled={disabled || syncingGitHub}
                className="text-xs px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50"
              >
                {syncingGitHub ? 'Creating…' : 'Create GitHub Issue'}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Pull Requests */}
      {pullRequests.length > 0 && (
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pull Requests</label>
          <div className="mt-1 space-y-1.5">
            {pullRequests.map((pr) => (
              <div key={pr.id} className="flex items-center gap-2">
                <Badge variant={
                  pr.state === 'MERGED' ? 'purple' :
                  pr.state === 'OPEN' ? 'success' :
                  'danger'
                } size="sm">
                  {pr.state === 'MERGED' ? 'Merged' : pr.state === 'OPEN' ? 'Open' : 'Closed'}
                </Badge>
                <a
                  href={pr.prUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline truncate"
                >
                  #{pr.prNumber} {pr.prTitle}
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Commits */}
      {commits.length > 0 && (
        <div className="mb-4">
          <details>
            <summary className="text-xs font-medium text-slate-500 uppercase tracking-wide cursor-pointer">
              Commits ({commits.length})
            </summary>
            <div className="mt-1.5 space-y-1.5">
              {commits.map((c) => (
                <div key={c.id} className="flex items-start gap-2 text-xs">
                  <a
                    href={c.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-blue-600 hover:underline flex-shrink-0"
                  >
                    {c.sha.slice(0, 7)}
                  </a>
                  <span className="text-slate-700 truncate">{c.message.split('\n')[0]}</span>
                  <span className="text-slate-400 flex-shrink-0">{c.author}</span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}
    </>
  );
}
