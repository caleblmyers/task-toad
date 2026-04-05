import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import { AI_USAGE_QUERY, SET_AI_BUDGET_MUTATION } from '../api/queries';
import type { AIUsageSummary } from '../types';

const TIME_RANGES = [
  { label: '7d', days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
] as const;

const BUDGET_TIERS = [
  { label: 'Starter', cents: 500, desc: '$5/mo — trying out AI features' },
  { label: 'Standard', cents: 2500, desc: '$25/mo — regular use, small team' },
  { label: 'Professional', cents: 10000, desc: '$100/mo — heavy AI use, code gen' },
  { label: 'Unlimited', cents: null, desc: 'No limit — power users' },
  { label: 'Custom', cents: -1, desc: 'Set your own budget' },
] as const;

function formatCost(usd: number): string {
  return `$${usd.toFixed(4)}`;
}

function formatCostShort(usd: number): string {
  return `$${usd.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function budgetBarColor(percent: number): string {
  if (percent >= 100) return 'bg-red-600';
  if (percent >= 80) return 'bg-red-500';
  if (percent >= 50) return 'bg-amber-500';
  return 'bg-green-500';
}

function getSelectedTier(cents: number | null): string {
  if (cents === null) return 'Unlimited';
  const match = BUDGET_TIERS.find((t) => t.cents === cents);
  return match ? match.label : 'Custom';
}

const FEATURE_LABELS: Record<string, string> = {
  generateProjectOptions: 'Project Options',
  generateTaskPlan: 'Task Plan',
  expandTask: 'Expand Task',
  summarizeProject: 'Summarize',
  planSprints: 'Session Planning',
  generateTaskInstructions: 'Instructions',
  generateStandupReport: 'Standup',
  generateSprintReport: 'Session Report',
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
  const [selectedTier, setSelectedTier] = useState('Standard');
  const [customBudgetUSD, setCustomBudgetUSD] = useState('');
  const [alertThreshold, setAlertThreshold] = useState(80);
  const [enforcement, setEnforcement] = useState<'soft' | 'hard'>('soft');
  const [savingBudget, setSavingBudget] = useState(false);
  const [budgetMsg, setBudgetMsg] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setErr(null);
    gql<{ aiUsage: AIUsageSummary }>(AI_USAGE_QUERY, { days })
      .then((data) => {
        setUsage(data.aiUsage);
        const tier = getSelectedTier(data.aiUsage.budgetLimitCentsUSD);
        setSelectedTier(tier);
        if (tier === 'Custom' && data.aiUsage.budgetLimitCentsUSD != null) {
          setCustomBudgetUSD((data.aiUsage.budgetLimitCentsUSD / 100).toString());
        }
        setEnforcement(data.aiUsage.budgetEnforcement === 'hard' ? 'hard' : 'soft');
      })
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load usage'))
      .finally(() => setLoading(false));
  }, [days]);

  const getEffectiveCents = (): number | null => {
    if (selectedTier === 'Unlimited') return null;
    if (selectedTier === 'Custom') {
      return customBudgetUSD.trim() ? Math.round(parseFloat(customBudgetUSD) * 100) : null;
    }
    return BUDGET_TIERS.find((t) => t.label === selectedTier)?.cents ?? null;
  };

  const handleSaveBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBudget(true);
    setBudgetMsg(null);
    try {
      const cents = getEffectiveCents();
      await gql<unknown>(SET_AI_BUDGET_MUTATION, {
        monthlyBudgetCentsUSD: cents,
        alertThreshold,
        budgetEnforcement: enforcement,
      });
      setBudgetMsg('Budget saved.');
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

  const budgetUSD = usage.budgetLimitCentsUSD != null ? usage.budgetLimitCentsUSD / 100 : null;
  const overBudget = usage.budgetUsedPercent != null && usage.budgetUsedPercent >= 100;

  return (
    <div className="space-y-6">
      {/* Over-budget banner */}
      {overBudget && (
        <div className={`rounded-lg p-3 text-sm ${
          usage.budgetEnforcement === 'hard'
            ? 'bg-red-50 border border-red-200 text-red-800'
            : 'bg-amber-50 border border-amber-200 text-amber-800'
        }`}>
          {usage.budgetEnforcement === 'hard' ? (
            <><strong>Budget exceeded.</strong> AI features are blocked until the budget is increased.</>
          ) : (
            <><strong>Budget exceeded.</strong> AI features remain available (soft limit). Consider increasing your budget.</>
          )}
        </div>
      )}

      {/* Time range selector */}
      <div className="flex gap-1">
        {TIME_RANGES.map((r) => (
          <button
            key={r.days}
            onClick={() => setDays(r.days)}
            className={`px-3 py-1 text-xs rounded font-medium ${
              days === r.days
                ? 'bg-brand-green text-white'
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
            overBudget ? 'text-red-600' : 'text-slate-800'
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
        {budgetUSD != null && (
          <div className="bg-slate-50 rounded-lg p-3">
            <p className="text-xs text-slate-500 uppercase tracking-wide">Budget Remaining</p>
            <p className={`text-sm font-medium ${
              budgetUSD - usage.totalCostUSD < 0 ? 'text-red-600' : 'text-slate-800'
            }`}>
              {formatCostShort(budgetUSD - usage.totalCostUSD)}
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

      {/* Spend forecast */}
      {usage.projectedMonthlyCostUSD != null && usage.dailyAverageCostUSD != null && (
        <div className="bg-slate-50 rounded-lg p-3">
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Spend Forecast</p>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              Avg {formatCostShort(usage.dailyAverageCostUSD)}/day
            </span>
            <span className="text-slate-400">&rarr;</span>
            <span className="font-medium text-slate-800">
              ~{formatCostShort(usage.projectedMonthlyCostUSD)}/mo projected
            </span>
            {budgetUSD != null && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                usage.projectedMonthlyCostUSD > budgetUSD
                  ? 'bg-red-100 text-red-700'
                  : 'bg-green-100 text-green-700'
              }`}>
                {usage.projectedMonthlyCostUSD > budgetUSD
                  ? `Will exceed by ~${formatCostShort(usage.projectedMonthlyCostUSD - budgetUSD)}`
                  : 'On track'}
              </span>
            )}
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
        <form onSubmit={handleSaveBudget} className="space-y-4">
          {/* Tier selector */}
          <div>
            <label className="block text-xs text-slate-600 mb-2">Budget tier</label>
            <div className="grid grid-cols-2 gap-2">
              {BUDGET_TIERS.map((tier) => (
                <button
                  key={tier.label}
                  type="button"
                  onClick={() => setSelectedTier(tier.label)}
                  className={`text-left p-2 rounded border text-sm transition-colors ${
                    selectedTier === tier.label
                      ? 'border-brand-green bg-brand-green/5 ring-1 ring-brand-green'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="font-medium text-slate-800">{tier.label}</span>
                  <p className="text-xs text-slate-500 mt-0.5">{tier.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Custom budget input */}
          {selectedTier === 'Custom' && (
            <div>
              <label className="block text-xs text-slate-600 mb-1">Monthly budget (USD)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                placeholder="e.g. 10.00"
                value={customBudgetUSD}
                onChange={(e) => setCustomBudgetUSD(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-300 rounded text-sm"
              />
            </div>
          )}

          {/* Enforcement mode */}
          {selectedTier !== 'Unlimited' && (
            <div>
              <label className="block text-xs text-slate-600 mb-2">When budget is exceeded</label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setEnforcement('soft')}
                  className={`flex-1 p-2 rounded border text-sm text-left transition-colors ${
                    enforcement === 'soft'
                      ? 'border-brand-green bg-brand-green/5 ring-1 ring-brand-green'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="font-medium text-slate-800">Warn only</span>
                  <p className="text-xs text-slate-500 mt-0.5">Show warning, allow continued use</p>
                </button>
                <button
                  type="button"
                  onClick={() => setEnforcement('hard')}
                  className={`flex-1 p-2 rounded border text-sm text-left transition-colors ${
                    enforcement === 'hard'
                      ? 'border-red-500 bg-red-50 ring-1 ring-red-500'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="font-medium text-slate-800">Block</span>
                  <p className="text-xs text-slate-500 mt-0.5">Block AI calls until budget is increased</p>
                </button>
              </div>
            </div>
          )}

          {/* Alert threshold */}
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
            className="px-3 py-1.5 bg-brand-green text-white rounded text-sm hover:bg-brand-green-hover disabled:opacity-50"
          >
            {savingBudget ? 'Saving...' : 'Save budget'}
          </button>
        </form>
      </div>
    </div>
  );
}
