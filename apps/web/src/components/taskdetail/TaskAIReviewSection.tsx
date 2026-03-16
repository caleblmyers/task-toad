import type { CodeReview } from '../../types';

interface TaskAIReviewSectionProps {
  review: CodeReview | null;
  loading: boolean;
}

const severityStyles: Record<string, string> = {
  error: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
  info: 'bg-blue-100 text-blue-700',
};

export default function TaskAIReviewSection({ review, loading }: TaskAIReviewSectionProps) {
  if (loading) {
    return (
      <div className="mb-4">
        <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">AI Code Review</p>
        <div className="border border-slate-200 rounded-lg p-4 animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-3" />
          <div className="h-3 bg-slate-200 rounded w-full mb-2" />
          <div className="h-3 bg-slate-200 rounded w-2/3" />
        </div>
      </div>
    );
  }

  if (!review) return null;

  return (
    <div className="mb-4">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">AI Code Review</p>
      <div className="border border-slate-200 rounded-lg p-4 space-y-3">
        {/* Approval badge */}
        <div className="flex items-center gap-2">
          {review.approved ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              Approved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Changes Requested
            </span>
          )}
        </div>

        {/* Summary */}
        <p className="text-sm text-slate-700">{review.summary}</p>

        {/* Comments */}
        {review.comments.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Comments ({review.comments.length})</p>
            <div className="space-y-2">
              {review.comments.map((c, i) => (
                <div key={i} className="bg-slate-50 rounded p-2.5 text-xs">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${severityStyles[c.severity] ?? severityStyles.info}`}>
                      {c.severity}
                    </span>
                    <span className="font-mono text-slate-500">
                      {c.file}{c.line != null ? `:${c.line}` : ''}
                    </span>
                  </div>
                  <p className="text-slate-700">{c.comment}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Suggestions */}
        {review.suggestions.length > 0 && (
          <div>
            <p className="text-xs font-medium text-slate-500 mb-1">Suggestions</p>
            <ul className="list-disc list-inside space-y-1">
              {review.suggestions.map((s, i) => (
                <li key={i} className="text-xs text-slate-700">{s}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
