import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';

function getPasswordErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 8) errors.push('At least 8 characters');
  if (!/[A-Z]/.test(password)) errors.push('At least one uppercase letter');
  if (!/[a-z]/.test(password)) errors.push('At least one lowercase letter');
  if (!/\d/.test(password)) errors.push('At least one digit');
  return errors;
}

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [touched, setTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signup, error } = useAuth();
  const navigate = useNavigate();

  const passwordErrors = useMemo(() => getPasswordErrors(password), [password]);
  const showErrors = touched && password.length > 0 && passwordErrors.length > 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (passwordErrors.length > 0) return;
    setLoading(true);
    try {
      await signup(email, password);
      navigate('/login', { replace: true });
    } catch {
      // error set in context
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900">
      <div className="w-full max-w-sm p-6 bg-white dark:bg-slate-800 rounded-lg shadow">
        <div className="flex items-center justify-center gap-2 mb-6">
          <img src="/logo.png" alt="TaskToad" className="w-10 h-10" />
          <h1 className="text-xl font-semibold text-slate-800 dark:text-slate-100">TaskToad</h1>
        </div>
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
            onBlur={() => setTouched(true)}
            hint="Min 8 characters, uppercase, lowercase, digit"
            required
            autoComplete="new-password"
          />
          {showErrors && (
            <ul className="text-sm text-red-600 list-disc pl-4" aria-live="polite">
              {passwordErrors.map((err) => (
                <li key={err}>{err}</li>
              ))}
            </ul>
          )}
          {error && <p className="text-sm text-red-600" aria-live="polite">{error}</p>}
          <Button type="submit" loading={loading} className="w-full">
            Create account
          </Button>
        </form>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Already have an account? <Link to="/login" className="text-slate-800 dark:text-slate-200 underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
