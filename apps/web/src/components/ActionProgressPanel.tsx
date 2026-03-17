import type { TaskActionPlan, TaskActionType } from '../types';

const STATUS_ICONS: Record<string, string> = {
  pending: '\u25CB',    // ○
  executing: '\u25D4',  // ◔
  completed: '\u2714',  // ✔
  failed: '\u2718',     // ✘
  skipped: '\u2500',    // ─
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-slate-400',
  executing: 'text-blue-500 animate-pulse',
  completed: 'text-green-600',
  failed: 'text-red-500',
  skipped: 'text-slate-300',
};

const ACTION_TYPE_LABELS: Record<string, string> = {
  generate_code: 'Generate Code',
  create_pr: 'Create PR',
  write_docs: 'Write Docs',
  manual_step: 'Manual Step',
};

interface ActionProgressPanelProps {
  plan: TaskActionPlan;
  onCompleteManual: (actionId: string) => Promise<void>;
  onSkip: (actionId: string) => Promise<void>;
  onRetry: (actionId: string) => Promise<void>;
  onCancel: (planId: string) => Promise<void>;
}

function ActionItem({ action, onCompleteManual, onSkip, onRetry }: {
  action: TaskActionType;
  onCompleteManual: (id: string) => Promise<void>;
  onSkip: (id: string) => Promise<void>;
  onRetry: (id: string) => Promise<void>;
}) {
  const isManual = action.actionType === 'manual_step';
  const canComplete = isManual && (action.status === 'pending' || action.status === 'executing');
  const canSkip = action.status === 'pending';
  const canRetry = action.status === 'failed';

  return (
    <div className={`flex items-start gap-3 p-3 rounded-lg border ${
      action.status === 'executing' ? 'border-blue-200 bg-blue-50' :
      action.status === 'failed' ? 'border-red-200 bg-red-50' :
      action.status === 'completed' ? 'border-green-200 bg-green-50' :
      'border-slate-200 bg-white'
    }`}>
      <span className={`text-lg mt-0.5 ${STATUS_COLORS[action.status] ?? 'text-slate-400'}`}>
        {STATUS_ICONS[action.status] ?? '\u25CB'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-slate-800 truncate">{action.label}</p>
          <span className="text-xs text-slate-400 flex-shrink-0">
            {ACTION_TYPE_LABELS[action.actionType] ?? action.actionType}
          </span>
        </div>
        {action.errorMessage && (
          <p className="text-xs text-red-600 mt-1">{action.errorMessage}</p>
        )}
        {action.result && action.status === 'completed' && (
          <details className="mt-1">
            <summary className="text-xs text-slate-500 cursor-pointer">View result</summary>
            <pre className="mt-1 text-xs text-slate-600 bg-slate-100 p-2 rounded overflow-x-auto max-h-32">
              {action.result}
            </pre>
          </details>
        )}
        <div className="flex gap-2 mt-2">
          {canComplete && (
            <button
              onClick={() => onCompleteManual(action.id)}
              className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Mark Complete
            </button>
          )}
          {canSkip && (
            <button
              onClick={() => onSkip(action.id)}
              className="text-xs px-2 py-1 bg-slate-100 text-slate-600 rounded hover:bg-slate-200"
            >
              Skip
            </button>
          )}
          {canRetry && (
            <button
              onClick={() => onRetry(action.id)}
              className="text-xs px-2 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200"
            >
              Retry
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ActionProgressPanel({ plan, onCompleteManual, onSkip, onRetry, onCancel }: ActionProgressPanelProps) {
  const completedCount = plan.actions.filter((a) => a.status === 'completed').length;
  const totalCount = plan.actions.length;
  const isActive = plan.status === 'executing' || plan.status === 'approved';
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
          Action Plan
        </p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">
            {completedCount}/{totalCount} done
          </span>
          <span className={`text-xs px-1.5 py-0.5 rounded ${
            plan.status === 'completed' ? 'bg-green-100 text-green-700' :
            plan.status === 'failed' ? 'bg-red-100 text-red-700' :
            plan.status === 'executing' ? 'bg-blue-100 text-blue-700' :
            plan.status === 'cancelled' ? 'bg-slate-100 text-slate-500' :
            'bg-slate-100 text-slate-600'
          }`}>
            {plan.status}
          </span>
        </div>
      </div>

      {totalCount > 0 && (
        <div className="w-full bg-slate-200 rounded-full h-1.5 mb-3">
          <div
            className={`rounded-full h-1.5 transition-all ${
              plan.status === 'failed' ? 'bg-red-500' : 'bg-green-500'
            }`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      )}

      {plan.summary && (
        <p className="text-xs text-slate-500 mb-3">{plan.summary}</p>
      )}

      <div className="space-y-2">
        {plan.actions.map((action) => (
          <ActionItem
            key={action.id}
            action={action}
            onCompleteManual={onCompleteManual}
            onSkip={onSkip}
            onRetry={onRetry}
          />
        ))}
      </div>

      {isActive && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => onCancel(plan.id)}
            className="text-xs px-3 py-1.5 text-red-600 border border-red-200 rounded hover:bg-red-50"
          >
            Cancel Plan
          </button>
        </div>
      )}
    </div>
  );
}
