import { useState } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '../api/client';
import useAsyncData from '../hooks/useAsyncData';
import {
  PORTFOLIO_OVERVIEW_QUERY,
  INITIATIVES_QUERY,
  CREATE_INITIATIVE_MUTATION,
  UPDATE_INITIATIVE_MUTATION,
  DELETE_INITIATIVE_MUTATION,
  ADD_PROJECT_TO_INITIATIVE_MUTATION,
  REMOVE_PROJECT_FROM_INITIATIVE_MUTATION,
  INITIATIVE_SUMMARY_QUERY,
} from '../api/queries';
import Badge from '../components/shared/Badge';

interface ProjectSummary {
  projectId: string;
  name: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionPercent: number;
  activeSprint: string | null;
  healthScore: number | null;
  statusDistribution: Array<{ label: string; count: number }>;
}

interface PortfolioRollup {
  totalProjects: number;
  totalTasks: number;
  totalVelocity: number;
  avgCycleTimeHours: number | null;
  teamSprintProgress: { totalSprints: number; activeSprints: number; avgCompletionPercent: number };
  aggregateStatusDistribution: Array<{ label: string; count: number }>;
}

interface InitiativeProject {
  projectId: string;
  name: string;
}

interface Initiative {
  initiativeId: string;
  name: string;
  description: string | null;
  status: string;
  targetDate: string | null;
  projects: InitiativeProject[];
}

interface InitiativeSummaryData {
  initiativeId: string;
  name: string;
  status: string;
  targetDate: string | null;
  projectCount: number;
  totalTasks: number;
  completedTasks: number;
  completionPercent: number;
  healthScore: number | null;
}


function healthInfo(score: number | null): { label: string; variant: 'success' | 'warning' | 'danger' | 'neutral' } {
  if (score === null) return { label: 'N/A', variant: 'neutral' };
  if (score > 70) return { label: 'Healthy', variant: 'success' };
  if (score >= 40) return { label: 'At Risk', variant: 'warning' };
  return { label: 'Critical', variant: 'danger' };
}

const STATUS_COLORS: Record<string, string> = {
  todo: '#94a3b8',
  in_progress: '#3b82f6',
  in_review: '#8b5cf6',
  done: '#22c55e',
  blocked: '#ef4444',
};

function CircularProgress({ percent }: { percent: number }) {
  const r = 28;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;
  const color = percent >= 75 ? '#22c55e' : percent >= 40 ? '#3b82f6' : '#94a3b8';

  return (
    <svg width={72} height={72} className="flex-shrink-0">
      <circle cx={36} cy={36} r={r} fill="none" stroke="#e2e8f0" strokeWidth={6} />
      <circle
        cx={36}
        cy={36}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 36 36)"
        className="transition-all duration-500"
      />
      <text x={36} y={36} textAnchor="middle" dominantBaseline="central" className="text-sm font-semibold" fill="#334155">
        {percent}%
      </text>
    </svg>
  );
}

function StatusBar({ distribution, total }: { distribution: Array<{ label: string; count: number }>; total: number }) {
  if (total === 0) return <div className="h-2 bg-slate-100 rounded-full" />;
  return (
    <div className="flex h-2 rounded-full overflow-hidden bg-slate-100">
      {distribution.map((entry) => {
        const pct = (entry.count / total) * 100;
        if (pct === 0) return null;
        return (
          <div
            key={entry.label}
            className="h-full"
            style={{
              width: `${pct}%`,
              backgroundColor: STATUS_COLORS[entry.label] ?? '#94a3b8',
            }}
            title={`${entry.label}: ${entry.count}`}
          />
        );
      })}
    </div>
  );
}

function formatCycleTime(hours: number | null): string {
  if (hours === null) return 'N/A';
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours >= 24) return `${+(hours / 24).toFixed(1)}d`;
  return `${hours.toFixed(1)}h`;
}

// ── Create Initiative Modal ──

function CreateInitiativeModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetDate, setTargetDate] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await gql(CREATE_INITIATIVE_MUTATION, {
        name: name.trim(),
        description: description.trim() || null,
        targetDate: targetDate || null,
      });
      onCreated();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <form
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Create Initiative</h2>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
        <input
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Initiative name"
          autoFocus
        />
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
        <textarea
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Date</label>
        <input
          type="date"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm mb-4 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Creating...' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Edit Initiative Modal ──

