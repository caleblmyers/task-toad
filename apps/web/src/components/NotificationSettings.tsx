import { useState, useEffect, useCallback } from 'react';
import { gql } from '../api/client';

interface NotificationPref {
  id: string;
  notificationType: string;
  inApp: boolean;
  email: boolean;
}

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  assigned: 'Assigned to task',
  status_changed: 'Task status changed',
  commented: 'New comment',
  mentioned: 'Mentioned',
  due_date_reminder: 'Due date reminder',
  sprint_event: 'Sprint event',
};

export default function NotificationSettings() {
  const [prefs, setPrefs] = useState<NotificationPref[]>([]);
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchPrefs = useCallback(async () => {
    try {
      const data = await gql<{ notificationPreferences: NotificationPref[] }>(
        `query NotificationPrefs { notificationPreferences { id notificationType inApp email } }`
      );
      setPrefs(data.notificationPreferences);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPrefs(); }, [fetchPrefs]);

  const updatePref = async (type: string, field: 'inApp' | 'email', value: boolean) => {
    setPrefs(prev => prev.map(p => p.notificationType === type ? { ...p, [field]: value } : p));
    try {
      await gql<{ updateNotificationPreference: NotificationPref }>(
        `mutation UpdatePref($type: String!, $inApp: Boolean, $email: Boolean) {
          updateNotificationPreference(notificationType: $type, inApp: $inApp, email: $email) {
            id notificationType inApp email
          }
        }`,
        { type, [field]: value }
      );
    } catch {
      fetchPrefs(); // revert on error
    }
  };

  if (loading) {
    return <div className="text-sm text-slate-500">Loading preferences...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200">
        <div>
          <p className="font-medium text-sm">Email Notifications</p>
          <p className="text-xs text-slate-500">Enable to receive email notifications</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={emailEnabled}
          aria-label="Enable email notifications"
          onClick={() => setEmailEnabled(v => !v)}
          className={`relative w-10 h-5 rounded-full transition-colors ${emailEnabled ? 'bg-green-500' : 'bg-slate-300'}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full transition-transform ${emailEnabled ? 'translate-x-5' : ''}`}
          />
        </button>
      </div>

      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-slate-500 border-b border-slate-200">
            <th className="pb-2 font-medium">Notification Type</th>
            <th className="pb-2 font-medium text-center w-20">In-App</th>
            <th className="pb-2 font-medium text-center w-20">Email</th>
          </tr>
        </thead>
        <tbody>
          {prefs.map(pref => (
            <tr key={pref.notificationType} className="border-b border-slate-100">
              <td className="py-2.5">{NOTIFICATION_TYPE_LABELS[pref.notificationType] ?? pref.notificationType}</td>
              <td className="py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={pref.inApp}
                  onChange={e => updatePref(pref.notificationType, 'inApp', e.target.checked)}
                  aria-label={`${pref.notificationType} in-app notifications`}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
              </td>
              <td className="py-2.5 text-center">
                <input
                  type="checkbox"
                  checked={pref.email}
                  disabled={!emailEnabled}
                  onChange={e => updatePref(pref.notificationType, 'email', e.target.checked)}
                  aria-label={`${pref.notificationType} email notifications`}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 disabled:opacity-40"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
