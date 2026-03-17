import type { ActionType, ActionExecutor } from './types.js';

const executors = new Map<ActionType, ActionExecutor>();

export function register(executor: ActionExecutor): void {
  executors.set(executor.type, executor);
}

export function get(type: ActionType): ActionExecutor | undefined {
  return executors.get(type);
}

export function has(type: ActionType): boolean {
  return executors.has(type);
}

export function availableTypes(): ActionType[] {
  return [...executors.keys()];
}
