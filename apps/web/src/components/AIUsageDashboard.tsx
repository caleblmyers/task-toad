import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import type { AIUsageSummary } from '../types';

const AI_USAGE_QUERY = `query AIUsage($days: Int) {
  aiUsage(days: $days) {
    totalCostUSD totalInputTokens totalOutputTokens totalCalls
    byFeature { feature calls costUSD avgLatencyMs }
    budgetUsedPercent budgetLimitCentsUSD
  }
}`;

const SET_BUDGET_MUTATION = `mutation SetAIBudget($monthlyBudgetCentsUSD: Int, $alertThreshold: Int) {
  setAIBudget(monthlyBudgetCentsUSD: $monthlyBudgetCentsUSD, alertThreshold: $alertThreshold) {
    orgId monthlyBudgetCentsUSD budgetAlertThreshold
  }
}`;

const TIME_RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function budgetBarColor(percent: number): string {
  if (percent >= 80) return 'bg-red-500';
  if (percent >= 50) return 'bg-amber-500';
  return 'bg-green-500';
}

const FEATURE_LABELS: Record<string, string> = {
  generateProjectOptions: 'Project Options',
  generateTaskPlan: 'Task Plan',
  expandTask: 'Expand Task',
  summarizeProject: 'Summarize',
  planSprints: 'Sprint Planning',
  generateTaskInstructions: 'Instructions',
  generateStandupReport: 'Standup',
  generateSprintReport: 'Sprint Report',
  analyzeProjectHealth: 'Health Analysis',
  extractTasksFromNotes: 'Meeting Notes',
  generateCode: 'Code Gen',
  regenerateFile: 'Regen File',
  generateCommitMessage: 'Commit Msg',
  enrichPRDescription: 'PR Description',
};

export default function AIUsageDashboard() {
  const [usage, setUsage] = useState<AIUsageSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  // Budget form
  const [budgetUSD, setBudgetUSD] = useState('');
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetMsg, setBudgetMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    gql<{ aiUsage: AIUsageSummary }>(AI_USAGE_QUERY, { days })
      .then((data) => {
        setUsage(data.aiUsage);
        if (data.aiUsage.budgetLimitCentsUSD != null) {
          setBudgetUSD((data.aiUsage.budgetLimitCentsUSD / 100).toString());
        }
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load usage'))
      .finally(() => setLoading(false));
  }, [days]);

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBudget(true);
    setBudgetMsg(null);
    try {
      const cents = budgetUSD.trim() ? Math.round(parseFloat(budgetUSD) * 100) : null;
      await gql<unknown>(SET_BUDGET_MUTATION, {
        monthlyBudgetCentsUSD: cents,
        alertThreshold,
      });
      setBudgetMsg('Budget saved.');
      // Refresh usage data
      const data = await gql<{ aiUsage: AIUsageSummary }>(AI_USAGE_QUERY, { days });
      setUsage(data.aiUsage);
    } catch (e) {
      setBudgetMsg(e instanceof Error ? e.message : 'Failed to save budget');
    } finally {
      setSavingBudget(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-20 bg-slate-100 rounded animate-pulse" />
        <div className="h-40 bg-slate-100 rounded animate-pulse" />
      </div>
    );
  }

  if (err) {
    return <p className="text-sm text-red-600">{err}</p>;
  }

  if (!usage) return null;

  return (
    <div className="space-y-6">
      {/* Time range selector */}
      <div className="flex gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`px-3 py-1 text-xs rounded font-medium ${
              days === r.days
                ? 'bg-slate-800 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Cost</p>
          <p className={`text-xl font-semibold ${
            usage.budgetUsedPercent != null && usage.budgetUsedPercent >= 80
              ? 'text-red-600'
              : 'text-slate-800'
          }`}>
            {formatCost(usage.totalCostUSD)}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">API Calls</p>
          <p className="text-xl font-semibold text-slate-800">{usage.totalCalls}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Tokens (in/out)</p>
          <p className="text-sm font-medium text-slate-800">
            {formatTokens(usage.totalInputTokens)} / {formatTokens(usage.totalOutputTokens)}
          </p>
        </div>
        {usage.budgetLimitCentsUSD != null && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Budget Remaining</p>
            <p className="text-sm font-medium text-slate-800">
              {formatCost((usage.budgetLimitCentsUSD / 100) - usage.totalCostUSD)}
            </p>
          </div>
        )}
      </div>

      {/* Budget usage bar */}
      {usage.budgetUsedPercent != null && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Budget used</span>
            <span>{usage.budgetUsedPercent.toFixed(1)}%</span>
          </div>
          <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${budgetBarColor(usage.budgetUsedPercent)}`}
              style={{ width: `${Math.min(usage.budgetUsedPercent, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Per-feature breakdown */}
      {usage.byFeature.length > 0 && (
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">By Feature</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 uppercase tracking-wide border-b border-slate-200">
                <th className="pb-1 font-medium">Feature</th>
                <th className="pb-1 font-medium text-right">Calls</th>
                <th className="pb-1 font-medium text-right">Cost</th>
                <th className="pb-1 font-medium text-right">Avg Latency</th>
              </tr>
            </thead>
            <tbody>
              {usage.byFeature.map((f) => (
                <tr key={f.feature} className="border-b border-slate-100">
                  <td className="py-1.5 text-slate-800">{FEATURE_LABELS[f.feature] ?? f.feature}</td>
                  <td className="py-1.5 text-right text-slate-600">{f.calls}</td>
                  <td className="py-1.5 text-right text-slate-600">{formatCost(f.costUSD)}</td>
                  <td className="py-1.5 text-right text-slate-600">{f.avgLatencyMs}ms</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Budget settings */}
      <div>
        <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-2">Budget Settings</p>
        <form onSubmit={handleSaveBudget} className="space-y-3">
          <div>
            <label className="block text-xs text-slate-600 mb-1">Monthly budget (USD)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              placeholder="e.g. 10.00 (empty = no limit)"
              value={budgetUSD}
              onChange={(e) => setBudgetUSD(e.target.value)}
              className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-600 mb-1">
              Alert threshold: {alertThreshold}%
            </label>
            <input
              type="range"
              min="1"
              max="100"
              value={alertThreshold}
              onChange={(e) => setAlertThreshold(Number(e.target.value))}
              className="w-full"
            />
          </div>
          {budgetMsg && (
            <p className={`text-xs ${budgetMsg.includes('saved') ? 'text-green-600' : 'text-red-600'}`}>
              {budgetMsg}
            </p>
          )}
          <button
            type="submit"
            disabled={savingBudget}
            className="px-3 py-1.5 bg-slate-800 text-white rounded text-sm hover:bg-slate-700 disabled:opacity-50"
          >
            {savingBudget ? 'Saving...' : 'Save budget'}
          </button>
        </form>
      </div>
    </div>
  );
}
