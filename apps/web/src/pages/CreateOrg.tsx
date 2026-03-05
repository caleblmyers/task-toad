import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { apiPost } from '../api/client';

export default function CreateOrg() {
  const [name, setName] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const { refreshMe } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const { error } = await apiPost<{ orgId: string }>('/orgs', { name });
    if (error) {
      setErr(error);
      return;
    }
    await refreshMe();
    navigate('/app', { replace: true });
  }

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
          {err && <p className="text-sm text-red-600">{err}</p>}
          <button type="submit" className="w-full py-2 bg-slate-800 text-white rounded">
            Create
          </button>
        </form>
      </div>
    </div>
  );
}
