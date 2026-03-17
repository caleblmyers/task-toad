/**
 * Job names and typed payload map for the job queue.
 */

export interface JobPayloadMap {
  'due-date-reminders': Record<string, never>;
  'prompt-cleanup': Record<string, never>;
  'webhook-retry': Record<string, never>;
  'recurrence-scheduler': Record<string, never>;
  'prisma-metrics': Record<string, never>;
  'action-execute': { planId: string; actionId: string; orgId: string; userId: string };
}

export type JobName = keyof JobPayloadMap;
export type JobPayload<J extends JobName> = JobPayloadMap[J];
