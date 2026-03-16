import { useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { gql } from '../api/client';
import Button from '../components/shared/Button';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow text-center">
          <p className="text-red-600">Invalid reset link.</p>
          <p className="mt-2 text-sm">
            <Link to="/forgot-password" className="text-slate-800 underline">Request a new one</Link>
          </p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await gql<{ resetPassword: boolean }>(
        `mutation ResetPassword($token: String!, $newPassword: String!) {
          resetPassword(token: $token, newPassword: $newPassword)
        }`,
        { token, newPassword }
      );
      navigate('/login', { state: { message: 'Password updated — please log in.' }, replace: true });
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Reset failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow">
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Set new password</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            placeholder="New password (min 8 characters)"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded"
            required
            minLength={8}
          />
          {err && <p className="text-sm text-red-600">{err}</p>}
          <Button type="submit" loading={loading} className="w-full">
            {loading ? 'Saving…' : 'Save new password'}
          </Button>
        </form>
      </div>
    </div>
  );
}
