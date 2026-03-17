import { useState } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '../api/client';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';

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
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-800 rounded-lg shadow">
        <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-4">Forgot password</h1>

        {submitted ? (
          <p className="text-slate-700 dark:text-slate-300 text-sm">
            If that email exists, a password reset link was sent. Check your inbox.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={err ?? undefined}
              required
              autoComplete="email"
            />
            <Button type="submit" loading={loading} className="w-full">
              Send reset link
            </Button>
          </form>
        )}

        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          <Link to="/login" className="text-slate-800 dark:text-slate-200 underline">Back to sign in</Link>
        </p>
      </div>
    </div>
  );
}
