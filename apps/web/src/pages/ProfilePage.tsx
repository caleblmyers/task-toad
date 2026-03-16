import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import { useAuth } from '../auth/context';
import UserAvatar from '../components/shared/UserAvatar';

interface ProfileData {
  displayName: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  email: string;
}

const TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Moscow',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Shanghai',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

const ME_PROFILE_QUERY = `query MeProfile {
  me { userId email displayName avatarUrl timezone }
}`;

export default function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [timezone, setTimezone] = useState('UTC');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    gql<{ me: ProfileData }>(ME_PROFILE_QUERY)
      .then(({ me }) => {
        setProfile(me);
        setDisplayName(me.displayName ?? '');
        setAvatarUrl(me.avatarUrl ?? '');
        setTimezone(me.timezone ?? 'UTC');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load profile'));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      const { updateProfile } = await gql<{ updateProfile: ProfileData }>(
        `mutation UpdateProfile($displayName: String, $avatarUrl: String, $timezone: String) {
          updateProfile(displayName: $displayName, avatarUrl: $avatarUrl, timezone: $timezone) {
            email displayName avatarUrl timezone
          }
        }`,
        {
          displayName: displayName.trim() || null,
          avatarUrl: avatarUrl.trim() || null,
          timezone,
        },
      );
      setProfile(updateProfile);
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (!profile) {
    return <div className="p-4 text-slate-500">{error ?? 'Loading...'}</div>;
  }

  return (
    <div className="max-w-lg space-y-8">
      <h1 className="text-2xl font-semibold text-slate-800">Profile</h1>

      <div className="bg-white rounded-lg border border-slate-200 p-6 space-y-6">
        <div className="flex items-center gap-4">
          <UserAvatar
            email={profile.email}
            avatarUrl={avatarUrl.trim() || null}
            displayName={displayName.trim() || null}
            size="lg"
          />
          <div>
            <p className="text-lg font-medium text-slate-800">{displayName || profile.email}</p>
            <p className="text-sm text-slate-500">{user?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-3 py-2 border border-slate-200 rounded bg-slate-50 text-slate-500 text-sm cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your name"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Avatar URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.jpg"
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            />
            {avatarUrl.trim() && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-slate-500">Preview:</span>
                <UserAvatar email={profile.email} avatarUrl={avatarUrl.trim()} size="md" />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
            >
              {TIMEZONES.map((tz) => (
                <option key={tz} value={tz}>
                  {tz}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">Profile updated.</p>}

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 bg-brand-green text-white rounded hover:bg-brand-green-hover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </form>
      </div>
    </div>
  );
}
