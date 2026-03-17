import type { PrismaClient } from '@prisma/client';
import type { JobQueue, JobHandlerOptions } from './port.js';
import type { JobName, JobPayload } from './types.js';
import { tryAdvisoryLock, releaseAdvisoryLock } from '../../utils/advisoryLock.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('jobqueue');

interface RegisteredHandler<J extends JobName = JobName> {
  handler: (payload: JobPayload<J>) => Promise<void>;
  options: JobHandlerOptions;
}

interface ScheduledJob {
  id: string;
  intervalMs: number;
  jobName: JobName;
  payload: Record<string, unknown>;
  timer?: NodeJS.Timeout;
}

export class InProcessJobQueue implements JobQueue {
  private handlers = new Map<JobName, RegisteredHandler>();
  private scheduledJobs = new Map<string, ScheduledJob>();
  private timers = new Map<string, NodeJS.Timeout>();
  private inFlightCount = 0;
  private draining = false;
  private started = false;

  constructor(private prisma: PrismaClient) {}

  registerHandler<J extends JobName>(
    jobName: J,
    handler: (payload: JobPayload<J>) => Promise<void>,
    options: JobHandlerOptions = {},
  ): void {
    this.handlers.set(jobName, {
      handler: handler as (payload: JobPayload<JobName>) => Promise<void>,
      options,
    });
  }

  enqueue<J extends JobName>(jobName: J, payload: JobPayload<J>): void {
    if (this.draining) {
      log.warn({ jobName }, 'Job enqueued during shutdown — skipping');
      return;
    }
    setImmediate(() => {
      this.processJob(jobName, payload as Record<string, unknown>).catch((err) => {
        log.error({ err, jobName }, 'Enqueued job failed');
      });
    });
  }

  schedule(id: string, intervalMs: number, jobName: JobName, payload: Record<string, unknown> = {}): void {
    this.scheduledJobs.set(id, { id, intervalMs, jobName, payload });
  }

  start(): void {
    if (this.started) return;
    this.started = true;

    for (const [id, job] of this.scheduledJobs) {
      const timer = setInterval(() => {
        if (this.draining) return;
        this.processJob(job.jobName, job.payload).catch((err) => {
          log.error({ err, jobName: job.jobName }, 'Scheduled job failed');
        });
      }, job.intervalMs);
      this.timers.set(id, timer);
      job.timer = timer;
    }

    log.info({ jobCount: this.scheduledJobs.size }, 'Job queue started');
  }

  async shutdown(): Promise<void> {
    this.draining = true;

    // Clear all interval timers
    for (const [id, timer] of this.timers) {
      clearInterval(timer);
      this.timers.delete(id);
    }

    // Wait for in-flight jobs with timeout
    if (this.inFlightCount > 0) {
      log.info({ inFlight: this.inFlightCount }, 'Waiting for in-flight jobs to complete');
      const start = Date.now();
      while (this.inFlightCount > 0 && Date.now() - start < 5000) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.inFlightCount > 0) {
        log.warn({ inFlight: this.inFlightCount }, 'In-flight jobs did not complete within 5s timeout');
      }
    }

    log.info('Job queue shut down');
  }

  private async processJob(jobName: JobName, payload: Record<string, unknown>): Promise<void> {
    const registered = this.handlers.get(jobName);
    if (!registered) {
      log.warn({ jobName }, 'No handler registered for job');
      return;
    }

    const { handler, options } = registered;

    // Advisory lock guard
    if (options.advisoryLockId) {
      const acquired = await tryAdvisoryLock(this.prisma, options.advisoryLockId);
      if (!acquired) return; // another replica is handling it
      try {
        await this.executeWithRetry(jobName, handler, payload as JobPayload<JobName>, options);
      } finally {
        await releaseAdvisoryLock(this.prisma, options.advisoryLockId);
      }
    } else {
      await this.executeWithRetry(jobName, handler, payload as JobPayload<JobName>, options);
    }
  }

  private async executeWithRetry(
    jobName: JobName,
    handler: (payload: JobPayload<JobName>) => Promise<void>,
    payload: JobPayload<JobName>,
    options: JobHandlerOptions,
  ): Promise<void> {
    const maxRetries = options.maxRetries ?? 0;
    const retryDelays = options.retryDelays ?? [1000, 5000, 15000];

    this.inFlightCount++;
    try {
      await handler(payload);
    } catch (err) {
      log.error({ err, jobName }, 'Job handler failed');

      if (maxRetries > 0) {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          const delay = retryDelays[Math.min(attempt - 1, retryDelays.length - 1)];
          log.info({ jobName, attempt, delay }, 'Retrying job');
          await new Promise((r) => setTimeout(r, delay));
          try {
            await handler(payload);
            return; // success
          } catch (retryErr) {
            log.error({ err: retryErr, jobName, attempt }, 'Job retry failed');
          }
        }
      }
    } finally {
      this.inFlightCount--;
    }
  }
}
