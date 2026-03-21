import { useState, useEffect, useCallback } from 'react';
import { gql } from '../../api/client';
import {
  SLA_POLICIES_QUERY,
  CREATE_SLA_POLICY_MUTATION,
  UPDATE_SLA_POLICY_MUTATION,
  DELETE_SLA_POLICY_MUTATION,
} from '../../api/queries';
import { useFormState } from '../../hooks/useFormState';
import Button from '../shared/Button';

interface SLAPolicy {
  slaPolicyId: string;
  projectId: string;
  name: string;
  responseTimeHours: number;
  resolutionTimeHours: number;
  priority: string | null;
  enabled: boolean;
  createdAt: string;
}

interface Props {
  projectId: string;
}

const PRIORITIES = [
  { value: '', label: 'All priorities' },
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export default function SLATab({ projectId }: Props) {
  const [policies, setPolicies] = useState<SLAPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const data = await gql<{ slaPolicies: SLAPolicy[] }>(SLA_POLICIES_QUERY, { projectId });
      setPolicies(data.slaPolicies);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SLA policies');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const addForm = useFormState(
    { name: '', responseTimeHours: '24', resolutionTimeHours: '72', priority: '' },
    async (values) => {
      if (!values.name.trim()) return;
      const { createSLAPolicy } = await gql<{ createSLAPolicy: SLAPolicy }>(
        CREATE_SLA_POLICY_MUTATION,
        {
          projectId,
          name: values.name.trim(),
          responseTimeHours: parseInt(values.responseTimeHours, 10),
          resolutionTimeHours: parseInt(values.resolutionTimeHours, 10),
          priority: values.priority || null,
        },
      );
      setPolicies((prev) => [...prev, createSLAPolicy]);
      addForm.setValues({ name: '', responseTimeHours: '24', resolutionTimeHours: '72', priority: '' });
    },
  );

  const handleToggle = useCallback(async (policy: SLAPolicy) => {
    try {
      const { updateSLAPolicy } = await gql<{ updateSLAPolicy: SLAPolicy }>(
        UPDATE_SLA_POLICY_MUTATION,
        { slaPolicyId: policy.slaPolicyId, enabled: !policy.enabled },
      );
      setPolicies((prev) => prev.map((p) => (p.slaPolicyId === policy.slaPolicyId ? updateSLAPolicy : p)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update policy');
    }
  }, []);

  const handleDelete = useCallback(async (slaPolicyId: string) => {
    try {
      await gql<{ deleteSLAPolicy: boolean }>(DELETE_SLA_POLICY_MUTATION, { slaPolicyId });
      setPolicies((prev) => prev.filter((p) => p.slaPolicyId !== slaPolicyId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete policy');
    }
  }, []);

  if (loading) {
    return <div className="text-sm text-slate-500 dark:text-slate-400">Loading...</div>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">SLA Policies</h3>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Define service level agreements for task response and resolution times. SLA timers start when tasks are created.
        </p>
      </div>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded p-2">
          {error}
        </div>
      )}

      {policies.length === 0 ? (
        <div className="text-sm text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700/50 rounded p-3 text-center">
          No SLA policies configured.
        </div>
      ) : (
        <div className="border border-slate-200 dark:border-slate-600 rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-700/50">
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">Name</th>
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">Response</th>
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">Resolution</th>
                <th className="text-left px-3 py-2 text-slate-600 dark:text-slate-300 font-medium">Priority</th>
                <th className="px-3 py-2 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {policies.map((p) => (
                <tr key={p.slaPolicyId} className={`border-t border-slate-200 dark:border-slate-600 ${!p.enabled ? 'opacity-50' : ''}`}>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{p.name}</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{p.responseTimeHours}h</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{p.resolutionTimeHours}h</td>
                  <td className="px-3 py-2 text-slate-700 dark:text-slate-300 capitalize">{p.priority ?? 'All'}</td>
                  <td className="px-3 py-2 text-right space-x-2">
                    <button
                      onClick={() => handleToggle(p)}
                      className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                    >
                      {p.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button
                      onClick={() => handleDelete(p.slaPolicyId)}
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

      {/* Add policy form */}
      <form onSubmit={addForm.handleSubmit} className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div className="col-span-2">
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Policy Name</label>
            <input
              type="text"
              value={addForm.values.name}
              onChange={(e) => addForm.setValue('name', e.target.value)}
              placeholder="e.g. Standard SLA"
              className="w-full border border-slate-300 dark:border-slate-500 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Response Time (hours)</label>
            <input
              type="number"
              min="1"
              value={addForm.values.responseTimeHours}
              onChange={(e) => addForm.setValue('responseTimeHours', e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-500 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Resolution Time (hours)</label>
            <input
              type="number"
              min="1"
              value={addForm.values.resolutionTimeHours}
              onChange={(e) => addForm.setValue('resolutionTimeHours', e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-500 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Priority Filter</label>
            <select
              value={addForm.values.priority}
              onChange={(e) => addForm.setValue('priority', e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-500 rounded px-2 py-1.5 text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            >
              {PRIORITIES.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <Button
              type="submit"
              size="sm"
              disabled={!addForm.values.name.trim() || addForm.loading}
            >
              Add Policy
            </Button>
          </div>
        </div>
      </form>
      {addForm.error && (
        <div className="text-sm text-red-600 dark:text-red-400">{addForm.error}</div>
      )}
    </div>
  );
}
