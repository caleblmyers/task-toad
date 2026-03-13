import { useState, useEffect } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import NotificationCenter from '../components/NotificationCenter';
import GlobalSearchModal from '../components/GlobalSearchModal';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);

  // Poll unread count every 60s
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const data = await gql<{ unreadNotificationCount: number }>(
          `query UnreadCount { unreadNotificationCount }`
        );
        setUnreadCount(data.unreadNotificationCount);
      } catch {
        // ignore
      }
    };
    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setShowSearch((v) => !v);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="w-56 bg-slate-800 text-white flex flex-col relative">
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
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-700 w-full text-left text-sm"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" strokeLinecap="round" />
            </svg>
            Search
            <kbd className="ml-auto text-[10px] text-slate-500 border border-slate-600 rounded px-1">&#8984;K</kbd>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-700 text-sm">
          <div className="flex items-center justify-between mb-2">
            <p className="truncate flex-1">{user?.email}</p>
            <button
              type="button"
              onClick={() => {
                setShowNotifications((v) => !v);
                if (!showNotifications) setUnreadCount(0);
              }}
              className="relative text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
              title="Notifications"
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M4 6a4 4 0 018 0c0 2 1 3 1.5 4H2.5C3 10 4 8 4 6z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 11v1a2 2 0 004 0v-1" strokeLinecap="round" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>
          </div>
          <p className="text-slate-400">{user?.role === 'org:admin' ? 'Admin' : 'Member'}</p>
          <button
            type="button"
            onClick={handleLogout}
            className="mt-2 text-slate-400 hover:text-white"
          >
            Sign out
          </button>
        </div>
        {showNotifications && (
          <NotificationCenter onClose={() => setShowNotifications(false)} />
        )}
      </aside>
      <main className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
      {showSearch && <GlobalSearchModal onClose={() => setShowSearch(false)} />}
    </div>
  );
}
