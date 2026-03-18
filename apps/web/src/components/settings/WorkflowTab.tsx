import { useState, useEffect, useCallback } from 'react';
import { gql } from '../../api/client';
import { useFormState } from '../../hooks/useFormState';
import Button from '../shared/Button';

interface WorkflowTransition {
  transitionId: string;
  projectId: string;
  fromStatus: string;
  toStatus: string;
  allowedRoles: string[] | null;
  createdAt: string;
}

interface Props {
  projectId: string;
}

export default function WorkflowTab({ projectId }: Props) {
  const [transitions, setTransitions] = useState<WorkflowTransition[]>([]);
  const [statuses, setStatuses] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [transData, projData] = await Promise.all([
        gql<{ workflowTransitions: WorkflowTransition[] }>(
          `query WorkflowTransitions($projectId: ID!) {
            workflowTransitions(projectId: $projectId) {
              transitionId projectId fromStatus toStatus allowedRoles createdAt
            }
          }`,
          { projectId },
        ),
        gql<{ project: { statuses: string } }>(
          `query Project($projectId: ID!) {
            project(projectId: $projectId) { statuses }
          }`,
          { projectId },
        ),
      ]);
      setTransitions(transData.workflowTransitions);
      try {
        const parsed = JSON.parse(projData.project.statuses);
        setStatuses(Array.isArray(parsed) ? parsed : []);
      } catch {
        setStatuses(['todo', 'in_progress', 'in_review', 'done']);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workflow transitions');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const addForm = useFormState(
    { fromStatus: '', toStatus: '' },
    async (values) => {
      if (!values.fromStatus || !values.toStatus) return;
      const { createWorkflowTransition } = await gql<{ createWorkflowTransition: WorkflowTransition }>(
        `mutation CreateTransition($projectId: ID!, $fromStatus: String!, $toStatus: String!) {
          createWorkflowTransition(projectId: $projectId, fromStatus: $fromStatus, toStatus: $toStatus) {
            transitionId projectId fromStatus toStatus allowedRoles createdAt
          }
        }`,
        { projectId, fromStatus: values.fromStatus, toStatus: values.toStatus },
      );
      setTransitions((prev) => [...prev, createWorkflowTransition]);
      addForm.setValues({ fromStatus: '', toStatus: '' });
    },
  );

  const handleDelete = useCallback(async (transitionId: string) => {
    try {
      await gql<{ deleteWorkflowTransition: boolean }>(
        `mutation DeleteTransition($transitionId: ID!) {
          deleteWorkflowTransition(transitionId: $transitionId)
        }`,
        { transitionId },
      );
      setTransitions((prev) => prev.filter((t) => t.transitionId !== transitionId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete transition');
    }
  }, []);

  const formatStatus = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">Workflow Transition Rules</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Configure which status transitions are allowed. When no rules are configured, all transitions are permitted.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
          {error}
        </div>
      )}

      {transitions.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded p-3 text-center">
          No workflow rules configured. All status transitions are allowed.
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-600 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50">
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">From</th>
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-300 font-medium"></th>
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">To</th>
                <th className="px-3 py-2 w-16"></th>
              </tr>
            </thead>
            <tbody>
              {transitions.map((t) => (
                <tr key={t.transitionId} className="border-t border-slate-200 dark:border-slate-600">
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{formatStatus(t.fromStatus)}</td>
                  <td className="px-3 py-2 text-slate-400">&rarr;</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{formatStatus(t.toStatus)}</td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() => handleDelete(t.transitionId)}
                      className="text-red-500 hover:text-red-700 dark:hover:text-red-400 text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add transition form */}
      <form onSubmit={addForm.handleSubmit} className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">From Status</label>
          <select
            value={addForm.values.fromStatus}
            onChange={(e) => addForm.setValue('fromStatus', e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-500 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
          >
            <option value="">Select...</option>
            {statuses.map((s) => (
              <option key={s} value={s}>{formatStatus(s)}</option>
            ))}
          </select>
        </div>
        <span className="text-slate-400 pb-1.5">&rarr;</span>
        <div className="flex-1">
          <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">To Status</label>
          <select
            value={addForm.values.toStatus}
            onChange={(e) => addForm.setValue('toStatus', e.target.value)}
            className="w-full border border-slate-300 dark:border-slate-500 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
          >
            <option value="">Select...</option>
            {statuses
              .filter((s) => s !== addForm.values.fromStatus)
              .map((s) => (
                <option key={s} value={s}>{formatStatus(s)}</option>
              ))}
          </select>
        </div>
        <Button
          type="submit"
          size="sm"
          disabled={!addForm.values.fromStatus || !addForm.values.toStatus || addForm.loading}
        >
          Add
        </Button>
      </form>
      {addForm.error && (
        <div className="text-sm text-red-600 dark:text-red-400">{addForm.error}</div>
      )}
    </div>
  );
}
