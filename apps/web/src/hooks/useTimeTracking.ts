import { useState, useCallback } from 'react';
import { gql } from '../api/client';
import {
  TASK_TIME_SUMMARY_QUERY,
  LOG_TIME_MUTATION,
  DELETE_TIME_ENTRY_MUTATION,
} from '../api/queries';
import type { TimeEntry, TaskTimeSummary } from '@tasktoad/shared-types';

export function useTimeTracking() {
  const [timeSummary, setTimeSummary] = useState<TaskTimeSummary | null>(null);
  const [loadingTime, setLoadingTime] = useState(false);

  const loadTimeSummary = useCallback(async (taskId: string) => {
    setLoadingTime(true);
    try {
      const data = await gql<{ taskTimeSummary: TaskTimeSummary }>(
        TASK_TIME_SUMMARY_QUERY,
        { taskId },
      );
      setTimeSummary(data.taskTimeSummary);
    } catch {
      // Silently fail — time tracking is non-critical
    } finally {
      setLoadingTime(false);
    }
  }, []);

  const logTime = useCallback(async (
    taskId: string,
    durationMinutes: number,
    loggedDate: string,
    description?: string,
    billable?: boolean,
  ) => {
    const data = await gql<{ logTime: TimeEntry }>(
      LOG_TIME_MUTATION,
      { taskId, durationMinutes, loggedDate, description, billable },
    );
    // Refresh summary
    await loadTimeSummary(taskId);
    return data.logTime;
  }, [loadTimeSummary]);

  const deleteTimeEntry = useCallback(async (timeEntryId: string, taskId: string) => {
    await gql<{ deleteTimeEntry: boolean }>(
      DELETE_TIME_ENTRY_MUTATION,
      { timeEntryId },
    );
    await loadTimeSummary(taskId);
  }, [loadTimeSummary]);

  return {
    timeSummary,
    loadingTime,
    loadTimeSummary,
    logTime,
    deleteTimeEntry,
  };
}