function EditInitiativeModal({
  initiative,
  onClose,
  onUpdated,
}: {
  initiative: Initiative;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const [name, setName] = useState(initiative.name);
  const [description, setDescription] = useState(initiative.description ?? '');
  const [status, setStatus] = useState(initiative.status);
  const [targetDate, setTargetDate] = useState(
    initiative.targetDate ? initiative.targetDate.slice(0, 10) : '',
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await gql(UPDATE_INITIATIVE_MUTATION, {
        initiativeId: initiative.initiativeId,
        name: name.trim(),
        description: description.trim() || null,
        status,
        targetDate: targetDate || null,
      });
      onUpdated();
      onClose();
    } catch {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
      <form
        className="bg-white dark:bg-slate-800 rounded-xl shadow-xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <h2 className="text-lg font-semibold text-slate-800 dark:text-white mb-4">Edit Initiative</h2>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
        <input
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Initiative name"
          autoFocus
        />
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
        <textarea
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={2}
        />
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Status</label>
        <select
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm mb-3 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="active">Active</option>
          <option value="completed">Completed</option>
          <option value="archived">Archived</option>
        </select>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Target Date</label>
        <input
          type="date"
          className="w-full border border-slate-300 dark:border-slate-600 rounded-lg px-3 py-2 text-sm mb-4 bg-white dark:bg-slate-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <button type="button" className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200" onClick={onClose}>
            Cancel
          </button>
          <button
            type="submit"
            disabled={!name.trim() || saving}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Add Project to Initiative Dropdown ──

function AddProjectDropdown({
  initiativeId,
  availableProjects,
  onAdded,
}: {
  initiativeId: string;
  availableProjects: InitiativeProject[];
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);

  const handleAdd = async (projectId: string) => {
    await gql(ADD_PROJECT_TO_INITIATIVE_MUTATION, { initiativeId, projectId });
    setOpen(false);
    onAdded();
  };

  if (availableProjects.length === 0) return null;

  return (
    <div className="relative inline-block">
      <button
        className="text-xs text-blue-600 hover:text-blue-800 font-medium"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
      >
        + Add Project
      </button>
      {open && (
        <div className="absolute top-6 left-0 bg-white border border-slate-200 rounded-lg shadow-lg z-10 min-w-[180px] py-1">
          {availableProjects.map((p) => (
            <button
              key={p.projectId}
              className="block w-full text-left px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
              onClick={(e) => { e.stopPropagation(); handleAdd(p.projectId); }}
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Initiative Card ──

function InitiativeCard({
  initiative,
  summary,
  allProjects,
  isSelected,
  onSelect,
  onRefresh,
  onEdit,
}: {
  initiative: Initiative;
  summary: InitiativeSummaryData | null;
  allProjects: ProjectSummary[];
  isSelected: boolean;
  onSelect: (id: string | null) => void;
  onRefresh: () => void;
  onEdit: (initiative: Initiative) => void;
}) {
  const health = summary ? healthInfo(summary.healthScore) : { label: 'N/A', variant: 'neutral' as const };
  const linkedProjectIds = new Set(initiative.projects.map((p) => p.projectId));
  const availableProjects = allProjects
    .filter((p) => !linkedProjectIds.has(p.projectId))
    .map((p) => ({ projectId: p.projectId, name: p.name }));

  const handleRemoveProject = async (e: React.MouseEvent, projectId: string) => {
    e.stopPropagation();
    await gql(REMOVE_PROJECT_FROM_INITIATIVE_MUTATION, { initiativeId: initiative.initiativeId, projectId });
    onRefresh();
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await gql(DELETE_INITIATIVE_MUTATION, { initiativeId: initiative.initiativeId });
    if (isSelected) onSelect(null);
    onRefresh();
  };

  return (
    <div
      className={`bg-white rounded-xl border p-4 cursor-pointer transition-all ${
        isSelected ? 'border-blue-500 ring-2 ring-blue-100' : 'border-slate-200 hover:shadow-md'
      }`}
      onClick={() => onSelect(isSelected ? null : initiative.initiativeId)}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-slate-800 truncate">{initiative.name}</h3>
        <div className="flex items-center gap-2">
          <Badge variant={health.variant} size="sm">{health.label}</Badge>
          <button
            className="text-slate-400 hover:text-blue-500 text-xs"
            onClick={(e) => { e.stopPropagation(); onEdit(initiative); }}
            title="Edit initiative"
          >
            &#9998;
          </button>
          <button
            className="text-slate-400 hover:text-red-500 text-xs"
            onClick={handleDelete}
            title="Delete initiative"
          >
            &times;
          </button>
        </div>
      </div>

      {initiative.description && (
        <p className="text-xs text-slate-500 mb-2 line-clamp-2">{initiative.description}</p>
      )}

      <div className="flex items-center gap-4 text-xs text-slate-600 mb-2">
        <span>{summary?.projectCount ?? initiative.projects.length} projects</span>
        {summary && <span>{summary.completionPercent}% complete</span>}
        {summary && <span>{summary.totalTasks} tasks</span>}
      </div>

      {initiative.targetDate && (
        <p className="text-xs text-slate-500 mb-2">
          Target: {new Date(initiative.targetDate).toLocaleDateString()}
        </p>
      )}

      {/* Linked projects */}
      {initiative.projects.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {initiative.projects.map((p) => (
            <span
              key={p.projectId}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-100 rounded text-[10px] text-slate-600"
            >
              {p.name}
              <button
                className="text-slate-400 hover:text-red-500"
                onClick={(e) => handleRemoveProject(e, p.projectId)}
                title="Remove from initiative"
              >
                &times;
              </button>
            </span>
          ))}
        </div>
      )}

      <AddProjectDropdown
        initiativeId={initiative.initiativeId}
        availableProjects={availableProjects}
        onAdded={onRefresh}
      />
    </div>
  );
}

// ── Main Portfolio Component ──

interface PortfolioData {
  projects: ProjectSummary[];
  rollup: PortfolioRollup;
  initiatives: Initiative[];
  summaries: Record<string, InitiativeSummaryData>;
}

export default function Portfolio() {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingInitiative, setEditingInitiative] = useState<Initiative | null>(null);
  const [selectedInitiativeId, setSelectedInitiativeId] = useState<string | null>(null);

  const { data: portfolioData, loading, error, retry: loadData } = useAsyncData<PortfolioData>(
    async () => {
      const [pd, id] = await Promise.all([
        gql<{ portfolioOverview: ProjectSummary[]; portfolioRollup: PortfolioRollup }>(PORTFOLIO_OVERVIEW_QUERY),
        gql<{ initiatives: Initiative[] }>(INITIATIVES_QUERY),
      ]);

      const summaryEntries = await Promise.all(
        id.initiatives.map(async (init) => {
          const d = await gql<{ initiativeSummary: InitiativeSummaryData }>(INITIATIVE_SUMMARY_QUERY, {
            initiativeId: init.initiativeId,
          });
          return [init.initiativeId, d.initiativeSummary] as const;
        }),
      );

      return {
        projects: pd.portfolioOverview,
        rollup: pd.portfolioRollup,
        initiatives: id.initiatives,
        summaries: Object.fromEntries(summaryEntries),
      };
    },
    [],
  );

  const projects = portfolioData?.projects ?? [];
  const rollup = portfolioData?.rollup ?? null;
  const initiatives = portfolioData?.initiatives ?? [];
  const summaries = portfolioData?.summaries ?? {};

  // Filter projects when an initiative is selected
  const selectedInitiative = initiatives.find((i) => i.initiativeId === selectedInitiativeId);
  const filteredProjects = selectedInitiative
    ? projects.filter((p) => selectedInitiative.projects.some((ip) => ip.projectId === p.projectId))
    : projects;

  if (loading) {
    return (
      <div className="p-2">
        <h1 className="text-2xl font-semibold text-slate-800 mb-6">Portfolio</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
              <div className="h-5 bg-slate-200 rounded w-1/2 mb-4" />
              <div className="h-16 bg-slate-100 rounded mb-3" />
              <div className="h-2 bg-slate-100 rounded" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-2">
        <h1 className="text-2xl font-semibold text-slate-800 mb-6">Portfolio</h1>
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-slate-800">Portfolio</h1>
        <span className="text-sm text-slate-500">{projects.length} projects</span>
      </div>

      {/* Rollup metrics */}
      {rollup && rollup.totalProjects > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-6">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Projects</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{rollup.totalProjects}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Total Tasks</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{rollup.totalTasks}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Velocity</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{rollup.totalVelocity}<span className="text-sm font-normal text-slate-400 ml-1">pts</span></p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Avg Cycle Time</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{formatCycleTime(rollup.avgCycleTimeHours)}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Active Sprints</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">
                {rollup.teamSprintProgress.activeSprints}
                <span className="text-sm font-normal text-slate-400 ml-1">/ {rollup.teamSprintProgress.totalSprints}</span>
              </p>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Sprint Progress</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">{Math.round(rollup.teamSprintProgress.avgCompletionPercent)}%</p>
            </div>
          </div>

          {/* Aggregate status bar */}
          {rollup.aggregateStatusDistribution.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-6">
              <p className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Org-wide Status Distribution</p>
              <StatusBar distribution={rollup.aggregateStatusDistribution} total={rollup.totalTasks} />
              <div className="flex gap-4 mt-2">
                {rollup.aggregateStatusDistribution.map((entry) => (
                  <span key={entry.label} className="flex items-center gap-1 text-[10px] text-slate-500">
                    <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: STATUS_COLORS[entry.label] ?? '#94a3b8' }} />
                    {entry.label.replace('_', ' ')}: {entry.count}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Initiatives section */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-800">Initiatives</h2>
          <button
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            onClick={() => setShowCreateModal(true)}
          >
            Create Initiative
          </button>
        </div>
        {initiatives.length === 0 ? (
          <p className="text-sm text-slate-500">No initiatives yet. Create one to group related projects.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {initiatives.map((init) => (
              <InitiativeCard
                key={init.initiativeId}
                initiative={init}
                summary={summaries[init.initiativeId] ?? null}
                allProjects={projects}
                isSelected={selectedInitiativeId === init.initiativeId}
                onSelect={setSelectedInitiativeId}
                onRefresh={loadData}
                onEdit={setEditingInitiative}
              />
            ))}
          </div>
        )}
        {selectedInitiative && (
          <div className="mt-2 text-xs text-blue-600">
            Showing projects for: <span className="font-medium">{selectedInitiative.name}</span>
            <button className="ml-2 underline" onClick={() => setSelectedInitiativeId(null)}>
              Clear filter
            </button>
          </div>
        )}
      </div>

      {/* Projects grid */}
      {filteredProjects.length === 0 ? (
        <p className="text-slate-500">
          {selectedInitiative
            ? 'No projects linked to this initiative yet.'
            : <>No projects yet. <Link to="/app" className="underline">Create one.</Link></>
          }
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredProjects.map((p) => {
            const health = healthInfo(p.healthScore);
            return (
              <Link
                key={p.projectId}
                to={`/app/projects/${p.projectId}`}
                className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-semibold text-slate-800 truncate">{p.name}</h2>
                  <Badge variant={health.variant} size="sm">{health.label}</Badge>
                </div>

                {/* Progress + metrics */}
                <div className="flex items-center gap-4 mb-3">
                  <CircularProgress percent={p.completionPercent} />
                  <div className="flex-1 space-y-1.5 text-xs text-slate-600">
                    <div className="flex justify-between">
                      <span>Total</span>
                      <span className="font-medium text-slate-800">{p.totalTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Completed</span>
                      <span className="font-medium text-green-600">{p.completedTasks}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Overdue</span>
                      <span className={`font-medium ${p.overdueTasks > 0 ? 'text-red-600' : 'text-slate-400'}`}>
                        {p.overdueTasks}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Status distribution bar */}
                <StatusBar distribution={p.statusDistribution} total={p.totalTasks} />

                {/* Active sprint */}
                {p.activeSprint && (
                  <div className="mt-3 text-xs text-slate-500">
                    Active: <span className="text-slate-700 font-medium">{p.activeSprint}</span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {showCreateModal && (
        <CreateInitiativeModal
          onClose={() => setShowCreateModal(false)}
          onCreated={loadData}
        />
      )}

      {editingInitiative && (
        <EditInitiativeModal
          initiative={editingInitiative}
          onClose={() => setEditingInitiative(null)}
          onUpdated={loadData}
        />
      )}
    </div>
  );
}
