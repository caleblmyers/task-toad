import { useState } from 'react';
import type { ActionPlanPreview, ActionPlanPreviewItem } from '../types';

const ACTION_TYPE_LABELS: Record<string, string> = {
  generate_code: 'Generate Code',
  create_pr: 'Create Pull Request',
  write_docs: 'Write Documentation',
  manual_step: 'Manual Step',
};

const ACTION_TYPE_ICONS: Record<string, string> = {
  generate_code: '\u2328',
  create_pr: '\u{1F517}',
  write_docs: '\u{1F4DD}',
  manual_step: '\u270B',
};

interface ActionPlanDialogProps {
  preview: ActionPlanPreview;
  loading?: boolean;
  onCommitAndExecute: (actions: Array<{ actionType: string; label: string; config: string; requiresApproval: boolean }>) => Promise<void>;
  onClose: () => void;
}

export default function ActionPlanDialog({ preview, loading, onCommitAndExecute, onClose }: ActionPlanDialogProps) {
  const [actions, setActions] = useState<ActionPlanPreviewItem[]>(preview.actions);
  const [submitting, setSubmitting] = useState(false);

  const handleRemove = (index: number) => {
    setActions((prev) => prev.filter((_, i) => i !== index));
  };

  const handleToggleApproval = (index: number) => {
    setActions((prev) => prev.map((a, i) => i === index ? { ...a, requiresApproval: !a.requiresApproval } : a));
  };

  const handleExecute = async () => {
    setSubmitting(true);
    try {
      await onCommitAndExecute(
        actions.map((a) => ({
          actionType: a.actionType,
          label: a.label,
          config: a.config,
          requiresApproval: a.requiresApproval,
        })),
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] flex flex-col">
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Action Plan</h2>
            <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
          </div>
          <p className="text-sm text-slate-500 mt-1">{preview.summary}</p>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {actions.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-8">No actions in plan. Add at least one to proceed.</p>
          )}
          {actions.map((action, index) => (
            <div key={index} className="border border-slate-200 rounded-lg p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg" title={ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}>
                    {ACTION_TYPE_ICONS[action.actionType] ?? '\u2699'}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-slate-800">{action.label}</p>
                    <p className="text-xs text-slate-500">{ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}</p>
                  </div>
                </div>
                <button
                  onClick={() => handleRemove(index)}
                  className="text-slate-400 hover:text-red-500 text-sm"
                  title="Remove action"
                >
                  &times;
                </button>
              </div>
              <p className="text-xs text-slate-500 mt-2">{action.reasoning}</p>
              <div className="flex items-center gap-2 mt-2">
                <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={action.requiresApproval}
                    onChange={() => handleToggleApproval(index)}
                    className="rounded border-slate-300"
                  />
                  Requires approval
                </label>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-200 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={submitting || loading || actions.length === 0}
            className="px-4 py-2 text-sm bg-brand-green text-white rounded-lg hover:bg-brand-green-hover disabled:opacity-50"
          >
            {submitting ? 'Starting...' : `Execute Plan (${actions.length} actions)`}
          </button>
        </div>
      </div>
    </div>
  );
}
