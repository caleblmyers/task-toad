import type { PrismaClient } from '@prisma/client';
import { InProcessEventBus } from './eventbus/inProcessAdapter.js';
import { InProcessJobQueue } from './jobqueue/inProcessAdapter.js';
import { setEventBus } from './eventbus/index.js';
import { setJobQueue } from './jobqueue/index.js';
import { registerListeners } from './listeners/index.js';
import { registerJobs } from './jobs/index.js';
import { registerExecutors } from '../actions/index.js';
import { CronScheduler } from './jobs/cronScheduler.js';
import type { EventBus } from './eventbus/port.js';
import type { JobQueue } from './jobqueue/port.js';

export function createInfrastructure(prisma: PrismaClient): { eventBus: EventBus; jobQueue: JobQueue; cronScheduler: CronScheduler } {
  const eventBus = new InProcessEventBus();
  const jobQueue = new InProcessJobQueue(prisma);
  const cronScheduler = new CronScheduler(prisma);

  setEventBus(eventBus);
  setJobQueue(jobQueue);

  registerExecutors();
  registerListeners(eventBus, prisma);
  registerJobs(jobQueue, prisma);

  return { eventBus, jobQueue, cronScheduler };
}
