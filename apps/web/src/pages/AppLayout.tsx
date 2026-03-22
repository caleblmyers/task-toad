import { useState, useEffect, useCallback, useRef } from 'react';
import { Outlet, Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/context';
import { gql } from '../api/client';
import NotificationCenter from '../components/NotificationCenter';
import NotificationSettings from '../components/NotificationSettings';
import GlobalSearchModal from '../components/GlobalSearchModal';
import UserAvatar from '../components/shared/UserAvatar';
import { IconSun, IconMoon } from '../components/shared/Icons';
import Card from '../components/shared/Card';
import { useSSEListener } from '../hooks/useEventSource';
import { useFocusTrap } from '../hooks/useFocusTrap';

const SIDEBAR_COLLAPSED_KEY = 'task-toad-sidebar-collapsed';

// Nav item definitions for DRY rendering
interface NavItem {
  to: string;
  end?: boolean;
  label: string;
  icon?: React.ReactNode;
  adminOnly?: boolean;
}

const searchIcon = (
  <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5L14 14" strokeLinecap="round" />
  </svg>
);

const NAV_ITEMS: NavItem[] = [
  { to: '/app', end: true, label: 'New Project', icon: (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M8 3v10M3 8h10" strokeLinecap="round" />
    </svg>
  ) },
  { to: '/app/projects', label: 'Projects', icon: (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 4h10M3 8h10M3 12h10" strokeLinecap="round" />
    </svg>
  ) },
  { to: '/app/portfolio', label: 'Portfolio', icon: (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <rect x="1.5" y="3" width="5" height="4" rx="0.5" />
      <rect x="9.5" y="3" width="5" height="4" rx="0.5" />
      <rect x="1.5" y="9" width="5" height="4" rx="0.5" />
      <rect x="9.5" y="9" width="5" height="4" rx="0.5" />
    </svg>
  ) },
  { to: '/app/search', label: 'Search', icon: searchIcon },
  { to: '/app/profile', label: 'Profile', icon: (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="5.5" r="3" />
      <path d="M2.5 14.5c0-3 2.5-5 5.5-5s5.5 2 5.5 5" strokeLinecap="round" />
    </svg>
  ) },
  { to: '/app/settings', label: 'Settings', adminOnly: true, icon: (
    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <circle cx="8" cy="8" r="2" />
      <path d="M8 1.5v2M8 12.5v2M1.5 8h2M12.5 8h2M3.05 3.05l1.41 1.41M11.54 11.54l1.41 1.41M3.05 12.95l1.41-1.41M11.54 4.46l1.41-1.41" strokeLinecap="round" />
    </svg>
  ) },
];

// Hamburger / collapse toggle icon
function MenuIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
    </svg>
  );
}

function ChevronLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
      <path d="M10 4l-4 4 4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function AppLayout() {
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showSearch, setShowSearch] = useState(false);
  const [profileAvatar, setProfileAvatar] = useState<string | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(() => {
    const stored = localStorage.getItem('task-toad-dark-mode');
    if (stored !== null) return stored === 'true';
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Sidebar collapse state (desktop)
  const [collapsed, setCollapsed] = useState(() => {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === 'true';
  });

  // Mobile drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const hamburgerRef = useRef<HTMLButtonElement>(null);

  const { handleFocusTrapKeyDown: handleDrawerFocusTrap } = useFocusTrap(drawerRef, drawerOpen);

  // Persist collapse preference
  useEffect(() => {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(collapsed));
  }, [collapsed]);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    hamburgerRef.current?.focus();
  }, []);

  // Close mobile drawer on Escape
  useEffect(() => {
    if (!drawerOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [drawerOpen, closeDrawer]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
    localStorage.setItem('task-toad-dark-mode', String(darkMode));
  }, [darkMode]);

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

  const fetchCount = useCallback(async () => {
    try {
      const data = await gql<{ unreadNotificationCount: number }>(
        `query UnreadCount { unreadNotificationCount }`
      );
      setUnreadCount(data.unreadNotificationCount);
    } catch {
      // ignore
    }
  }, []);

  // SSE real-time events (single connection via SSEProvider wrapping Outlet)
  const handleSSEEvent = useCallback((event: string, _data: unknown) => {
    if (event === 'notification.created') {
      void fetchCount();
    }
  }, [fetchCount]);
  const { connected: sseConnected } = useSSEListener(['notification.created'], handleSSEEvent);

  // Poll unread count every 60s as SSE fallback
  useEffect(() => {
    void fetchCount(); // eslint-disable-line react-hooks/set-state-in-effect -- legitimate polling side effect
    const interval = setInterval(() => void fetchCount(), 60000);
    return () => clearInterval(interval);
  }, [fetchCount]);

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

  const handleLogout = async () => {
    await logout();
    window.location.href = '/login';
  };

  const notificationLabel = unreadCount > 0
    ? `Notifications (${unreadCount} unread)`
    : 'Notifications';

  // Shared sidebar content rendered in both desktop aside and mobile drawer
  const sidebarContent = (isDrawer: boolean) => {
    const isExpanded = isDrawer || !collapsed;

    return (
      <>
        <div className="p-4 border-b border-slate-700 flex items-center justify-between">
          <Link to="/app" className={`flex items-center gap-2 font-semibold text-lg ${!isExpanded ? 'justify-center w-full' : ''}`}>
            <img src="/logo.png" alt="" className="w-7 h-7 flex-shrink-0" aria-hidden="true" />
            {isExpanded && 'TaskToad'}
          </Link>
          {isExpanded && sseConnected && (
            <span className="flex items-center gap-1 text-[10px] text-green-400" role="status" aria-live="polite">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              Live
            </span>
          )}
        </div>
        <nav className="p-2 flex-1 space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            if (item.adminOnly && user?.role !== 'org:admin') return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={isDrawer ? closeDrawer : undefined}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-700 text-sm ${isActive ? 'bg-slate-700 text-white' : ''} ${!isExpanded ? 'justify-center' : ''}`
                }
                title={!isExpanded ? item.label : undefined}
              >
                {item.icon}
                {isExpanded && <span>{item.label}</span>}
              </NavLink>
            );
          })}
          <button
            onClick={() => setShowSearch(true)}
            className={`flex items-center gap-2 px-3 py-2 rounded hover:bg-slate-700 w-full text-left text-sm text-slate-400 ${!isExpanded ? 'justify-center' : ''}`}
            aria-label="Quick search"
            title={!isExpanded ? 'Quick Search (⌘K)' : undefined}
          >
            {searchIcon}
            {isExpanded && (
              <>
                Quick Search
                <kbd className="ml-auto text-[10px] text-slate-500 border border-slate-600 rounded px-1">&#8984;K</kbd>
              </>
            )}
          </button>
        </nav>
        <div className={`p-4 border-t border-slate-700 text-sm ${!isExpanded ? 'flex flex-col items-center' : ''}`}>
          <div className={`flex items-center mb-2 ${!isExpanded ? 'justify-center' : 'justify-between'}`}>
            {user?.email && (
              <UserAvatar
                email={user.email}
                avatarUrl={profileAvatar}
                displayName={profileDisplayName}
                size="sm"
                className={isExpanded ? 'mr-2' : ''}
              />
            )}
            {isExpanded && (
              <>
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
              </>
            )}
          </div>
          {isExpanded && (
            <div className="flex items-center justify-between">
              <p className="text-slate-400">{user?.role === 'org:admin' ? 'Admin' : 'Member'}</p>
              <button
                type="button"
                onClick={() => setDarkMode((v) => !v)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700"
                aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
              >
                {darkMode ? <IconSun className="w-4 h-4" /> : <IconMoon className="w-4 h-4" />}
              </button>
            </div>
          )}
          {!isExpanded && (
            <>
              <button
                type="button"
                onClick={() => {
                  setShowNotifSettings((v) => !v);
                  setShowNotifications(false);
                }}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 mt-1"
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
                className="relative text-slate-400 hover:text-white p-1 rounded hover:bg-slate-700 mt-1"
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
            </>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className={`mt-2 text-slate-400 hover:text-white ${!isExpanded ? 'text-xs' : ''}`}
            title={!isExpanded ? 'Sign out' : undefined}
          >
            {isExpanded ? 'Sign out' : (
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M6 2H3a1 1 0 00-1 1v10a1 1 0 001 1h3M10.5 11.5L14 8l-3.5-3.5M14 8H6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>
      </>
    );
  };

  return (
    <div className="h-screen flex flex-col md:flex-row bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Skip to main content link */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[60] focus:px-4 focus:py-2 focus:bg-slate-800 focus:text-white focus:rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-green"
      >
        Skip to main content
      </a>

      {/* Mobile top bar */}
      <div className="md:hidden flex items-center justify-between px-4 py-2 bg-slate-800 dark:bg-brand-dark text-white">
        <div className="flex items-center gap-2">
          <button
            ref={hamburgerRef}
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="p-1.5 rounded hover:bg-slate-700"
            aria-label="Open navigation menu"
          >
            <MenuIcon />
          </button>
          <Link to="/app" className="flex items-center gap-2 font-semibold text-lg">
            <img src="/logo.png" alt="" className="w-6 h-6" aria-hidden="true" />
            TaskToad
          </Link>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowSearch(true)}
            className="p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
            aria-label="Quick search"
          >
            {searchIcon}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowNotifications((v) => !v);
              setShowNotifSettings(false);
              if (!showNotifications) setUnreadCount(0);
            }}
            className="relative p-1.5 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
            aria-label={notificationLabel}
          >
            <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
              <path d="M4 6a4 4 0 018 0c0 2 1 3 1.5 4H2.5C3 10 4 8 4 6z" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M6 11v1a2 2 0 004 0v-1" strokeLinecap="round" />
            </svg>
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center" aria-live="polite">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer backdrop + sidebar */}
      {drawerOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={closeDrawer}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            className="relative w-56 h-full bg-slate-800 dark:bg-brand-dark text-white flex flex-col shadow-2xl"
            role="dialog"
            aria-label="Navigation menu"
            onKeyDown={handleDrawerFocusTrap}
          >
            <button
              type="button"
              onClick={closeDrawer}
              className="absolute top-3 right-3 p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white"
              aria-label="Close navigation menu"
            >
              <svg className="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
              </svg>
            </button>
            {sidebarContent(true)}
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex flex-col bg-slate-800 dark:bg-brand-dark text-white relative transition-all duration-200 ${collapsed ? 'w-14' : 'w-56'}`}
      >
        {/* Collapse toggle button */}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 bg-slate-700 hover:bg-slate-600 text-white rounded-full flex items-center justify-center shadow-md border border-slate-600"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <ChevronLeftIcon className={`w-3.5 h-3.5 transition-transform duration-200 ${collapsed ? 'rotate-180' : ''}`} />
        </button>
        {sidebarContent(false)}
        {/* Notification overlays — positioned relative to sidebar */}
        {showNotifications && (
          <div className={`absolute bottom-14 ${collapsed ? 'left-14' : 'left-2'} z-50`}>
            <NotificationCenter onClose={() => setShowNotifications(false)} />
          </div>
        )}
        {showNotifSettings && (
          <Card padding="sm" className={`absolute bottom-full ${collapsed ? 'left-14' : 'left-0'} mb-2 w-80 shadow-lg z-50 dark:!bg-slate-800`}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Notification Preferences</h3>
              <button
                type="button"
                onClick={() => setShowNotifSettings(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 text-lg leading-none"
                aria-label="Close notification preferences"
              >
                &times;
              </button>
            </div>
            <NotificationSettings />
          </Card>
        )}
      </aside>

      {/* Mobile notification overlays */}
      {showNotifications && (
        <div className="fixed top-12 right-2 z-50 md:hidden">
          <NotificationCenter onClose={() => setShowNotifications(false)} />
        </div>
      )}

      <main id="main-content" className="flex-1 min-h-0 p-6 overflow-auto dark:text-slate-200">
        <Outlet />
      </main>
      {showSearch && <GlobalSearchModal onClose={() => setShowSearch(false)} />}
    </div>
  );
}
