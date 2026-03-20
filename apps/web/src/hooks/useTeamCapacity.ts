import { useState, useCallback } from 'react';
import { gql } from '../api/client';
import type { UserCapacity, UserTimeOff, TeamCapacitySummary } from '../types';
import {
  TEAM_CAPACITY_QUERY,
  TEAM_CAPACITY_SUMMARY_QUERY,
  USER_TIME_OFFS_QUERY,
  SET_USER_CAPACITY_MUTATION,
  ADD_TIME_OFF_MUTATION,
  REMOVE_TIME_OFF_MUTATION,
} from '../api/queries';

export function useTeamCapacity(projectId: string) {
  const [capacities, setCapacities] = useState<UserCapacity[]>([]);
  const [summary, setSummary] = useState<TeamCapacitySummary | null>(null);
  const [timeOffs, setTimeOffs] = useState<UserTimeOff[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCapacities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ teamCapacity: UserCapacity[] }>(TEAM_CAPACITY_QUERY, { projectId });
      setCapacities(data.teamCapacity);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load capacity');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  const fetchSummary = useCallback(async (startDate: string, endDate: string) => {
    try {
      const data = await gql<{ teamCapacitySummary: TeamCapacitySummary }>(
        TEAM_CAPACITY_SUMMARY_QUERY,
        { projectId, startDate, endDate },
      );
      setSummary(data.teamCapacitySummary);
      return data.teamCapacitySummary;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load capacity summary');
      return null;
    }
  }, [projectId]);

  const fetchTimeOffs = useCallback(async (userId?: string) => {
    try {
      const data = await gql<{ userTimeOffs: UserTimeOff[] }>(USER_TIME_OFFS_QUERY, { userId });
      setTimeOffs(data.userTimeOffs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load time off');
    }
  }, []);

  const setCapacity = useCallback(async (userId: string, hoursPerWeek: number) => {
    const data = await gql<{ setUserCapacity: UserCapacity }>(
      SET_USER_CAPACITY_MUTATION,
      { userId, hoursPerWeek },
    );
    setCapacities((prev) =>
      prev.map((c) => (c.userId === userId ? data.setUserCapacity : c)),
    );
    return data.setUserCapacity;
  }, []);

  const addTimeOff = useCallback(async (
    userId: string,
    startDate: string,
    endDate: string,
    description?: string,
  ) => {
    const data = await gql<{ addTimeOff: UserTimeOff }>(
      ADD_TIME_OFF_MUTATION,
      { userId, startDate, endDate, description },
    );
    setTimeOffs((prev) => [...prev, data.addTimeOff]);
    return data.addTimeOff;
  }, []);

  const removeTimeOff = useCallback(async (userTimeOffId: string) => {
    await gql<{ removeTimeOff: boolean }>(REMOVE_TIME_OFF_MUTATION, { userTimeOffId });
    setTimeOffs((prev) => prev.filter((to) => to.userTimeOffId !== userTimeOffId));
  }, []);

  return {
    capacities,
    summary,
    timeOffs,
    loading,
    error,
    fetchCapacities,
    fetchSummary,
    fetchTimeOffs,
    setCapacity,
    addTimeOff,
    removeTimeOff,
  };
}
