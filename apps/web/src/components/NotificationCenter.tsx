import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { gql } from '../api/client';
import type { Notification } from '../types';

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const typeIcons: Record<string, string> = {
  assigned: '\u{1F464}',
  commented: '\u{1F4AC}',
  status_changed: '\u{1F504}',
  mentioned: '@',
};

interface NotificationCenterProps {
  onClose: () => void;
}

export default function NotificationCenter({ onClose }: NotificationCenterProps) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const navigate = useNavigate();
  const panelRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    loadNotifications();
  }, []);

  // Close on click outside
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const loadNotifications = async () => {
    try {
      const data = await gql<{ notifications: Notification[] }>(
        `query Notifications { notifications(limit: 30) { notificationId type title body linkUrl isRead createdAt } }`
      );
      setNotifications(data.notifications);
    } catch (e) {
      console.error('Failed to load notifications:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleClick = useCallback(async (notification: Notification) => {
    if (!notification.isRead) {
      try {
        await gql<{ markNotificationRead: Notification }>(
          `mutation MarkRead($notificationId: ID!) { markNotificationRead(notificationId: $notificationId) { notificationId isRead } }`,
          { notificationId: notification.notificationId }
        );
        setNotifications((prev) =>
          prev.map((n) => n.notificationId === notification.notificationId ? { ...n, isRead: true } : n)
        );
      } catch (e) {
        console.error('Failed to mark notification as read:', e);
      }
    }
    if (notification.linkUrl) {
      navigate(notification.linkUrl);
      onClose();
    }
  }, [navigate, onClose]);

  const handleMarkAllRead = async () => {
    try {
      await gql<{ markAllNotificationsRead: boolean }>(
        `mutation MarkAllRead { markAllNotificationsRead }`
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    } catch (e) {
      console.error('Failed to mark all notifications as read:', e);
    }
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (notifications.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = Math.min(focusedIndex + 1, notifications.length - 1);
      setFocusedIndex(next);
      itemRefs.current[next]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = Math.max(focusedIndex - 1, 0);
      setFocusedIndex(prev);
      itemRefs.current[prev]?.focus();
    } else if (e.key === 'Enter' && focusedIndex >= 0) {
      e.preventDefault();
      handleClick(notifications[focusedIndex]);
    }
  }, [focusedIndex, notifications, handleClick]);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  return (
    <div
      ref={panelRef}
      className="absolute bottom-14 left-2 w-80 max-h-[28rem] bg-white border border-slate-200 rounded-xl shadow-xl flex flex-col z-50 animate-fade-in"
      role="menu"
      aria-label="Notifications"
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100">
        <span className="text-sm font-semibold text-slate-800">Notifications</span>
        {unreadCount > 0 && (
          <button
            onClick={handleMarkAllRead}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Mark all read
          </button>
        )}
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <p className="text-xs text-slate-400 text-center py-6">Loading…</p>
        ) : notifications.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-6">No notifications</p>
        ) : (
          notifications.map((n, i) => (
            <button
              key={n.notificationId}
              ref={(el) => { itemRefs.current[i] = el; }}
              role="menuitem"
              onClick={() => handleClick(n)}
              onFocus={() => setFocusedIndex(i)}
              className={`w-full text-left px-3 py-2.5 border-b border-slate-50 hover:bg-slate-50 transition-colors focus:outline-none focus:bg-slate-100 ${
                !n.isRead ? 'bg-blue-50/50' : ''
              }`}
            >
              <div className="flex items-start gap-2">
                <span className="text-sm flex-shrink-0 mt-0.5" aria-hidden="true">{typeIcons[n.type] ?? '\u{1F514}'}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm leading-snug ${!n.isRead ? 'font-medium text-slate-800' : 'text-slate-600'}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-slate-400 mt-0.5 truncate">{n.body}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-0.5">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.isRead && (
                  <span className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1.5" aria-label="Unread" />
                )}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
