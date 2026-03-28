import { useState } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { gql } from '../api/client';
import type { ProjectOption } from '../types';
import Button from '../components/shared/Button';

interface LocationState {
  prompt: string;
  options: ProjectOption[];
}

const SESSION_KEY = 'tasktoad-new-project';

export default function NewProject() {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as LocationState | null;

  // Persist to sessionStorage on arrival, recover on refresh
  const state = (() => {
    if (locationState) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(locationState));
      return locationState;
    }
    const stored = sessionStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        return JSON.parse(stored) as LocationState;
      } catch {
        // corrupt data
      }
    }
    return null;
  })();

  const [options, setOptions] = useState<ProjectOption[]>(state?.options ?? []);
  const [selected, setSelected] = useState<ProjectOption | null>(null);
  const [customMode, setCustomMode] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDescription, setCustomDescription] = useState('');
  const [refineText, setRefineText] = useState('');
  const [showRefine, setShowRefine] = useState(false);
  const [refining, setRefining] = useState(false);
  const [additionalContext, setAdditionalContext] = useState('');
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!state) return <Navigate to="/app" replace />;

  // The primary recommendation (first option), and alternatives (rest)
  const recommendation = options[0] ?? null;
  const alternatives = options.slice(1);

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
      // Update sessionStorage with refined options
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        prompt: combinedPrompt,
        options: data.generateProjectOptions,
      }));
      setSelected(null);
      setRefineText('');
      setShowRefine(false);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to refine options');
    } finally {
      setRefining(false);
    }
  };

  const handleCreate = async (option?: ProjectOption) => {
    const target = option ?? selected;
    if (!target) return;
    if (option) setSelected(option);
    setCreating(true);
    setErr(null);
    try {
      const data = await gql<{ createProjectFromOption: { projectId: string } }>(
        `mutation CreateProjectFromOption($prompt: String!, $title: String!, $description: String!) {
          createProjectFromOption(prompt: $prompt, title: $title, description: $description) {
            projectId
          }
        }`,
        { prompt: state.prompt, title: target.title, description: target.description }
      );
      const projectId = data.createProjectFromOption.projectId;
      if (additionalContext.trim()) {
        await gql<{ createKnowledgeEntry: { knowledgeEntryId: string } }>(
          `mutation CreateKnowledgeEntry($projectId: ID!, $title: String!, $content: String!, $source: String, $category: String) {
            createKnowledgeEntry(projectId: $projectId, title: $title, content: $content, source: $source, category: $category) {
              knowledgeEntryId
            }
          }`,
          { projectId, title: 'Additional project context', content: additionalContext.trim(), source: 'user', category: 'context' }
        );
      }
      sessionStorage.removeItem(SESSION_KEY);
      navigate(`/app/projects/${projectId}`, {
        state: { autoPreview: true, showSetup: true },
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create project');
      setCreating(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto py-8">
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-200">Your project</h1>
        <button
          type="button"
          onClick={() => navigate('/app')}
          className="text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
        >
          &larr; Re-describe
        </button>
      </div>
      <p className="text-slate-500 dark:text-slate-400 mb-6 text-sm">
        Based on: <span className="italic">{state.prompt}</span>
      </p>

      {/* Primary recommendation */}
      {recommendation && !customMode && (
        <div className="mb-6">
          <div
            className={`p-5 rounded-lg border-2 transition-colors cursor-pointer ${
              selected?.title === recommendation.title
                ? 'border-slate-800 dark:border-slate-300 bg-slate-50 dark:bg-slate-800'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500'
            }`}
            onClick={() => { setSelected(recommendation); setCustomMode(false); setShowRefine(false); }}
          >
            <p className="font-semibold text-lg text-slate-800 dark:text-slate-200">{recommendation.title}</p>
            <p className="text-slate-600 dark:text-slate-400 text-sm mt-2">{recommendation.description}</p>
          </div>

          {/* Alternatives (only shown if AI returned multiple due to ambiguity) */}
          {alternatives.length > 0 && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-slate-400 dark:text-slate-500 uppercase tracking-wide font-medium">Alternative interpretations</p>
              {alternatives.map((alt) => (
                <button
                  key={alt.title}
                  type="button"
                  onClick={() => { setSelected(alt); setCustomMode(false); setShowRefine(false); }}
                  className={`w-full text-left p-3 rounded-lg border transition-colors ${
                    selected?.title === alt.title
                      ? 'border-slate-800 dark:border-slate-300 bg-slate-50 dark:bg-slate-800'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-400 dark:hover:border-slate-500'
                  }`}
                >
                  <p className="font-medium text-slate-700 dark:text-slate-300">{alt.title}</p>
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">{alt.description}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom project option */}
      <button
        type="button"
        onClick={() => {
          setCustomMode(true);
          setSelected(customTitle.trim() ? { title: customTitle.trim(), description: customDescription.trim() } : null);
          setShowRefine(false);
        }}
        className={`w-full text-left p-4 rounded-lg border-2 border-dashed transition-colors mb-4 ${
          customMode
            ? 'border-slate-800 dark:border-slate-300 bg-slate-50 dark:bg-slate-800'
            : 'border-slate-300 dark:border-slate-600 bg-slate-50/50 dark:bg-slate-800/50 hover:border-slate-400 dark:hover:border-slate-500'
        }`}
      >
        <p className="font-semibold text-slate-600 dark:text-slate-400">Describe your own project</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Define a custom title and description instead of using the AI suggestion</p>
      </button>

      {customMode && (
        <div className="space-y-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 mb-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Project title</label>
            <input
              type="text"
              value={customTitle}
              onChange={(e) => {
                setCustomTitle(e.target.value);
                const title = e.target.value.trim();
                setSelected(title ? { title, description: customDescription.trim() } : null);
              }}
              placeholder="e.g. Mobile App Redesign"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
            <textarea
              value={customDescription}
              onChange={(e) => {
                setCustomDescription(e.target.value);
                setSelected(customTitle.trim() ? { title: customTitle.trim(), description: e.target.value.trim() } : null);
              }}
              placeholder="Describe what this project is about..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded resize-none text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
            />
          </div>
        </div>
      )}

      {/* Additional context textarea — shown when an option is selected or custom mode is active */}
      {(selected || customMode) && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Anything else the AI should know? <span className="text-slate-400">(optional)</span>
          </label>
          <textarea
            value={additionalContext}
            onChange={(e) => setAdditionalContext(e.target.value)}
            placeholder="Tech preferences, constraints, deployment targets, team conventions..."
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 placeholder-slate-400"
            rows={3}
          />
        </div>
      )}

      {err && <p className="text-sm text-red-600 mb-4">{err}</p>}

      {/* Auto-select the recommendation if nothing else is selected */}
      {recommendation && !selected && !customMode && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button size="lg" loading={creating} onClick={() => void handleCreate(recommendation)} className="flex-1 rounded-lg font-medium">
              {creating ? 'Creating project...' : 'Approve & create'}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setShowRefine(true)} className="rounded-lg">
              Refine
            </Button>
          </div>
        </div>
      )}

      {selected && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <Button size="lg" loading={creating} onClick={() => void handleCreate()} className="flex-1 rounded-lg font-medium">
              {creating ? 'Creating project...' : 'Create this project \u2192'}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => setShowRefine(!showRefine)} className="rounded-lg">
              Refine
            </Button>
          </div>

          {showRefine && (
            <form onSubmit={handleRefine} className="space-y-2 p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Provide feedback to refine:
              </label>
              <textarea
                value={refineText}
                onChange={(e) => setRefineText(e.target.value)}
                placeholder="e.g. Focus on mobile-first design, use React Native..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded resize-none text-sm bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-green"
                disabled={refining}
              />
              <Button type="submit" loading={refining} size="sm">
                {refining ? 'Regenerating...' : 'Regenerate'}
              </Button>
            </form>
          )}
        </div>
      )}

      {!selected && !recommendation && !customMode && (
        <div className="text-center py-8 text-slate-400 dark:text-slate-500">
          <p>No recommendation available. Try describing your project differently.</p>
          <Button variant="ghost" size="sm" onClick={() => navigate('/app')} className="mt-2">
            Go back
          </Button>
        </div>
      )}
    </div>
  );
}
