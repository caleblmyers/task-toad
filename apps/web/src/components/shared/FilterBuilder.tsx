import { useState, useCallback } from 'react';
import type { OrgUser } from '../../types';

// ── Types ──

export interface FilterConditionInput {
  field: string;
  operator: string;
  value?: string | null;
}

export interface FilterGroupInput {
  operator: string;
  conditions?: FilterConditionInput[];
  groups?: FilterGroupInput[];
}

interface FilterBuilderProps {
  value: FilterGroupInput | null;
  onChange: (group: FilterGroupInput | null) => void;
  statuses: string[];
  labels: Array<{ labelId: string; name: string; color: string }>;
  orgUsers: OrgUser[];
}

// ── Field / operator definitions ──

interface FieldDef {
  value: string;
  label: string;
  type: 'select' | 'multiselect' | 'number' | 'date' | 'text';
  operators: Array<{ value: string; label: string }>;
}

const FIELD_DEFS: FieldDef[] = [
  {
    value: 'status', label: 'Status', type: 'select',
    operators: [
      { value: 'eq', label: 'is' }, { value: 'neq', label: 'is not' },
      { value: 'in', label: 'in' }, { value: 'is_empty', label: 'is empty' }, { value: 'is_not_empty', label: 'is not empty' },
    ],
  },
  {
    value: 'priority', label: 'Priority', type: 'select',
    operators: [
      { value: 'eq', label: 'is' }, { value: 'neq', label: 'is not' },
      { value: 'in', label: 'in' }, { value: 'is_empty', label: 'is empty' }, { value: 'is_not_empty', label: 'is not empty' },
    ],
  },
  {
    value: 'assignee', label: 'Assignee', type: 'select',
    operators: [
      { value: 'eq', label: 'is' }, { value: 'neq', label: 'is not' },
      { value: 'is_empty', label: 'is unassigned' }, { value: 'is_not_empty', label: 'is assigned' },
    ],
  },
  {
    value: 'label', label: 'Label', type: 'select',
    operators: [
      { value: 'eq', label: 'has' }, { value: 'neq', label: 'does not have' },
      { value: 'is_empty', label: 'has none' }, { value: 'is_not_empty', label: 'has any' },
    ],
  },
  {
    value: 'dueDate', label: 'Due Date', type: 'date',
    operators: [
      { value: 'eq', label: '=' }, { value: 'lt', label: 'before' },
      { value: 'gt', label: 'after' }, { value: 'lte', label: 'on or before' },
      { value: 'gte', label: 'on or after' }, { value: 'is_empty', label: 'is empty' },
      { value: 'is_not_empty', label: 'is not empty' },
    ],
  },
  {
    value: 'estimatedHours', label: 'Est. Hours', type: 'number',
    operators: [
      { value: 'eq', label: '=' }, { value: 'gt', label: '>' },
      { value: 'lt', label: '<' }, { value: 'gte', label: '>=' },
      { value: 'lte', label: '<=' }, { value: 'is_empty', label: 'is empty' },
      { value: 'is_not_empty', label: 'is not empty' },
    ],
  },
  {
    value: 'storyPoints', label: 'Story Points', type: 'number',
    operators: [
      { value: 'eq', label: '=' }, { value: 'gt', label: '>' },
      { value: 'lt', label: '<' }, { value: 'gte', label: '>=' },
      { value: 'lte', label: '<=' }, { value: 'is_empty', label: 'is empty' },
      { value: 'is_not_empty', label: 'is not empty' },
    ],
  },
];

const PRIORITY_OPTIONS = ['low', 'medium', 'high', 'critical'];

const NO_VALUE_OPERATORS = new Set(['is_empty', 'is_not_empty']);

// ── Style constants ──

const inputBase = 'text-xs border border-slate-300 dark:border-slate-600 rounded px-2 py-1 dark:bg-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-400';
const btnBase = 'text-xs px-2 py-1 rounded transition-colors';
const btnGhost = `${btnBase} text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700`;

// ── Helpers ──

