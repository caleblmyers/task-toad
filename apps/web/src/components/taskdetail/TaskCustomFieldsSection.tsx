import { useState, useEffect } from 'react';
import { gql } from '../../api/client';
import { parseOptions } from '../../utils/jsonHelpers';

interface CustomField {
  customFieldId: string;
  name: string;
  fieldType: string;
  options: string | null;
  required: boolean;
  position: number;
}

interface CustomFieldValue {
  customFieldValueId: string;
  field: CustomField;
  value: string;
}

interface Props {
  taskId: string;
  projectId: string;
  customFieldValues?: CustomFieldValue[];
  disabled?: boolean;
  onRefresh?: () => void;
}

export default function TaskCustomFieldsSection({ taskId, projectId, customFieldValues = [], disabled, onRefresh }: Props) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Map<string, string>>(new Map());
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    gql<{ customFields: CustomField[] }>(
      `query CustomFields($projectId: ID!) { customFields(projectId: $projectId) { customFieldId name fieldType options required position } }`,
      { projectId },
    ).then((data) => setFields(data.customFields)).catch(() => {});
  }, [projectId]);

  useEffect(() => {
    const map = new Map<string, string>();
    for (const cfv of customFieldValues) {
      map.set(cfv.field.customFieldId, cfv.value);
    }
    setValues(map);
  }, [customFieldValues]);

  if (fields.length === 0) return null;

  const handleSave = async (customFieldId: string, value: string) => {
    setSaving(customFieldId);
    try {
      await gql<{ setCustomFieldValue: CustomFieldValue }>(
        `mutation SetCFV($taskId: ID!, $customFieldId: ID!, $value: String!) {
          setCustomFieldValue(taskId: $taskId, customFieldId: $customFieldId, value: $value) { customFieldValueId value }
        }`,
        { taskId, customFieldId, value },
      );
      setValues((prev) => new Map(prev).set(customFieldId, value));
      onRefresh?.();
    } catch {
      // ignore
    } finally {
      setSaving(null);
    }
  };

  const getDropdownOptions = (field: CustomField): string[] => {
    return parseOptions(field.options);
  };

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Custom Fields</p>
      <div className="space-y-3">
        {fields.map((field) => {
          const currentValue = values.get(field.customFieldId) ?? '';
          return (
            <div key={field.customFieldId}>
              <label className="text-xs text-slate-600 font-medium">
                {field.name}
                {field.required && <span className="text-red-400 ml-0.5">*</span>}
              </label>
              {field.fieldType === 'TEXT' && (
                <input
                  type="text"
                  value={currentValue}
                  onChange={(e) => setValues((prev) => new Map(prev).set(field.customFieldId, e.target.value))}
                  onBlur={(e) => handleSave(field.customFieldId, e.target.value)}
                  className="block mt-0.5 w-full border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
                  disabled={disabled || saving === field.customFieldId}
                />
              )}
              {field.fieldType === 'NUMBER' && (
                <input
                  type="number"
                  value={currentValue}
                  onChange={(e) => setValues((prev) => new Map(prev).set(field.customFieldId, e.target.value))}
                  onBlur={(e) => handleSave(field.customFieldId, e.target.value)}
                  className="block mt-0.5 w-32 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
                  disabled={disabled || saving === field.customFieldId}
                />
              )}
              {field.fieldType === 'DATE' && (
                <input
                  type="date"
                  value={currentValue}
                  onChange={(e) => {
                    setValues((prev) => new Map(prev).set(field.customFieldId, e.target.value));
                    handleSave(field.customFieldId, e.target.value);
                  }}
                  className="block mt-0.5 border border-slate-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
                  disabled={disabled || saving === field.customFieldId}
                />
              )}
              {field.fieldType === 'DROPDOWN' && (
                <select
                  value={currentValue}
                  onChange={(e) => {
                    setValues((prev) => new Map(prev).set(field.customFieldId, e.target.value));
                    handleSave(field.customFieldId, e.target.value);
                  }}
                  className="block mt-0.5 border border-slate-300 rounded px-2 py-1 text-sm"
                  disabled={disabled || saving === field.customFieldId}
                >
                  <option value="">—</option>
                  {getDropdownOptions(field).map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
