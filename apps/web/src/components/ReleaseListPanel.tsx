import type { Release, Task } from '../types';
import ReleaseDetailPanel from './ReleaseDetailPanel';
import Button from './shared/Button';

interface ReleaseListPanelProps {
  releases: Release[];
  selectedRelease: Release | null;
  projectTasks: Task[];
  loading: boolean;
  onSelectRelease: (release: Release | null) => void;
  onCreateRelease: () => void;
  onUpdateRelease: (releaseId: string, updates: Partial<Pick<Release, 'name' | 'version' | 'description' | 'status' | 'releaseDate' | 'releaseNotes'>>) => Promise<void>;
  onDeleteRelease: (releaseId: string) => Promise<void>;
  onAddTask: (releaseId: string, task: Task) => Promise<void>;
  onRemoveTask: (releaseId: string, taskId: string) => Promise<void>;
  onGenerateNotes: (releaseId: string) => Promise<void>;
}

const STATUS_GROUPS: Array<{ key: string; label: string; color: string }> = [
  { key: 'draft', label: 'Draft', color: 'text-slate-600 dark:text-slate-400' },
  { key: 'scheduled', label: 'Scheduled', color: 'text-blue-600 dark:text-blue-400' },
  { key: 'released', label: 'Released', color: 'text-green-600 dark:text-green-400' },
  { key: 'archived', label: 'Archived', color: 'text-amber-600 dark:text-amber-400' },
];

const STATUS_BADGE: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300',
  scheduled: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  released: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

function ReleaseCard({ release, onClick }: { release: Release; onClick: () => void }) {
  const tasks = release.tasks ?? [];
  const doneTasks = tasks.filter((t) => t.status === 'done');
  const completionPct = tasks.length > 0 ? Math.round((doneTasks.length / tasks.length) * 100) : 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all bg-white dark:bg-slate-800"
    >
      <div className="flex items-center gap-2 mb-1">
        <span className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">{release.name}</span>
        <span className="px-1.5 py-0.5 text-xs font-mono bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 rounded">
          v{release.version}
        </span>
        <span className={`px-1.5 py-0.5 text-xs rounded ${STATUS_BADGE[release.status] ?? STATUS_BADGE.draft}`}>
          {release.status}
        </span>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <span>{tasks.length} task{tasks.length !== 1 ? 's' : ''} ({completionPct}% done)</span>
        {release.releaseDate && <span>{release.releaseDate}</span>}
      </div>
      {tasks.length > 0 && (
        <div className="mt-2 w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5">
          <div className="bg-green-500 h-1.5 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
        </div>
      )}
    </button>
  );
}

export default function ReleaseListPanel({
  releases,
  selectedRelease,
  projectTasks,
  loading,
  onSelectRelease,
  onCreateRelease,
  onUpdateRelease,
  onDeleteRelease,
  onAddTask,
  onRemoveTask,
  onGenerateNotes,
}: ReleaseListPanelProps) {
  if (selectedRelease) {
    return (
      <ReleaseDetailPanel
        release={selectedRelease}
        projectTasks={projectTasks}
        onUpdate={onUpdateRelease}
        onDelete={onDeleteRelease}
        onAddTask={onAddTask}
        onRemoveTask={onRemoveTask}
        onGenerateNotes={onGenerateNotes}
        onClose={() => onSelectRelease(null)}
      />
    );
  }

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Releases</h2>
        <Button size="sm" onClick={onCreateRelease}>+ New Release</Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-100 dark:bg-slate-700 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : releases.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-2">No releases yet</p>
          <Button size="sm" onClick={onCreateRelease}>Create your first release</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {STATUS_GROUPS.map((group) => {
            const groupReleases = releases.filter((r) => r.status === group.key);
            if (groupReleases.length === 0) return null;
            return (
              <div key={group.key}>
                <h3 className={`text-xs font-semibold uppercase tracking-wider mb-2 ${group.color}`}>
                  {group.label} ({groupReleases.length})
                </h3>
                <div className="space-y-2">
                  {groupReleases.map((release) => (
                    <ReleaseCard
                      key={release.releaseId}
                      release={release}
                      onClick={() => onSelectRelease(release)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