function emptyCondition(): FilterConditionInput {
  return { field: 'status', operator: 'eq', value: '' };
}

function emptyGroup(): FilterGroupInput {
  return { operator: 'AND', conditions: [emptyCondition()] };
}

// ── Sub-components ──

function ConditionRow({
  condition,
  onChange,
  onRemove,
  statuses,
  labels,
  orgUsers,
}: {
  condition: FilterConditionInput;
  onChange: (c: FilterConditionInput) => void;
  onRemove: () => void;
  statuses: string[];
  labels: Array<{ labelId: string; name: string; color: string }>;
  orgUsers: OrgUser[];
}) {
  const fieldDef = FIELD_DEFS.find((f) => f.value === condition.field) ?? FIELD_DEFS[0];
  const needsValue = !NO_VALUE_OPERATORS.has(condition.operator);

  const handleFieldChange = (field: string) => {
    const newFieldDef = FIELD_DEFS.find((f) => f.value === field) ?? FIELD_DEFS[0];
    onChange({ field, operator: newFieldDef.operators[0].value, value: '' });
  };

  const renderValueInput = () => {
    if (!needsValue) return null;

    switch (condition.field) {
      case 'status':
        return (
          <select value={condition.value ?? ''} onChange={(e) => onChange({ ...condition, value: e.target.value })} className={inputBase}>
            <option value="">Select...</option>
            {statuses.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
          </select>
        );
      case 'priority':
        return (
          <select value={condition.value ?? ''} onChange={(e) => onChange({ ...condition, value: e.target.value })} className={inputBase}>
            <option value="">Select...</option>
            {PRIORITY_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        );
      case 'assignee':
        return (
          <select value={condition.value ?? ''} onChange={(e) => onChange({ ...condition, value: e.target.value })} className={inputBase}>
            <option value="">Select...</option>
            {orgUsers.map((u) => <option key={u.userId} value={u.userId}>{u.email}</option>)}
          </select>
        );
      case 'label':
        return (
          <select value={condition.value ?? ''} onChange={(e) => onChange({ ...condition, value: e.target.value })} className={inputBase}>
            <option value="">Select...</option>
            {labels.map((l) => <option key={l.labelId} value={l.labelId}>{l.name}</option>)}
          </select>
        );
      case 'dueDate':
        return <input type="date" value={condition.value ?? ''} onChange={(e) => onChange({ ...condition, value: e.target.value })} className={inputBase} />;
      case 'estimatedHours':
      case 'storyPoints':
        return <input type="number" value={condition.value ?? ''} onChange={(e) => onChange({ ...condition, value: e.target.value })} className={`${inputBase} w-20`} placeholder="0" />;
      default:
        return <input type="text" value={condition.value ?? ''} onChange={(e) => onChange({ ...condition, value: e.target.value })} className={inputBase} placeholder="Value" />;
    }
  };

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <select value={condition.field} onChange={(e) => handleFieldChange(e.target.value)} className={inputBase}>
        {FIELD_DEFS.map((f) => <option key={f.value} value={f.value}>{f.label}</option>)}
      </select>
      <select value={condition.operator} onChange={(e) => onChange({ ...condition, operator: e.target.value })} className={inputBase}>
        {fieldDef.operators.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
      </select>
      {renderValueInput()}
      <button type="button" onClick={onRemove} className={`${btnGhost} text-red-400 hover:text-red-600`} title="Remove condition">
        &times;
      </button>
    </div>
  );
}

function FilterGroupEditor({
  group,
  onChange,
  onRemove,
  depth,
  statuses,
  labels,
  orgUsers,
}: {
  group: FilterGroupInput;
  onChange: (g: FilterGroupInput) => void;
  onRemove?: () => void;
  depth: number;
  statuses: string[];
  labels: Array<{ labelId: string; name: string; color: string }>;
  orgUsers: OrgUser[];
}) {
  const conditions = group.conditions ?? [];
  const groups = group.groups ?? [];

  const updateCondition = (index: number, c: FilterConditionInput) => {
    const updated = [...conditions];
    updated[index] = c;
    onChange({ ...group, conditions: updated });
  };

  const removeCondition = (index: number) => {
    const updated = conditions.filter((_, i) => i !== index);
    onChange({ ...group, conditions: updated });
  };

  const addCondition = () => {
    onChange({ ...group, conditions: [...conditions, emptyCondition()] });
  };

  const updateSubGroup = (index: number, g: FilterGroupInput) => {
    const updated = [...groups];
    updated[index] = g;
    onChange({ ...group, groups: updated });
  };

  const removeSubGroup = (index: number) => {
    const updated = groups.filter((_, i) => i !== index);
    onChange({ ...group, groups: updated });
  };

  const addSubGroup = () => {
    onChange({ ...group, groups: [...groups, emptyGroup()] });
  };

  const toggleOperator = () => {
    onChange({ ...group, operator: group.operator === 'AND' ? 'OR' : 'AND' });
  };

  return (
    <div className={depth > 0 ? 'border-l-2 border-blue-300 dark:border-blue-600 pl-4 ml-2 mt-2' : ''}>
      <div className="flex items-center gap-2 mb-2">
        <button
          type="button"
          onClick={toggleOperator}
          className={`text-xs font-semibold px-2 py-0.5 rounded ${
            group.operator === 'AND'
              ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
              : 'bg-amber-100 dark:bg-amber-900 text-amber-700 dark:text-amber-300'
          }`}
        >
          {group.operator}
        </button>
        {depth > 0 && onRemove && (
          <button type="button" onClick={onRemove} className={`${btnGhost} text-red-400 hover:text-red-600`} title="Remove group">
            &times; group
          </button>
        )}
      </div>

      <div className="space-y-1.5">
        {conditions.map((c, i) => (
          <ConditionRow
            key={i}
            condition={c}
            onChange={(updated) => updateCondition(i, updated)}
            onRemove={() => removeCondition(i)}
            statuses={statuses}
            labels={labels}
            orgUsers={orgUsers}
          />
        ))}

        {groups.map((g, i) => (
          <FilterGroupEditor
            key={`group-${i}`}
            group={g}
            onChange={(updated) => updateSubGroup(i, updated)}
            onRemove={() => removeSubGroup(i)}
            depth={depth + 1}
            statuses={statuses}
            labels={labels}
            orgUsers={orgUsers}
          />
        ))}
      </div>

      <div className="flex items-center gap-2 mt-2">
        <button type="button" onClick={addCondition} className={btnGhost}>
          + Condition
        </button>
        {depth < 3 && (
          <button type="button" onClick={addSubGroup} className={btnGhost}>
            + Group
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main component ──

export default function FilterBuilder({ value, onChange, statuses, labels, orgUsers }: FilterBuilderProps) {
  const [draft, setDraft] = useState<FilterGroupInput>(value ?? emptyGroup());

  const handleApply = useCallback(() => {
    // Check if the group has any meaningful conditions
    const hasConditions = (g: FilterGroupInput): boolean => {
      if (g.conditions && g.conditions.length > 0) {
        if (g.conditions.some((c) => NO_VALUE_OPERATORS.has(c.operator) || (c.value && c.value.trim()))) return true;
      }
      if (g.groups && g.groups.some(hasConditions)) return true;
      return false;
    };

    if (hasConditions(draft)) {
      onChange(draft);
    } else {
      onChange(null);
    }
  }, [draft, onChange]);

  const handleClear = useCallback(() => {
    const fresh = emptyGroup();
    setDraft(fresh);
    onChange(null);
  }, [onChange]);

  return (
    <div className="space-y-3 py-2">
      <FilterGroupEditor
        group={draft}
        onChange={setDraft}
        depth={0}
        statuses={statuses}
        labels={labels}
        orgUsers={orgUsers}
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleApply}
          className="text-xs px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
        >
          Apply
        </button>
        <button type="button" onClick={handleClear} className={btnGhost}>
          Clear
        </button>
      </div>
    </div>
  );
}
