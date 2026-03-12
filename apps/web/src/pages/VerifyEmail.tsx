import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gql } from '../api/client';
import { useAuth } from '../auth/context';

export default function VerifyEmail() {
  const [searchParams] = useSearchParams();
  const { user, refreshMe } = useAuth();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [status, setStatus] = useState<'idle' | 'verifying' | 'done' | 'error'>('idle');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Already verified — go to app
  useEffect(() => {
    if (user?.emailVerifiedAt) {
      navigate('/app', { replace: true });
    }
  }, [user, navigate]);

  // Auto-verify if token in URL
  useEffect(() => {
    if (!token) return;
    setStatus('verifying');
    gql<{ verifyEmail: boolean }>(
      `mutation VerifyEmail($token: String!) { verifyEmail(token: $token) }`,
      { token }
    )
      .then(async () => {
        await refreshMe();
        setStatus('done');
        navigate('/app', { replace: true });
      })
      .catch((e) => {
        setErr(e instanceof Error ? e.message : 'Verification failed');
        setStatus('error');
      });
  }, [token, navigate, refreshMe]);

  const handleResend = async () => {
    setResending(true);
    setErr(null);
    try {
      await gql<{ sendVerificationEmail: boolean }>('mutation { sendVerificationEmail }');
      setResent(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Failed to resend');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow text-center space-y-4">
        <h1 className="text-xl font-semibold text-slate-800">Verify your email</h1>

        {status === 'verifying' && (
          <p className="text-slate-600">Verifying…</p>
        )}

        {status === 'error' && (
          <>
            <p className="text-red-600 text-sm">{err ?? 'Verification failed.'}</p>
            <p className="text-slate-600 text-sm">The link may have expired. Request a new one below.</p>
          </>
        )}

        {status === 'idle' && (
          <p className="text-slate-600 text-sm">
            We sent a verification link to your email. Check your inbox and click the link to continue.
          </p>
        )}

        {(status === 'idle' || status === 'error') && user && (
          <>
            {resent ? (
              <p className="text-green-600 text-sm">Verification email sent! Check your inbox.</p>
            ) : (
              <button
                onClick={handleResend}
                disabled={resending}
                className="w-full py-2 bg-slate-800 text-white rounded hover:bg-slate-700 disabled:opacity-50"
              >
                {resending ? 'Sending…' : 'Resend verification email'}
              </button>
            )}
            {err && status !== 'error' && <p className="text-red-600 text-sm">{err}</p>}
          </>
        )}
      </div>
    </div>
  );
}
