import { useState } from 'react';
import type { DependencyRef } from './HierarchicalPlanEditor';

interface PlanDependencyEditorProps {
  dependsOn: DependencyRef[];
  allTitles: string[];
  nodeTitle: string;
  onChange: (deps: DependencyRef[]) => void;
}

export default function PlanDependencyEditor({
  dependsOn,
  allTitles,
  nodeTitle,
  onChange,
}: PlanDependencyEditorProps) {
  const [search, setSearch] = useState('');
  const [linkType, setLinkType] = useState<'blocks' | 'informs'>('blocks');

  const available = allTitles.filter(
    (t) =>
      t !== nodeTitle &&
      !dependsOn.some((d) => d.title === t) &&
      t.toLowerCase().includes(search.toLowerCase()),
  );

  const handleAdd = (title: string) => {
    onChange([...dependsOn, { title, linkType }]);
    setSearch('');
  };

  const handleRemove = (title: string) => {
    onChange(dependsOn.filter((d) => d.title !== title));
  };

  return (
    <div className="space-y-2 p-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
      {/* Existing dependencies */}
      {dependsOn.length > 0 && (
        <div className="space-y-1">
          {dependsOn.map((dep) => (
            <div
              key={dep.title}
              className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300"
            >
              <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-[10px] font-medium">
                {dep.linkType}
              </span>
              <span className="truncate flex-1">{dep.title}</span>
              <button
                onClick={() => handleRemove(dep.title)}
                className="text-slate-400 hover:text-red-500"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add new dependency */}
      <div className="flex gap-1">
        <select
          value={linkType}
          onChange={(e) => setLinkType(e.target.value as 'blocks' | 'informs')}
          className="text-[10px] px-1.5 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded"
        >
          <option value="blocks">blocks</option>
          <option value="informs">informs</option>
        </select>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search nodes..."
          className="flex-1 text-xs px-2 py-1 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {search && available.length > 0 && (
        <div className="max-h-32 overflow-y-auto border border-slate-200 dark:border-slate-600 rounded">
          {available.slice(0, 10).map((title) => (
            <button
              key={title}
              onClick={() => handleAdd(title)}
              className="w-full text-left text-xs px-2 py-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 truncate"
            >
              {title}
            </button>
          ))}
        </div>
      )}

      {search && available.length === 0 && (
        <p className="text-[10px] text-slate-400">No matching nodes</p>
      )}
    </div>
  );
}
