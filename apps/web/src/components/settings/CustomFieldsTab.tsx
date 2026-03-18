import { useState, useEffect, useCallback } from 'react';
import { gql } from '../../api/client';
import { useFormState } from '../../hooks/useFormState';
import { parseOptions } from '../../utils/jsonHelpers';
import Button from '../shared/Button';

interface CustomFieldDef {
  customFieldId: string;
  name: string;
  fieldType: string;
  options: string | null;
  required: boolean;
  position: number;
}

interface Props {
  projectId: string;
}

export default function CustomFieldsTab({ projectId }: Props) {
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const createFieldForm = useFormState(
    { name: '', type: 'TEXT', options: '', required: false },
    async (values) => {
      if (!values.name.trim()) return;
      const { createCustomField } = await gql<{ createCustomField: CustomFieldDef }>(
        `mutation CreateCF($projectId: ID!, $name: String!, $fieldType: String!, $options: String, $required: Boolean) {
          createCustomField(projectId: $projectId, name: $name, fieldType: $fieldType, options: $options, required: $required) { customFieldId name fieldType options required position }
        }`,
        {
          projectId,
          name: values.name.trim(),
          fieldType: values.type,
          options: values.type === 'DROPDOWN' && values.options.trim() ? JSON.stringify(values.options.split(',').map((s) => s.trim()).filter(Boolean)) : null,
          required: values.required,
        },
      );
      setCustomFields((prev) => [...prev, createCustomField]);
      // Reset name, options, required but preserve type selection
      createFieldForm.setValues((prev) => ({ ...prev, name: '', options: '', required: false }));
    },
  );

  const loadFields = useCallback(async () => {
    setLoading(true);
    try {
      const data = await gql<{ customFields: CustomFieldDef[] }>(
        `query CustomFields($projectId: ID!) { customFields(projectId: $projectId) { customFieldId name fieldType options required position } }`,
        { projectId },
      );
      setCustomFields(data.customFields);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load custom fields');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { loadFields(); }, [loadFields]);

  const handleDeleteCustomField = async (fieldId: string) => {
    try {
      await gql<{ deleteCustomField: boolean }>(
        `mutation DeleteCF($customFieldId: ID!) { deleteCustomField(customFieldId: $customFieldId) }`,
        { customFieldId: fieldId },
      );
      setCustomFields((prev) => prev.filter((f) => f.customFieldId !== fieldId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete custom field');
    }
  };

  const handleReorderField = async (fieldId: string, direction: 'up' | 'down') => {
    const sorted = [...customFields].sort((a, b) => a.position - b.position);
    const idx = sorted.findIndex((f) => f.customFieldId === fieldId);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;

    const fieldA = sorted[idx];
    const fieldB = sorted[swapIdx];
    setError(null);
    try {
      await Promise.all([
        gql<{ updateCustomField: CustomFieldDef }>(
          `mutation ReorderA($customFieldId: ID!, $position: Int) { updateCustomField(customFieldId: $customFieldId, position: $position) { customFieldId name fieldType options required position } }`,
          { customFieldId: fieldA.customFieldId, position: fieldB.position },
        ),
        gql<{ updateCustomField: CustomFieldDef }>(
          `mutation ReorderB($customFieldId: ID!, $position: Int) { updateCustomField(customFieldId: $customFieldId, position: $position) { customFieldId name fieldType options required position } }`,
          { customFieldId: fieldB.customFieldId, position: fieldA.position },
        ),
      ]);
      setCustomFields((prev) =>
        prev.map((f) => {
          if (f.customFieldId === fieldA.customFieldId) return { ...f, position: fieldB.position };
          if (f.customFieldId === fieldB.customFieldId) return { ...f, position: fieldA.position };
          return f;
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to reorder fields');
    }
  };

  if (loading) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading...</p>;

  return (
    <>
      {error && <p className="text-sm text-red-600 mb-2">{error}</p>}
      <ul className="divide-y divide-slate-100 dark:divide-slate-700">
        {[...customFields].sort((a, b) => a.position - b.position).map((f, idx) => (
          <li key={f.customFieldId} className="py-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex flex-col gap-0.5">
                <button
                  onClick={() => handleReorderField(f.customFieldId, 'up')}
                  disabled={idx === 0}
                  className="text-slate-400 hover:text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed text-xs leading-none"
                  title="Move up"
                >
                  ▲
                </button>
                <button
                  onClick={() => handleReorderField(f.customFieldId, 'down')}
                  disabled={idx === customFields.length - 1}
                  className="text-slate-400 hover:text-slate-600 disabled:opacity-25 disabled:cursor-not-allowed text-xs leading-none"
                  title="Move down"
                >
                  ▼
                </button>
              </div>
              <div>
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{f.name}</span>
                <span className="ml-2 text-xs text-slate-400">{f.fieldType}</span>
                {f.required && <span className="ml-1 text-xs text-red-400">required</span>}
                {f.options && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    Options: {parseOptions(f.options).join(', ') || f.options}
                  </p>
                )}
              </div>
            </div>
            <button onClick={() => handleDeleteCustomField(f.customFieldId)} className="text-red-500 hover:text-red-700 text-xs">Delete</button>
          </li>
        ))}
        {customFields.length === 0 && <li className="py-2 text-sm text-slate-500 dark:text-slate-400">No custom fields yet.</li>}
      </ul>

      <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-700">
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Add custom field</p>
        {createFieldForm.error && <p className="text-sm text-red-600 mb-2">{createFieldForm.error}</p>}
        <input
          type="text"
          value={createFieldForm.values.name}
          onChange={(e) => createFieldForm.setValue('name', e.target.value)}
          placeholder="Field name"
          className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">Type:</label>
          <select
            value={createFieldForm.values.type}
            onChange={(e) => createFieldForm.setValue('type', e.target.value)}
            className="flex-1 text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1"
          >
            <option value="TEXT">Text</option>
            <option value="NUMBER">Number</option>
            <option value="DATE">Date</option>
            <option value="DROPDOWN">Dropdown</option>
          </select>
        </div>
        {createFieldForm.values.type === 'DROPDOWN' && (
          <input
            type="text"
            value={createFieldForm.values.options}
            onChange={(e) => createFieldForm.setValue('options', e.target.value)}
            placeholder="Options (comma-separated)"
            className="w-full text-sm border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5"
          />
        )}
        <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={createFieldForm.values.required}
            onChange={(e) => createFieldForm.setValue('required', e.target.checked)}
            className="rounded"
          />
          Required field
        </label>
        <Button size="sm" disabled={createFieldForm.loading || !createFieldForm.values.name.trim()} onClick={() => createFieldForm.handleSubmit()}>
          {createFieldForm.loading ? 'Creating...' : 'Create Field'}
        </Button>
      </div>
    </>
  );
}
