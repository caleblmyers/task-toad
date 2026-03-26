import { register } from './registry.js';
import { generateCodeExecutor } from './executors/generateCode.js';
import { createPRExecutor } from './executors/createPR.js';
import { reviewPRExecutor } from './executors/reviewPR.js';
import { writeDocsExecutor } from './executors/writeDocs.js';
import { manualStepExecutor } from './executors/manualStep.js';
import { monitorCIExecutor } from './executors/monitorCI.js';
import { fixCIExecutor } from './executors/fixCI.js';
import { fixReviewExecutor } from './executors/fixReview.js';

export function registerExecutors(): void {
  register(generateCodeExecutor);
  register(createPRExecutor);
  register(reviewPRExecutor);
  register(writeDocsExecutor);
  register(manualStepExecutor);
  register(monitorCIExecutor);
  register(fixCIExecutor);
  register(fixReviewExecutor);
}

export { get as getExecutor, availableTypes } from './registry.js';
export type { ActionType, ActionExecutor, ActionContext, ActionResult } from './types.js';
