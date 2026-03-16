import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import { IconClose } from './shared/Icons';

interface TrendAnalysis {
  period: string;
  completionTrend: string;
  velocityTrend: string;
  healthTrend: string;
  insights: string[];
  recommendations: string[];
}

const QUERY = `query AnalyzeTrends($projectId: ID!, $period: String) {
  analyzeTrends(projectId: $projectId, period: $period) {
    period completionTrend velocityTrend healthTrend insights recommendations
  }
}`;

interface Props {
  projectId: string;
  disabled?: boolean;
  onClose: () => void;
}

function trendArrow(trend: string): { icon: string; color: string } {
  const lower = trend.toLowerCase();
  if (lower.startsWith('improving') || lower.startsWith('increasing')) {
    return { icon: '\u2191', color: 'text-green-600' };
  }
  if (lower.startsWith('declining') || lower.startsWith('decreasing')) {
    return { icon: '\u2193', color: 'text-red-600' };
  }
  return { icon: '\u2192', color: 'text-slate-500' };
}

export default function TrendAnalysisPanel({ projectId, disabled, onClose }: Props) {
  const [data, setData] = useState<TrendAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await gql<{ analyzeTrends: TrendAnalysis }>(QUERY, { projectId });
      setData(result.analyzeTrends);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze trends');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    generate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-800">Trend Analysis</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={loading || disabled}
              className="text-xs text-slate-500 hover:text-slate-700 px-2 py-1 border border-slate-200 rounded disabled:opacity-50"
            >
              {loading ? 'Analyzing...' : 'Refresh'}
            </button>
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600">
              <IconClose className="w-4 h-4" />
            </button>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg mb-4">{error}</div>
        )}

        {loading && !data && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-slate-100 rounded animate-pulse" />
            ))}
          </div>
        )}

        {data && (
          <div className="space-y-4">
            {/* Period */}
            <div className="text-sm text-slate-500">Period: {data.period}</div>

            {/* Trend indicators */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Completion', value: data.completionTrend },
                { label: 'Velocity', value: data.velocityTrend },
                { label: 'Health', value: data.healthTrend },
              ].map((t) => {
                const { icon, color } = trendArrow(t.value);
                return (
                  <div key={t.label} className="bg-white border border-slate-200 rounded-lg p-3">
                    <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-1">{t.label}</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-2xl font-bold ${color}`}>{icon}</span>
                      <span className="text-sm text-slate-700">{t.value}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Insights */}
            {data.insights.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-4">
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Insights</p>
                <ul className="space-y-1.5">
                  {data.insights.map((insight, i) => (
                    <li key={i} className="text-sm text-slate-700 flex gap-2">
                      <span className="text-slate-400 flex-shrink-0">&#8226;</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Recommendations */}
            {data.recommendations.length > 0 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs font-medium text-blue-600 uppercase tracking-wide mb-2">Recommendations</p>
                <ul className="space-y-1.5">
                  {data.recommendations.map((rec, i) => (
                    <li key={i} className="text-sm text-blue-800 flex gap-2">
                      <span className="text-blue-400 flex-shrink-0">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
