import { useState, useEffect, useCallback } from 'react';
import { gql } from '../../api/client';
import {
  AUTOMATION_RULES_QUERY,
  CREATE_AUTOMATION_RULE_MUTATION,
  UPDATE_AUTOMATION_RULE_MUTATION,
  DELETE_AUTOMATION_RULE_MUTATION,
  LABELS_QUERY,
} from '../../api/queries';
import type { OrgUser } from '../../types';
import Button from '../shared/Button';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  action: string;
  enabled: boolean;
  cronExpression: string | null;
  timezone: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  createdAt: string;
}

interface Label {
  labelId: string;
  name: string;
  color: string;
}

const TRIGGER_EVENTS = [
  { value: 'task.status_changed', label: 'Status changed' },
  { value: 'task.assigned', label: 'Task assigned' },
  { value: 'scheduled', label: 'Scheduled (cron)' },
];

const ACTION_TYPES = [
  { value: 'notify_assignee', label: 'Notify assignee' },
  { value: 'move_to_column', label: 'Move to column' },
  { value: 'set_status', label: 'Set status' },
  { value: 'assign_to', label: 'Assign to user' },
  { value: 'send_webhook', label: 'Send webhook' },
  { value: 'add_label', label: 'Add label' },
  { value: 'add_comment', label: 'Add comment' },
  { value: 'set_due_date', label: 'Set due date' },
];

const CONDITION_FIELDS = [
  { value: 'status', label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'taskType', label: 'Task type' },
  { value: 'assigneeId', label: 'Assignee' },
];

const CONDITION_OPS = [
  { value: 'eq', label: 'equals' },
  { value: 'not_eq', label: 'not equals' },
];

interface ActionRow {
  type: string;
  param: string;
}

interface ConditionRow {
  field: string;
  op: string;
  value: string;
}

interface CompoundCondition {
  operator: 'AND' | 'OR';
  conditions: Array<{ field: string; op: string; value: unknown }>;
}

function serializeActions(actions: ActionRow[]): string {
  const mapped = actions.map((a) => {
    const obj: Record<string, unknown> = { type: a.type };
    switch (a.type) {
      case 'move_to_column': obj.column = a.param; break;
      case 'set_status': obj.status = a.param; break;
      case 'assign_to': obj.userId = a.param; break;
      case 'send_webhook': obj.url = a.param; break;
      case 'add_label': obj.labelId = a.param; break;
      case 'add_comment': obj.content = a.param; break;
      case 'set_due_date': obj.daysFromNow = Number(a.param) || 0; break;
    }
    return obj;
  });
  return JSON.stringify(mapped.length === 1 ? mapped[0] : mapped);
}

function serializeTrigger(event: string, conditionOp: 'AND' | 'OR', conditions: ConditionRow[]): string {
  const trigger: Record<string, unknown> = { event };
  const validConditions = conditions.filter((c) => c.value.trim());
  if (validConditions.length > 0) {
    trigger.condition = {
      operator: conditionOp,
      conditions: validConditions.map((c) => ({ field: c.field, op: c.op, value: c.value.trim() })),
    };
  }
  return JSON.stringify(trigger);
}

function getParamLabel(actionType: string): string {
  switch (actionType) {
    case 'move_to_column': return 'Column:';
    case 'set_status': return 'Status:';
    case 'assign_to': return 'User:';
    case 'send_webhook': return 'URL:';
    case 'add_label': return 'Label:';
    case 'add_comment': return 'Comment:';
    case 'set_due_date': return 'Days:';
    default: return '';
  }
}

function needsParam(actionType: string): boolean {
  return actionType !== 'notify_assignee';
}

const inputClass = 'text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1';
const selectClass = inputClass;

interface Props {
  projectId: string;
  orgUsers: OrgUser[];
}

