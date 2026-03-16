import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';

export default function CreateOrg() {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { refreshMe } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    try {
      await gql<{ createOrg: { orgId: string } }>(
        `mutation CreateOrg($name: String!, $apiKey: String) { createOrg(name: $name, apiKey: $apiKey) { orgId } }`,
        { name, apiKey: apiKey.trim() || null }
      );
      await refreshMe();
      navigate('/app', { replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create organization');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow">
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Create your organization</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            placeholder="Organization name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded"
            required
          />
          <div>
            <input
              type="password"
              placeholder="Anthropic API key (optional)"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded"
            />
            <p className="text-xs text-slate-400 mt-1">You can add this later in Settings.</p>
          </div>
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="submit" className="w-full py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover">
            Create
          </button>
        </form>
      </div>
    </div>
  );
}
