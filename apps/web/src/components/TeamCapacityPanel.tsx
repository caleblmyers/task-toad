import { useState, useEffect } from 'react';
import { gql } from '../api/client';
import type { UserCapacity, UserTimeOff, OrgUser } from '../types';
import {
  USER_TIME_OFFS_QUERY,
  SET_USER_CAPACITY_MUTATION,
  ADD_TIME_OFF_MUTATION,
  REMOVE_TIME_OFF_MUTATION,
} from '../api/queries';
import Button from './shared/Button';

interface TeamCapacityPanelProps {
  orgUsers: OrgUser[];
}

export default function TeamCapacityPanel({ orgUsers }: TeamCapacityPanelProps) {
  const [capacities, setCapacities] = useState<UserCapacity[]>([]);
  const [timeOffs, setTimeOffs] = useState<UserTimeOff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Time off form state
  const [toUserId, setToUserId] = useState('');
  const [toStartDate, setToStartDate] = useState('');
  const [toEndDate, setToEndDate] = useState('');
  const [toDescription, setToDescription] = useState('');
  const [addingTimeOff, setAddingTimeOff] = useState(false);

  useEffect(() => {
    loadData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      // We need a projectId for teamCapacity, but this is org-level.
      // Load time offs for all org users instead.
      const data = await gql<{ userTimeOffs: UserTimeOff[] }>(USER_TIME_OFFS_QUERY, {});
      setTimeOffs(data.userTimeOffs);

      // Build capacity list from org users with defaults
      // We'll show all org users with editable capacity
      setCapacities(orgUsers.map((u) => ({
        userCapacityId: '',
        userId: u.userId,
        userEmail: u.email,
        hoursPerWeek: 40,
        createdAt: new Date().toISOString(),
      })));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSetCapacity(userId: string, hoursPerWeek: number) {
    if (hoursPerWeek < 1 || hoursPerWeek > 168) return;
    try {
      const data = await gql<{ setUserCapacity: UserCapacity }>(
        SET_USER_CAPACITY_MUTATION,
        { userId, hoursPerWeek },
      );
      setCapacities((prev) =>
        prev.map((c) => (c.userId === userId ? data.setUserCapacity : c)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update capacity');
    }
  }

  async function handleAddTimeOff(e: React.FormEvent) {
    e.preventDefault();
    if (!toUserId || !toStartDate || !toEndDate) return;
    setAddingTimeOff(true);
    try {
      const data = await gql<{ addTimeOff: UserTimeOff }>(
        ADD_TIME_OFF_MUTATION,
        { userId: toUserId, startDate: toStartDate, endDate: toEndDate, description: toDescription || undefined },
      );
      setTimeOffs((prev) => [...prev, data.addTimeOff]);
      setToStartDate('');
      setToEndDate('');
      setToDescription('');
    } catch (e2) {
      setError(e2 instanceof Error ? e2.message : 'Failed to add time off');
    } finally {
      setAddingTimeOff(false);
    }
  }

  async function handleRemoveTimeOff(userTimeOffId: string) {
    try {
      await gql<{ removeTimeOff: boolean }>(REMOVE_TIME_OFF_MUTATION, { userTimeOffId });
      setTimeOffs((prev) => prev.filter((to) => to.userTimeOffId !== userTimeOffId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove time off');
    }
  }

  if (loading) {
    return <p className="text-sm text-slate-400 py-4">Loading capacity data…</p>;
  }

  const totalHoursPerWeek = capacities.reduce((sum, c) => sum + c.hoursPerWeek, 0);

  return (
    <div className="space-y-6">
      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 border border-red-100 dark:border-red-800 rounded px-3 py-2">
          {error}
        </div>
      )}

      {/* Summary */}
      <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg px-4 py-3">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium">{capacities.length}</span> team member{capacities.length !== 1 ? 's' : ''} ·{' '}
          <span className="font-medium">{totalHoursPerWeek}</span> hours/week total capacity
        </p>
      </div>

      {/* Member capacity list */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Weekly Hours</h3>
        <div className="space-y-2">
          {capacities.map((cap) => (
            <div
              key={cap.userId}
              className="flex items-center gap-3 py-2 px-3 rounded border border-slate-200 dark:border-slate-600"
            >
              <span className="text-sm text-slate-700 dark:text-slate-300 flex-1 truncate">
                {cap.userEmail}
              </span>
              <input
                type="number"
                min={1}
                max={168}
                value={cap.hoursPerWeek}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setCapacities((prev) =>
                    prev.map((c) => (c.userId === cap.userId ? { ...c, hoursPerWeek: val } : c)),
                  );
                }}
                onBlur={(e) => handleSetCapacity(cap.userId, Number(e.target.value))}
                className="w-16 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1 text-sm text-right focus:outline-none focus:ring-1 focus:ring-brand-green"
              />
              <span className="text-xs text-slate-400 w-12">h/week</span>
            </div>
          ))}
        </div>
      </div>

      {/* Time Off section */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">Time Off</h3>

        {timeOffs.length > 0 && (
          <div className="space-y-2 mb-4">
            {timeOffs.map((to) => (
              <div
                key={to.userTimeOffId}
                className="flex items-center gap-3 py-2 px-3 rounded border border-slate-200 dark:border-slate-600 text-sm"
              >
                <span className="text-slate-600 dark:text-slate-300 truncate flex-1">
                  {to.userEmail}
                </span>
                <span className="text-slate-500 dark:text-slate-400 text-xs">
                  {to.startDate} → {to.endDate}
                </span>
                {to.description && (
                  <span className="text-slate-400 text-xs truncate max-w-[120px]" title={to.description}>
                    {to.description}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleRemoveTimeOff(to.userTimeOffId)}
                  className="text-red-400 hover:text-red-600 text-xs flex-shrink-0"
                  title="Remove"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add time off form */}
        <form onSubmit={handleAddTimeOff} className="flex flex-wrap items-end gap-2">
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Member</label>
            <select
              value={toUserId}
              onChange={(e) => setToUserId(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
            >
              <option value="">Select…</option>
              {orgUsers.map((u) => (
                <option key={u.userId} value={u.userId}>{u.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Start</label>
            <input
              type="date"
              value={toStartDate}
              onChange={(e) => setToStartDate(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">End</label>
            <input
              type="date"
              value={toEndDate}
              onChange={(e) => setToEndDate(e.target.value)}
              className="border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-500 dark:text-slate-400 mb-1">Note</label>
            <input
              type="text"
              value={toDescription}
              onChange={(e) => setToDescription(e.target.value)}
              placeholder="Optional"
              className="w-32 border border-slate-300 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand-green"
            />
          </div>
          <Button type="submit" size="sm" disabled={addingTimeOff || !toUserId || !toStartDate || !toEndDate}>
            {addingTimeOff ? 'Adding…' : '+ Add'}
          </Button>
        </form>
      </div>
    </div>
  );
}
