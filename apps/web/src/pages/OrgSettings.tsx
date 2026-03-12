import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import type { Org } from '../types';

const ORG_QUERY = `query GetOrg { org { orgId name hasApiKey apiKeyHint } }`;

export default function OrgSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [org, setOrg] = useState<Org | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (user?.role !== 'org:admin') {
      navigate('/app', { replace: true });
      return;
    }
    gql<{ org: Org }>(ORG_QUERY)
      .then((data) => setOrg(data.org))
      .catch((e) => setErr(e instanceof Error ? e.message : 'Failed to load org'));
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!apiKey.trim()) return;
    setSaving(true);
    setErr(null);
    setSuccess(false);
    try {
      const data = await gql<{ setOrgApiKey: Org }>(
        `mutation SetOrgApiKey($apiKey: String!) { setOrgApiKey(apiKey: $apiKey) { orgId name hasApiKey apiKeyHint } }`,
        { apiKey: apiKey.trim() }
      );
      setOrg(data.setOrgApiKey);
      setApiKey('');
      setSuccess(true);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to save API key');
    } finally {
      setSaving(false);
    }
  };

  if (!org) {
    return <div className="p-4 text-slate-500">{err ?? 'Loading…'}</div>;
  }

  return (
    <div className="max-w-lg">
      <h1 className="text-2xl font-semibold text-slate-800 mb-6">Settings</h1>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide">Organization</p>
          <p className="text-lg text-slate-800 mt-1">{org.name}</p>
        </div>

        <div>
          <p className="text-sm font-medium text-slate-500 uppercase tracking-wide mb-1">
            Anthropic API Key
          </p>
          {org.hasApiKey ? (
            <p className="text-slate-700 font-mono text-sm">
              {org.apiKeyHint} <span className="text-slate-400 font-sans">(configured)</span>
            </p>
          ) : (
            <p className="text-amber-600 text-sm">Not configured — AI features are disabled.</p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label className="block text-sm font-medium text-slate-700">
            {org.hasApiKey ? 'Replace API key' : 'Add API key'}
          </label>
          <input
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded font-mono text-sm"
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          {success && <p className="text-sm text-green-600">API key saved.</p>}
          <button
            type="submit"
            disabled={saving || !apiKey.trim()}
            className="px-4 py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
