import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';

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
    <div className="min-h-screen flex items-center justify-center bg-slate-100">
      <div className="w-full max-w-sm p-6 bg-white rounded-lg shadow">
        <h1 className="text-xl font-semibold text-slate-800 mb-4">TaskToad – Sign up</h1>
        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded"
            required
          />
          <input
            type="password"
            placeholder="Password (min 8, upper, lower, digit)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded"
            required
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" className="w-full py-2 bg-slate-800 text-white rounded">
            Create account
          </button>
        </form>
        <p className="mt-4 text-sm text-slate-600">
          Already have an account? <Link to="/login" className="text-slate-800 underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
