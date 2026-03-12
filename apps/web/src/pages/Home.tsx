import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { gql } from '../api/client';
import type { ProjectOption } from '../types';

export default function Home() {
  const navigate = useNavigate();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const data = await gql<{ generateProjectOptions: ProjectOption[] }>(
        `mutation GenerateOptions($prompt: String!) {
          generateProjectOptions(prompt: $prompt) { title description }
        }`,
        { prompt }
      );
      navigate('/app/projects/new', {
        state: { prompt, options: data.generateProjectOptions },
      });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to generate options');
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-full py-16">
      <div className="w-full max-w-2xl">
        <h1 className="text-3xl font-semibold text-slate-800 mb-2 text-center">
          What's on your task list today?
        </h1>
        <p className="text-slate-500 text-center mb-8">
          Describe a project or task and we'll help you break it down.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g. Build a recipe sharing app where users can post, discover, and save recipes…"
            rows={4}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-slate-400 text-slate-800 placeholder-slate-400"
            disabled={loading}
          />
          {err && (
            err.includes('API key') ? (
              <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2">
                No Anthropic API key configured. Go to{' '}
                <Link to="/app/settings" className="underline font-medium">Settings</Link>{' '}
                to add one.
              </p>
            ) : (
              <p className="text-sm text-red-600">{err}</p>
            )
          )}
          <button
            type="submit"
            disabled={loading || !prompt.trim()}
            className="w-full py-3 bg-slate-800 text-white rounded-lg font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Thinking…' : 'Generate project options →'}
          </button>
        </form>
      </div>
    </div>
  );
}
