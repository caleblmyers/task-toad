import { useState, useEffect, useCallback } from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import NotificationCenter from '../components/NotificationCenter';
import NotificationSettings from '../components/NotificationSettings';
import GlobalSearchModal from '../components/GlobalSearchModal';
import UserAvatar from '../components/shared/UserAvatar';
import { useEventSource } from '../hooks/useEventSource';

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);

  // Fetch profile avatar
  useEffect(() => {
    gql<{ me: { avatarUrl: string | null; displayName: string | null } | null }>(
      `query MeAvatar { me { avatarUrl displayName } }`
    )
      .then((data) => {
        setProfileAvatar(data.me?.avatarUrl ?? null);
        setProfileDisplayName(data.me?.displayName ?? null);
      })
      .catch(() => {/* non-critical */});
  }, []);

  // SSE real-time events
  const handleSSEEvent = useCallback((_event: string, _data: unknown) => {
    // For MVP: events are received but UI refresh is handled by individual pages
    // Future: dispatch to a global event bus or context for granular state updates
  }, []);
  const { connected: sseConnected } = useEventSource(handleSSEEvent);

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

  const notificationLabel = unreadCount > 0
    ? `Notifications (${unreadCount} unread)`
    : 'Notifications';

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-slate-800 focus:text-white focus:rounded-lg"
      >
        Skip to main content
      </a>

      <aside className="w-56 bg-slate-800 text-white flex flex-col relative">
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <Link to="/app" className="font-semibold text-lg">TaskToad</Link>
          {sseConnected && (
            <span className="flex items-center gap-1 text-[10px] text-green-400" role="status" aria-live="polite">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <nav className="p-2 flex-1 space-y-1" aria-label="Main navigation">
          <Link to="/app" className="block px-3 py-2 rounded hover:bg-slate-700">
            New Project
          </Link>
          <Link to="/app/projects" className="block px-3 py-2 rounded hover:bg-slate-700">
            Projects
          </Link>
          <Link to="/app/search" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-700 text-sm">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" strokeLinecap="round" />
            </svg>
            Search
          </Link>
          <Link to="/app/profile" className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-700 text-sm">
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="8" cy="5.5" r="3" />
              <path d="M2.5 14.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
            </svg>
            Profile
          </Link>
          {user?.role === 'org:admin' && (
            <Link to="/app/settings" className="block px-3 py-2 rounded hover:bg-slate-700">
              Settings
            </Link>
          )}
          <button
            onClick={() => setShowSearch(true)}
            className="flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-700 w-full text-left text-sm text-slate-400"
            aria-label="Quick search"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <circle cx="7" cy="7" r="4.5" />
              <path d="M10.5 10.5L14 14" strokeLinecap="round" />
            </svg>
            Quick Search
            <kbd className="ml-auto text-[10px] text-slate-500 border border-slate-600 rounded px-1">&#8984;K</kbd>
          </button>
        </nav>
        <div className="p-4 border-t border-slate-700 text-sm">
          <div className="flex items-center justify-between mb-2">
            {user?.email && (
              <UserAvatar
                email={user.email}
                avatarUrl={profileAvatar}
                displayName={profileDisplayName}
                size="sm"
                className="mr-2"
              />
            )}
            <p className="truncate flex-1">{profileDisplayName || user?.email}</p>
            <button
              type="button"
              onClick={() => {
                setShowNotifSettings((v) => !v);
                setShowNotifications(false);
              }}
              className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
              aria-label="Notification preferences"
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <circle cx="8" cy="8" r="2" />
                <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeLinecap="round" />
              </svg>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowNotifications((v) => !v);
                setShowNotifSettings(false);
                if (!showNotifications) setUnreadCount(0);
              }}
              className="relative text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
              aria-label={notificationLabel}
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M4 6a4 4 0 018 0c0 2 1 3 1.5 4H2.5C3 10 4 8 4 6z" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M6 11v1a2 2 0 004 0v-1" strokeLinecap="round" />
              </svg>
              {unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center" aria-live="polite">
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
        {showNotifSettings && (
          <div className="absolute bottom-full left-0 mb-2 w-80 bg-white rounded-lg shadow-lg border border-slate-200 p-4 z-50">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800">Notification Preferences</h3>
              <button
                type="button"
                onClick={() => setShowNotifSettings(false)}
                className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                aria-label="Close notification preferences"
              >
                &times;
              </button>
            </div>
            <NotificationSettings />
          </div>
        )}
      </aside>
      <main id="main-content" className="flex-1 p-6 overflow-auto">
        <Outlet />
      </main>
      {showSearch && <GlobalSearchModal onClose={() => setShowSearch(false)} />}
    </div>
  );
}
