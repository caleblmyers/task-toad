import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gql, TOKEN_KEY } from '../api/client';
import { useAuth } from '../auth/context';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';

export default function AcceptInvite() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { refreshMe } = useAuth();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
        <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-800 rounded-lg shadow text-center">
          <p className="text-red-600">Invalid invite link.</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const data = await gql<{ acceptInvite: { token: string } }>(
        `mutation AcceptInvite($token: String!, $password: String) {
          acceptInvite(token: $token, password: $password) { token }
        }`,
        { token, password: password || null }
      );
      localStorage.setItem(TOKEN_KEY, data.acceptInvite.token);
      await refreshMe();
      navigate('/app', { replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Failed to accept invite');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-800 rounded-lg shadow">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-2">Accept invite</h1>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
          Create a password to join the team, or leave it blank if you already have a TaskToad account with this email.
        </p>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={err ?? undefined}
            hint="For new accounts — min 8 characters"
            autoComplete="new-password"
          />
          <Button type="submit" loading={loading} className="w-full">
            Join team
          </Button>
        </form>
      </div>
    </div>
  );
}
