import { useState } from 'react';
import { gql } from '../../api/client';

interface AIPromptLogEntry {
  id: string;
  feature: string;
  input: string;
  output: string;
  inputTokens: number;
  outputTokens: number;
  costUSD: number;
  latencyMs: number;
  model: string;
  cached: boolean;
  createdAt: string;
}

const QUERY = `query AIPromptHistory($taskId: String, $limit: Int) {
  aiPromptHistory(taskId: $taskId, limit: $limit) {
    id feature input output inputTokens outputTokens costUSD latencyMs model cached createdAt
  }
}`;

const FEATURE_BADGES: Record<string, { label: string; color: string }> = {
  generateTaskInstructions: { label: 'Instructions', color: 'bg-blue-100 text-blue-700' },
  generateCode: { label: 'Code Gen', color: 'bg-purple-100 text-purple-700' },
  expandTask: { label: 'Expand', color: 'bg-green-100 text-green-700' },
  generateTaskPlan: { label: 'Plan', color: 'bg-orange-100 text-orange-700' },
  reviewCode: { label: 'Review', color: 'bg-red-100 text-red-700' },
  parseBugReport: { label: 'Bug Report', color: 'bg-yellow-100 text-yellow-700' },
};

function formatTime(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface Props {
  taskId: string;
}

export default function TaskAIHistory({ taskId }: Props) {
  const [logs, setLogs] = useState<AIPromptLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const loadHistory = () => {
    setLoading(true);
    gql<{ aiPromptHistory: AIPromptLogEntry[] }>(QUERY, { taskId, limit: 10 })
      .then((data) => setLogs(data.aiPromptHistory))
      .catch(() => {/* non-critical */})
      .finally(() => setLoading(false));
  };

  const handleToggle = () => {
    const next = !expanded;
    setExpanded(next);
    if (next && logs.length === 0) loadHistory();
  };

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={handleToggle}
        className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wide mb-2 hover:text-slate-700"
      >
        <svg
          className={`w-3 h-3 transition-transform ${expanded ? 'rotate-90' : ''}`}
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        AI History
        {logs.length > 0 && <span className="text-slate-400 normal-case font-normal">({logs.length})</span>}
      </button>

      {expanded && (
        <div className="space-y-2">
          {loading ? (
            <div className="text-xs text-slate-400 py-2">Loading AI history...</div>
          ) : logs.length === 0 ? (
            <div className="text-xs text-slate-400 py-2">No AI interactions for this task.</div>
          ) : (
            logs.map((log) => {
              const badge = FEATURE_BADGES[log.feature] ?? { label: log.feature, color: 'bg-slate-100 text-slate-600' };
              const isExpanded = expandedLogId === log.id;

              return (
                <div key={log.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-slate-50"
                  >
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.color}`}>
                      {badge.label}
                    </span>
                    <span className="text-xs text-slate-500 flex-1">{formatTime(log.createdAt)}</span>
                    <span className="text-[10px] text-slate-400">
                      {log.inputTokens + log.outputTokens} tok
                    </span>
                    <span className="text-[10px] text-slate-400">
                      ${log.costUSD.toFixed(4)}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {log.latencyMs}ms
                    </span>
                    {log.cached && (
                      <span className="text-[10px] bg-green-100 text-green-700 px-1 rounded">cached</span>
                    )}
                    <svg
                      className={`w-3 h-3 text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                      viewBox="0 0 16 16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M6 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>

                  {isExpanded && (
                    <div className="border-t border-slate-200 px-3 py-2 space-y-2 bg-slate-50">
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Prompt</p>
                        <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto bg-white border border-slate-100 rounded p-2">
                          {log.input}
                        </pre>
                      </div>
                      <div>
                        <p className="text-[10px] font-medium text-slate-500 uppercase mb-1">Response</p>
                        <pre className="text-xs text-slate-600 font-mono whitespace-pre-wrap max-h-40 overflow-y-auto bg-white border border-slate-100 rounded p-2">
                          {log.output}
                        </pre>
                      </div>
                      <div className="flex gap-3 text-[10px] text-slate-400">
                        <span>Model: {log.model}</span>
                        <span>Input: {log.inputTokens} tokens</span>
                        <span>Output: {log.outputTokens} tokens</span>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
