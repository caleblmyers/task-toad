import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSent, setResendSent] = useState(false);
  const { login, error } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const successMessage = (location.state as { message?: string } | null)?.message;

  const needsVerification = error?.toLowerCase().includes('verify your email');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResendSent(false);
    try {
      await login(email, password);
      navigate('/home', { replace: true });
    } catch {
      // error set in context
    } finally {
      setLoading(false);
    }
  }

  const handleResendVerification = async () => {
    if (!email || resendLoading) return;
    setResendLoading(true);
    try {
      await gql<{ requestVerificationEmail: boolean }>(
        `mutation RequestVerificationEmail($email: String!) {
          requestVerificationEmail(email: $email)
        }`,
        { email },
      );
      setResendSent(true);
    } catch {
      // Silently fail — don't leak info
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-800 rounded-lg shadow">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/logo.png" alt="TaskToad" className="w-10 h-10" />
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">TaskToad</h1>
        </div>
        {successMessage && <p className="mb-3 text-sm text-green-700">{successMessage}</p>}
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
          {error && (
            <div>
              <p className="text-sm text-red-600" aria-live="polite">{error}</p>
              {needsVerification && !resendSent && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading || !email}
                  className="mt-1 text-sm text-slate-800 dark:text-slate-200 underline hover:no-underline disabled:opacity-50"
                >
                  {resendLoading ? 'Sending...' : 'Resend verification email'}
                </button>
              )}
              {needsVerification && resendSent && (
                <p className="mt-1 text-sm text-green-700 dark:text-green-400">
                  If an account exists with that email, a verification link has been sent.
                </p>
              )}
            </div>
          )}
          <Button type="submit" loading={loading} className="w-full">
            Sign in
          </Button>
        </form>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          No account? <Link to="/signup" className="text-slate-800 dark:text-slate-200 underline">Sign up</Link>
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          <Link to="/forgot-password" className="text-slate-800 dark:text-slate-200 underline">Forgot password?</Link>
        </p>
      </div>
    </div>
  );
}
