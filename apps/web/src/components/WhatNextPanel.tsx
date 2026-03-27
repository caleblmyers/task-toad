import { useState } from 'react';
import { gql } from '../api/client';
import useAsyncData from '../hooks/useAsyncData';
import { IconClose } from './shared/Icons';
import Badge from './shared/Badge';

interface ChatAction {
  type: string;
  label: string;
  data: string;
}

interface WhatNextSuggestion {
  title: string;
  reason: string;
  priority: string;
  action: ChatAction;
}

interface WhatNextResponse {
  summary: string;
  suggestions: WhatNextSuggestion[];
}

const WHAT_NEXT_QUERY = `
  query WhatNext($projectId: ID!) {
    whatNext(projectId: $projectId) {
      summary
      suggestions {
        title
        reason
        priority
        action { type label data }
      }
    }
  }
`;

const APPLY_CHAT_ACTION_MUTATION = `
  mutation ApplyChatAction($projectId: ID!, $action: ChatActionInput!) {
    applyChatAction(projectId: $projectId, action: $action) {
      success message taskId
    }
  }
`;

const priorityVariant: Record<string, 'danger' | 'warning' | 'info' | 'neutral'> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'neutral',
};

interface Props {
  projectId: string;
  onClose: () => void;
  onApplied: () => void;
}

export default function WhatNextPanel({ projectId, onClose, onApplied }: Props) {
  const { data, loading, error, retry } = useAsyncData(
    () =>
      gql<{ whatNext: WhatNextResponse }>(WHAT_NEXT_QUERY, { projectId })
        .then((d) => d.whatNext),
    [projectId],
  );

  const [appliedIds, setAppliedIds] = useState<Set<number>>(new Set());
  const [applyingId, setApplyingId] = useState<number | null>(null);

  const handleApply = async (suggestion: WhatNextSuggestion, index: number) => {
    setApplyingId(index);
    try {
      const result = await gql<{ applyChatAction: { success: boolean; message: string; taskId?: string } }>(
        APPLY_CHAT_ACTION_MUTATION,
        { projectId, action: { type: suggestion.action.type, data: suggestion.action.data } },
      );
      if (result.applyChatAction.success) {
        setAppliedIds((prev) => new Set([...prev, index]));
        onApplied();
      }
    } catch {
      // Error handled by UI state
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">What&apos;s Next?</p>
          <button
            type="button"
            onClick={onClose}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
          >
            <IconClose className="w-3 h-3" /> Dismiss
          </button>
        </div>

        {loading && (
          <div className="space-y-4">
            <div className="h-4 w-3/4 bg-slate-200 rounded animate-pulse" />
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 border border-slate-200 rounded-lg space-y-2">
                <div className="h-4 w-1/2 bg-slate-200 rounded animate-pulse" />
                <div className="h-3 w-full bg-slate-100 rounded animate-pulse" />
                <div className="h-8 w-20 bg-slate-200 rounded animate-pulse" />
              </div>
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-8">
            <p className="text-sm text-red-600 mb-2">{error}</p>
            <button onClick={retry} className="text-xs text-violet-600 hover:underline">
              Retry
            </button>
          </div>
        )}

        {data && (
          <div className="space-y-4">
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{data.summary}</p>

            <div className="space-y-3">
              {data.suggestions.map((s, i) => {
                const applied = appliedIds.has(i);
                const applying = applyingId === i;
                return (
                  <div
                    key={i}
                    className={`p-4 border rounded-lg transition-colors ${
                      applied
                        ? 'border-green-200 bg-green-50'
                        : 'border-slate-200 bg-white dark:bg-slate-800 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{s.title}</p>
                      <Badge variant={priorityVariant[s.priority] ?? 'neutral'} size="sm">{s.priority}</Badge>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">{s.reason}</p>
                    <button
                      onClick={() => void handleApply(s, i)}
                      disabled={applied || applying}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        applied
                          ? 'bg-green-100 text-green-700 cursor-default'
                          : 'bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50'
                      }`}
                    >
                      {applied ? 'Applied' : applying ? 'Applying...' : 'Apply'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
