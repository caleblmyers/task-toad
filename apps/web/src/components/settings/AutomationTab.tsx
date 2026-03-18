import { useState, useEffect, useCallback } from 'react';
import { gql } from '../../api/client';
import { useFormState } from '../../hooks/useFormState';
import type { OrgUser } from '../../types';
import Button from '../shared/Button';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  createdAt: string;
}

const TRIGGER_EVENTS = [
  { value: 'task.status_changed', label: 'Status changed' },
  { value: 'task.assigned', label: 'Task assigned' },
];

const ACTION_TYPES = [
  { value: 'notify_assignee', label: 'Notify assignee' },
  { value: 'move_to_column', label: 'Move to column' },
  { value: 'set_status', label: 'Set status' },
  { value: 'assign_to', label: 'Assign to user' },
];

interface Props {
  projectId: string;
  orgUsers: OrgUser[];
}

export default function AutomationTab({ projectId, orgUsers }: Props) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createRuleForm = useFormState(
    { name: '', triggerEvent: 'task.status_changed', conditionKey: 'newStatus', conditionValue: '', actionType: 'notify_assignee', actionParam: '' },
    async (values) => {
      if (!values.name.trim()) return;
      const trigger: Record<string, unknown> = { event: values.triggerEvent };
      if (values.conditionValue.trim()) {
        trigger.condition = { [values.conditionKey]: values.conditionValue.trim() };
      }
      const action: Record<string, string> = { type: values.actionType };
      if (values.actionType === 'move_to_column') action.column = values.actionParam;
      else if (values.actionType === 'set_status') action.status = values.actionParam;
      else if (values.actionType === 'assign_to') action.userId = values.actionParam;

      const { createAutomationRule } = await gql<{ createAutomationRule: AutomationRule }>(
        `mutation CreateRule($projectId: ID!, $name: String!, $trigger: String!, $action: String!) {
          createAutomationRule(projectId: $projectId, name: $name, trigger: $trigger, action: $action) { id name trigger action enabled createdAt }
        }`,
        { projectId, name: values.name.trim(), trigger: JSON.stringify(trigger), action: JSON.stringify(action) },
      );
      setRules((prev) => [...prev, createAutomationRule]);
      // Reset name and param fields, preserve trigger/action type selections
      createRuleForm.setValues((prev) => ({ ...prev, name: '', conditionValue: '', actionParam: '' }));
    },
  );

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gql<{ automationRules: AutomationRule[] }>(
        `query AutomationRules($projectId: ID!) { automationRules(projectId: $projectId) { id name trigger action enabled createdAt } }`,
        { projectId },
      );
      setRules(data.automationRules);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadRules(); }, [loadRules]);

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const { updateAutomationRule } = await gql<{ updateAutomationRule: AutomationRule }>(
        `mutation ToggleRule($ruleId: ID!, $enabled: Boolean) {
          updateAutomationRule(ruleId: $ruleId, enabled: $enabled) { id name trigger action enabled createdAt }
        }`,
        { ruleId, enabled },
      );
      setRules((prev) => prev.map((r) => (r.id === ruleId ? updateAutomationRule : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to toggle rule');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    try {
      await gql<{ deleteAutomationRule: boolean }>(
        `mutation DeleteRule($ruleId: ID!) { deleteAutomationRule(ruleId: $ruleId) }`,
        { ruleId },
      );
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete rule');
    }
  };

  const describeTrigger = (triggerJson: string) => {
    try {
      const t = JSON.parse(triggerJson) as { event: string; condition?: Record<string, string> };
      const eventLabel = TRIGGER_EVENTS.find((e) => e.value === t.event)?.label ?? t.event;
      if (t.condition) {
        const conds = Object.entries(t.condition).map(([k, v]) => `${k} = ${v}`).join(', ');
        return `${eventLabel} (${conds})`;
      }
      return eventLabel;
    } catch {
      return triggerJson;
    }
  };

  const describeAction = (actionJson: string) => {
    try {
      const a = JSON.parse(actionJson) as { type: string; column?: string; status?: string; userId?: string };
      const label = ACTION_TYPES.find((t) => t.value === a.type)?.label ?? a.type;
      if (a.column) return `${label}: ${a.column}`;
      if (a.status) return `${label}: ${a.status}`;
      if (a.userId) {
        const user = orgUsers.find((u) => u.userId === a.userId);
        return `${label}: ${user?.email ?? a.userId}`;
      }
      return label;
    } catch {
      return actionJson;
    }
  };

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>;

  return (
    <>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {rules.map((r) => (
          <li key={r.id} className="py-2 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{r.name}</span>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <input
                    type="checkbox"
                    checked={r.enabled}
                    onChange={(e) => handleToggleRule(r.id, e.target.checked)}
                    className="rounded"
                  />
                  Enabled
                </label>
                <button onClick={() => handleDeleteRule(r.id)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
              </div>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              When: {describeTrigger(r.trigger)} → Then: {describeAction(r.action)}
            </p>
          </li>
        ))}
        {rules.length === 0 && <li className="py-2 text-sm text-slate-500 dark:text-slate-400">No automation rules yet.</li>}
      </ul>

      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Add rule</p>
        {createRuleForm.error && <p className="text-sm text-red-600 mb-2">{createRuleForm.error}</p>}
        <input
          type="text"
          value={createRuleForm.values.name}
          onChange={(e) => createRuleForm.setValue('name', e.target.value)}
          placeholder="Rule name"
          className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">When:</label>
          <select
            value={createRuleForm.values.triggerEvent}
            onChange={(e) => createRuleForm.setValue('triggerEvent', e.target.value)}
            className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
          >
            {TRIGGER_EVENTS.map((e) => (
              <option key={e.value} value={e.value}>{e.label}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">Condition:</label>
          <input
            type="text"
            value={createRuleForm.values.conditionKey}
            onChange={(e) => createRuleForm.setValue('conditionKey', e.target.value)}
            placeholder="key"
            className="w-24 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
          />
          <span className="text-xs text-slate-400">=</span>
          <input
            type="text"
            value={createRuleForm.values.conditionValue}
            onChange={(e) => createRuleForm.setValue('conditionValue', e.target.value)}
            placeholder="value (optional)"
            className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">Then:</label>
          <select
            value={createRuleForm.values.actionType}
            onChange={(e) => createRuleForm.setValue('actionType', e.target.value)}
            className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
          >
            {ACTION_TYPES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
        {createRuleForm.values.actionType !== 'notify_assignee' && (
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500 dark:text-slate-400">
              {createRuleForm.values.actionType === 'move_to_column' ? 'Column:' : createRuleForm.values.actionType === 'set_status' ? 'Status:' : 'User:'}
            </label>
            {createRuleForm.values.actionType === 'assign_to' ? (
              <select
                value={createRuleForm.values.actionParam}
                onChange={(e) => createRuleForm.setValue('actionParam', e.target.value)}
                className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
              >
                <option value="">Select user...</option>
                {orgUsers.map((u) => (
                  <option key={u.userId} value={u.userId}>{u.email}</option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={createRuleForm.values.actionParam}
                onChange={(e) => createRuleForm.setValue('actionParam', e.target.value)}
                placeholder={createRuleForm.values.actionType === 'move_to_column' ? 'Column name' : 'Status slug'}
                className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
              />
            )}
          </div>
        )}
        <Button size="sm" disabled={createRuleForm.loading || !createRuleForm.values.name.trim()} onClick={() => createRuleForm.handleSubmit()}>
          {createRuleForm.loading ? 'Creating...' : 'Create Rule'}
        </Button>
      </div>
    </>
  );
}
