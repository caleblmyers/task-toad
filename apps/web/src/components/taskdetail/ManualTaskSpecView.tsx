import { useState } from 'react';
import Badge from '../shared/Badge';

interface ManualTaskSpecFile {
  path: string;
  action: string;
  description: string;
}

interface ManualTaskSpecSnippet {
  file: string;
  language: string;
  code: string;
  explanation: string;
}

export interface ManualTaskSpec {
  filesToChange: ManualTaskSpecFile[];
  approach: string[];
  codeSnippets: ManualTaskSpecSnippet[];
  testingNotes: string;
  dependencies: string[];
}

interface ManualTaskSpecViewProps {
  spec: ManualTaskSpec | null;
  loading: boolean;
  onGenerate: () => void;
}

const ACTION_VARIANT: Record<string, 'success' | 'info' | 'danger'> = {
  create: 'success',
  modify: 'info',
  delete: 'danger',
};

export default function ManualTaskSpecView({ spec, loading, onGenerate }: ManualTaskSpecViewProps) {
  const [expandedSnippets, setExpandedSnippets] = useState<Set<number>>(new Set());

  if (!spec && !loading) {
    return (
      <button
        type="button"
        onClick={onGenerate}
        className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 dark:text-slate-200"
      >
        ✦ Generate Implementation Spec
      </button>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400 py-2">
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Generating spec…
      </div>
    );
  }

  if (!spec) return null;

  const toggleSnippet = (idx: number) => {
    setExpandedSnippets((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  return (
    <div className="space-y-4 mt-3">
      {/* Files to Change */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Files to Change</h4>
        <div className="space-y-1">
          {spec.filesToChange.map((f, i) => (
            <div key={i} className="flex items-start gap-2 text-sm">
              <Badge variant={ACTION_VARIANT[f.action] ?? 'neutral'} size="sm">{f.action}</Badge>
              <code className="text-xs text-slate-600 dark:text-slate-400 font-mono">{f.path}</code>
              <span className="text-slate-500 dark:text-slate-400 text-xs">{f.description}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Approach */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Approach</h4>
        <ol className="list-decimal list-inside space-y-1 text-sm text-slate-600 dark:text-slate-400">
          {spec.approach.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      </div>

      {/* Code Snippets */}
      {spec.codeSnippets.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Code Snippets</h4>
          <div className="space-y-2">
            {spec.codeSnippets.map((snippet, i) => (
              <div key={i}>
                <button
                  type="button"
                  onClick={() => toggleSnippet(i)}
                  className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <svg className={`w-3 h-3 transition-transform ${expandedSnippets.has(i) ? 'rotate-90' : ''}`} viewBox="0 0 12 12" fill="currentColor">
                    <path d="M4 2l5 4-5 4V2z" />
                  </svg>
                  <code className="font-mono">{snippet.file}</code>
                  <span className="text-slate-400">— {snippet.explanation}</span>
                </button>
                {expandedSnippets.has(i) && (
                  <pre className="mt-1 rounded-md bg-slate-900 text-slate-100 text-xs p-3 overflow-x-auto">
                    <code>{snippet.code}</code>
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Testing Notes */}
      <div>
        <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Testing Notes</h4>
        <p className="text-sm text-slate-600 dark:text-slate-400">{spec.testingNotes}</p>
      </div>

      {/* Dependencies */}
      {spec.dependencies.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Dependencies</h4>
          <div className="flex flex-wrap gap-1">
            {spec.dependencies.map((dep, i) => (
              <Badge key={i} variant="accent" size="sm">{dep}</Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
