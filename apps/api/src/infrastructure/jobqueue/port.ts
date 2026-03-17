import type { JobName, JobPayload } from './types.js';

export interface JobHandlerOptions {
  maxRetries?: number;
  retryDelays?: number[];
  advisoryLockId?: number;
}

/**
 * Port interface for the job queue.
 * Implementations can use in-process timers, BullMQ, etc.
 */
export interface JobQueue {
  /** Register a handler for a named job. */
  registerHandler<J extends JobName>(
    jobName: J,
    handler: (payload: JobPayload<J>) => Promise<void>,
    options?: JobHandlerOptions,
  ): void;

  /** Enqueue a job for immediate processing. */
  enqueue<J extends JobName>(jobName: J, payload: JobPayload<J>): void;

  /** Schedule a recurring job at a fixed interval. */
  schedule(id: string, intervalMs: number, jobName: JobName, payload?: Record<string, unknown>): void;

  /** Start processing scheduled jobs. */
  start(): void;

  /** Gracefully shut down — clear intervals, wait for in-flight jobs. */
  shutdown(): Promise<void>;
}