export default function AutomationTab({ projectId, orgUsers }: Props) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [name, setName] = useState('');
  const [triggerEvent, setTriggerEvent] = useState('task.status_changed');
  const [conditionOp, setConditionOp] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<ConditionRow[]>([]);
  const [conditionsOpen, setConditionsOpen] = useState(false);
  const [actions, setActions] = useState<ActionRow[]>([{ type: 'notify_assignee', param: '' }]);
  const [cronExpression, setCronExpression] = useState('');
  const [timezone, setTimezone] = useState('UTC');

  const loadRules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gql<{ automationRules: AutomationRule[] }>(
        AUTOMATION_RULES_QUERY,
        { projectId },
      );
      setRules(data.automationRules);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load rules');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const loadLabels = useCallback(async () => {
    try {
      const data = await gql<{ labels: Label[] }>(LABELS_QUERY);
      setLabels(data.labels);
    } catch {
      // Labels are optional — if fetch fails, just show empty dropdown
    }
  }, []);

  useEffect(() => { loadRules(); }, [loadRules]);
  useEffect(() => { loadLabels(); }, [loadLabels]);

  const handleCreateRule = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const trigger = serializeTrigger(triggerEvent, conditionOp, conditions);
      const action = serializeActions(actions);
      const vars: Record<string, unknown> = { projectId, name: name.trim(), trigger, action };
      if (triggerEvent === 'scheduled' && cronExpression.trim()) {
        vars.cronExpression = cronExpression.trim();
        vars.timezone = timezone;
      }
      const { createAutomationRule } = await gql<{ createAutomationRule: AutomationRule }>(
        CREATE_AUTOMATION_RULE_MUTATION,
        vars,
      );
      setRules((prev) => [...prev, createAutomationRule]);
      setName('');
      setActions([{ type: 'notify_assignee', param: '' }]);
      setConditions([]);
      setConditionsOpen(false);
      setCronExpression('');
      setTimezone('UTC');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create rule');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleRule = async (ruleId: string, enabled: boolean) => {
    try {
      const { updateAutomationRule } = await gql<{ updateAutomationRule: AutomationRule }>(
        UPDATE_AUTOMATION_RULE_MUTATION,
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
        DELETE_AUTOMATION_RULE_MUTATION,
        { ruleId },
      );
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete rule');
    }
  };

  const describeAction = (actionJson: string) => {
    try {
      const parsed = JSON.parse(actionJson);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      return arr.map((a: Record<string, string>) => {
        const label = ACTION_TYPES.find((t) => t.value === a.type)?.label ?? a.type;
        if (a.column) return `${label}: ${a.column}`;
        if (a.status) return `${label}: ${a.status}`;
        if (a.userId) {
          const user = orgUsers.find((u) => u.userId === a.userId);
          return `${label}: ${user?.email ?? a.userId}`;
        }
        if (a.url) return `${label}: ${a.url}`;
        if (a.labelId) {
          const lbl = labels.find((l) => l.labelId === a.labelId);
          return `${label}: ${lbl?.name ?? a.labelId}`;
        }
        if (a.content) return `${label}: "${a.content.slice(0, 30)}${a.content.length > 30 ? '...' : ''}"`;
        if (a.daysFromNow != null) return `${label}: +${a.daysFromNow}d`;
        return label;
      }).join(' → ');
    } catch {
      return actionJson;
    }
  };

  const describeTrigger = (triggerJson: string) => {
    try {
      const t = JSON.parse(triggerJson);
      const eventLabel = TRIGGER_EVENTS.find((e) => e.value === t.event)?.label ?? t.event;
      if (!t.condition) return eventLabel;

      // Compound
      if (t.condition.operator && t.condition.conditions) {
        const compound = t.condition as CompoundCondition;
        const parts = compound.conditions.map((c) => {
          const fieldLabel = CONDITION_FIELDS.find((f) => f.value === c.field)?.label ?? c.field;
          const opLabel = c.op === 'not_eq' ? '≠' : '=';
          return `${fieldLabel} ${opLabel} ${c.value}`;
        });
        return `${eventLabel} (${parts.join(` ${compound.operator} `)})`;
      }

      // Simple
      const conds = Object.entries(t.condition).map(([k, v]) => `${k} = ${v}`).join(', ');
      return `${eventLabel} (${conds})`;
    } catch {
      return triggerJson;
    }
  };

  // Action row helpers
  const updateAction = (index: number, field: 'type' | 'param', value: string) => {
    setActions((prev) => prev.map((a, i) => i === index ? { ...a, [field]: value, ...(field === 'type' ? { param: '' } : {}) } : a));
  };
  const addAction = () => setActions((prev) => [...prev, { type: 'notify_assignee', param: '' }]);
  const removeAction = (index: number) => setActions((prev) => prev.filter((_, i) => i !== index));

  // Condition row helpers
  const updateCondition = (index: number, field: keyof ConditionRow, value: string) => {
    setConditions((prev) => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };
  const addCondition = () => setConditions((prev) => [...prev, { field: 'status', op: 'eq', value: '' }]);
  const removeCondition = (index: number) => setConditions((prev) => prev.filter((_, i) => i !== index));

  const renderActionParamInput = (action: ActionRow, index: number) => {
    if (!needsParam(action.type)) return null;
    if (action.type === 'assign_to') {
      return (
        <select value={action.param} onChange={(e) => updateAction(index, 'param', e.target.value)} className={`flex-1 ${selectClass}`}>
          <option value="">Select user...</option>
          {orgUsers.map((u) => <option key={u.userId} value={u.userId}>{u.email}</option>)}
        </select>
      );
    }
    if (action.type === 'add_label') {
      return (
        <select value={action.param} onChange={(e) => updateAction(index, 'param', e.target.value)} className={`flex-1 ${selectClass}`}>
          <option value="">Select label...</option>
          {labels.map((l) => <option key={l.labelId} value={l.labelId}>{l.name}</option>)}
        </select>
      );
    }
    if (action.type === 'add_comment') {
      return (
        <textarea
          value={action.param}
          onChange={(e) => updateAction(index, 'param', e.target.value)}
          placeholder="Comment text"
          rows={2}
          className={`flex-1 ${inputClass}`}
        />
      );
    }
    if (action.type === 'set_due_date') {
      return (
        <input
          type="number"
          min={0}
          value={action.param}
          onChange={(e) => updateAction(index, 'param', e.target.value)}
          placeholder="Days from now"
          className={`w-32 ${inputClass}`}
        />
      );
    }
    // move_to_column, set_status, send_webhook — text input
    const placeholder = action.type === 'move_to_column' ? 'Column name'
      : action.type === 'set_status' ? 'Status slug'
      : 'https://example.com/webhook';
    return (
      <input
        type="text"
        value={action.param}
        onChange={(e) => updateAction(index, 'param', e.target.value)}
        placeholder={placeholder}
        className={`flex-1 ${inputClass}`}
      />
    );
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
              When: {describeTrigger(r.trigger)}{r.cronExpression ? ` [${r.cronExpression}]` : ''} → Then: {describeAction(r.action)}
            </p>
            {r.cronExpression && (
              <p className="text-xs text-slate-400 dark:text-slate-500">
                TZ: {r.timezone ?? 'UTC'}
                {r.lastRunAt && ` · Last: ${new Date(r.lastRunAt).toLocaleString()}`}
                {r.nextRunAt && ` · Next: ${new Date(r.nextRunAt).toLocaleString()}`}
              </p>
            )}
          </li>
        ))}
        {rules.length === 0 && <li className="py-2 text-sm text-slate-500 dark:text-slate-400">No automation rules yet.</li>}
      </ul>

      <div className="space-y-3 pt-3 border-t border-slate-100 dark:border-slate-700">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Add rule</p>

        {/* Rule name */}
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Rule name"
          className={`w-full ${inputClass} py-1.5`}
        />

        {/* Trigger event */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">When:</label>
          <select value={triggerEvent} onChange={(e) => setTriggerEvent(e.target.value)} className={`flex-1 ${selectClass}`}>
            {TRIGGER_EVENTS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>
        </div>

        {/* Schedule (when trigger is scheduled) */}
        {triggerEvent === 'scheduled' && (
          <div className="space-y-2 border border-slate-200 dark:border-slate-600 rounded p-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">Schedule</p>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                { label: 'Every hour', value: '0 * * * *' },
                { label: 'Daily at 9am', value: '0 9 * * *' },
                { label: 'Weekly Monday', value: '0 9 * * 1' },
              ].map((preset) => (
                <button
                  key={preset.value}
                  type="button"
                  onClick={() => setCronExpression(preset.value)}
                  className={`text-xs px-2 py-1 rounded border ${cronExpression === preset.value ? 'border-blue-500 bg-blue-50 dark:bg-blue-900 text-blue-700 dark:text-blue-300' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                >
                  {preset.label}
                </button>
              ))}
            </div>
            <input
              type="text"
              value={cronExpression}
              onChange={(e) => setCronExpression(e.target.value)}
              placeholder="Cron expression (e.g. 0 9 * * 1)"
              className={`w-full ${inputClass}`}
            />
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 dark:text-slate-400 shrink-0">Timezone:</label>
              <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className={`flex-1 ${selectClass}`}>
                {['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Shanghai', 'Australia/Sydney'].map((tz) => (
                  <option key={tz} value={tz}>{tz}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Conditions (collapsible) */}
        <div className="border border-slate-200 dark:border-slate-600 rounded">
          <button
            type="button"
            onClick={() => setConditionsOpen(!conditionsOpen)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded"
          >
            <span>Conditions ({conditions.length || 'optional'})</span>
            <span>{conditionsOpen ? '▲' : '▼'}</span>
          </button>
          {conditionsOpen && (
            <div className="px-2 pb-2 space-y-2">
              {conditions.length > 0 && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-500 dark:text-slate-400">Match:</label>
                  <select value={conditionOp} onChange={(e) => setConditionOp(e.target.value as 'AND' | 'OR')} className={`w-20 ${selectClass}`}>
                    <option value="AND">ALL</option>
                    <option value="OR">ANY</option>
                  </select>
                </div>
              )}
              {conditions.map((c, i) => (
                <div key={i} className="flex items-center gap-1">
                  <select value={c.field} onChange={(e) => updateCondition(i, 'field', e.target.value)} className={`w-28 ${selectClass}`}>
                    {CONDITION_FIELDS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
                  </select>
                  <select value={c.op} onChange={(e) => updateCondition(i, 'op', e.target.value)} className={`w-24 ${selectClass}`}>
                    {CONDITION_OPS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <input
                    type="text"
                    value={c.value}
                    onChange={(e) => updateCondition(i, 'value', e.target.value)}
                    placeholder="value"
                    className={`flex-1 ${inputClass}`}
                  />
                  <button type="button" onClick={() => removeCondition(i)} className="text-red-500 hover:text-red-700 text-xs px-1">✕</button>
                </div>
              ))}
              <button type="button" onClick={addCondition} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
                + Add condition
              </button>
            </div>
          )}
        </div>

        {/* Actions (multi-action builder) */}
        <div className="space-y-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">Then:</label>
          {actions.map((action, i) => (
            <div key={i} className="flex items-start gap-2">
              <select value={action.type} onChange={(e) => updateAction(i, 'type', e.target.value)} className={`w-40 shrink-0 ${selectClass}`}>
                {ACTION_TYPES.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
              </select>
              {needsParam(action.type) && (
                <>
                  <span className="text-xs text-slate-400 shrink-0 pt-1">{getParamLabel(action.type)}</span>
                  {renderActionParamInput(action, i)}
                </>
              )}
              {actions.length > 1 && (
                <button type="button" onClick={() => removeAction(i)} className="text-red-500 hover:text-red-700 text-xs px-1 pt-1 shrink-0">✕</button>
              )}
            </div>
          ))}
          <button type="button" onClick={addAction} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
            + Add action
          </button>
        </div>

        <Button size="sm" disabled={saving || !name.trim()} onClick={handleCreateRule}>
          {saving ? 'Creating...' : 'Create Rule'}
        </Button>
      </div>
    </>
  );
}
