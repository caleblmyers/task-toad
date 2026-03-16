import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import Button from '../components/shared/Button';

export default function Signup() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signup, error } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await signup(email, password);
      navigate('/login', { replace: true });
    } catch {
      // error set in context
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
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded"
            required
          />
          <input
            type="password"
            placeholder="Password (min 8, upper, lower, digit)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 rounded"
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <Button type="submit" className="w-full">
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
