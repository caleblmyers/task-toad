import { useState } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '../api/client';
import Button from '../components/shared/Button';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await gql<{ requestPasswordReset: boolean }>(
        `mutation RequestPasswordReset($email: String!) { requestPasswordReset(email: $email) }`,
        { email }
      );
      setSubmitted(true);
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow">
        <h1 className="text-xl font-semibold text-slate-800 mb-4">Forgot password</h1>

        {submitted ? (
          <p className="text-slate-700 text-sm">
            If that email exists, a password reset link was sent. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded"
              required
            />
            {err && <p className="text-sm text-red-600">{err}</p>}
            <Button type="submit" loading={loading} className="w-full">
              {loading ? 'Sending…' : 'Send reset link'}
            </Button>
          </form>
        )}

        <p className="mt-4 text-sm text-slate-600">
          <Link to="/login" className="text-slate-800 underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
