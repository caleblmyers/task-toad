import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';

export default function CreateOrg() {
  const [name, setName] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { refreshMe } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      await gql<{ createOrg: { orgId: string } }>(
        `mutation CreateOrg($name: String!, $apiKey: String) { createOrg(name: $name, apiKey: $apiKey) { orgId } }`,
        { name, apiKey: apiKey.trim() || null }
      );
      await refreshMe();
      navigate('/home', { replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to create organization');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-800 rounded-lg shadow">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">Create your organization</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Organization name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Input
            label="Anthropic API key"
            type="password"
            placeholder="sk-ant-..."
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            hint="Optional — you can add this later in Settings."
          />
          {err && <p className="text-sm text-red-600" aria-live="polite">{err}</p>}
          <Button type="submit" loading={loading} className="w-full">
            Create
          </Button>
        </form>
      </div>
    </div>
  );
}
