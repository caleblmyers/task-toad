export type { JobQueue, JobHandlerOptions } from './port.js';
export type { JobName, JobPayload, JobPayloadMap } from './types.js';
export { InProcessJobQueue } from './inProcessAdapter.js';

import type { JobQueue } from './port.js';

let instance: JobQueue | null = null;

export function getJobQueue(): JobQueue {
  if (!instance) {
    throw new Error('JobQueue not initialized — call setJobQueue() first');
  }
  return instance;
}

export function setJobQueue(queue: JobQueue): void {
  instance = queue;
}
