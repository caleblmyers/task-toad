import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-56 bg-slate-800 text-white flex flex-col">
        <div className="p-4 border-b border-slate-700">
          <Link to="/app" className="font-semibold text-lg">TaskToad</Link>
        </div>
        <nav className="p-2 flex-1 space-y-1">
          <Link to="/app" className="block px-3 py-2 rounded hover:bg-slate-700">
            New Project
          </Link>
          <Link to="/app/projects" className="block px-3 py-2 rounded hover:bg-slate-700">
            Projects
          </Link>
          {user?.role === 'org:admin' && (
            <Link to="/app/settings" className="block px-3 py-2 rounded hover:bg-slate-700">
              Settings
            </Link>
          )}
        </nav>
        <div className="p-4 border-t border-slate-700 text-sm">
          <p className="truncate">{user?.email}</p>
          <p className="text-slate-400">{user?.role === 'org:admin' ? 'Admin' : 'Member'}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 text-slate-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
