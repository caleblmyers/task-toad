import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { gql } from '../api/client';
import type { ProjectOption } from '../types';
import Button from '../components/shared/Button';

interface LocationState {
  prompt: string;
  options: ProjectOption[];
}

export default function NewProject() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;

  const [options, setOptions] = useState<ProjectOption[]>(state?.options ?? []);
  const [selected, setSelected] = useState<ProjectOption | null>(null);
  const [refineText, setRefineText] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [refining, setRefining] = useState(false);
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!state) return <Navigate to="/app" replace />;

  const handleRefine = async (e: React.FormEvent) => {
    e.preventDefault();
    setRefining(true);
    setErr(null);
    const combinedPrompt = refineText.trim()
      ? `${state.prompt}\n\nAdditional context: ${refineText}`
      : state.prompt;
    try {
      const data = await gql<{ generateProjectOptions: ProjectOption[] }>(
        `mutation GenerateOptions($prompt: String!) {
          generateProjectOptions(prompt: $prompt) { title description }
        }`,
        { prompt: combinedPrompt }
      );
      setOptions(data.generateProjectOptions);
      setSelected(null);
      setRefineText('');
      setShowRefine(false);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to refine options');
    } finally {
      setRefining(false);
    }
  };

  const handleCreate = async () => {
    if (!selected) return;
    setCreating(true);
    setErr(null);
    try {
      const data = await gql<{ createProjectFromOption: { projectId: string } }>(
        `mutation CreateProjectFromOption($prompt: String!, $title: String!, $description: String!) {
          createProjectFromOption(prompt: $prompt, title: $title, description: $description) {
            projectId
          }
        }`,
        { prompt: state.prompt, title: selected.title, description: selected.description }
      );
      navigate(`/app/projects/${data.createProjectFromOption.projectId}`, {
        state: { autoPreview: true },
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create project');
      setCreating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-slate-800">Choose a starting point</h1>
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="text-sm text-slate-500 hover:text-slate-700"
        >
          ← Re-describe
        </button>
      </div>
      <p className="text-slate-500 mb-6 text-sm">
        Based on: <span className="italic">{state.prompt}</span>
      </p>

      <div className="space-y-3 mb-6">
        {options.map((opt) => {
          const isSelected = selected?.title === opt.title;
          return (
            <button
              key={opt.title}
              type="button"
              onClick={() => { setSelected(opt); setShowRefine(false); }}
              className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                isSelected
                  ? 'border-slate-800 bg-slate-50'
                  : 'border-slate-200 bg-white hover:border-slate-400'
              }`}
            >
              <p className="font-semibold text-slate-800">{opt.title}</p>
              <p className="text-slate-600 text-sm mt-1">{opt.description}</p>
            </button>
          );
        })}
      </div>

      {err && <p className="text-sm text-red-600 mb-4">{err}</p>}

      {selected && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button size="lg" loading={creating} onClick={handleCreate} className="flex-1 rounded-lg font-medium">
              {creating ? 'Creating project…' : 'Create this project →'}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setShowRefine(!showRefine)} className="rounded-lg">
              Refine
            </Button>
          </div>

          {showRefine && (
            <form onSubmit={handleRefine} className="space-y-2 p-4 bg-slate-50 rounded-lg">
              <label className="text-sm font-medium text-slate-700">
                Add context to refine the options:
              </label>
              <textarea
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder="e.g. Focus on mobile-first design, use React Native…"
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded resize-none text-sm focus:outline-none focus:ring-2 focus:ring-brand-green"
                disabled={refining}
              />
              <Button type="submit" loading={refining} size="sm">
                {refining ? 'Regenerating…' : 'Regenerate options'}
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
