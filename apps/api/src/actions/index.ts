import { register } from './registry.js';
import { generateCodeExecutor } from './executors/generateCode.js';
import { createPRExecutor } from './executors/createPR.js';
import { reviewPRExecutor } from './executors/reviewPR.js';
import { writeDocsExecutor } from './executors/writeDocs.js';
import { manualStepExecutor } from './executors/manualStep.js';

export function registerExecutors(): void {
  register(generateCodeExecutor);
  register(createPRExecutor);
  register(reviewPRExecutor);
  register(writeDocsExecutor);
  register(manualStepExecutor);
}

export { get as getExecutor, has as hasExecutor, availableTypes } from './registry.js';
export type { ActionType, ActionExecutor, ActionContext, ActionResult } from './types.js';
