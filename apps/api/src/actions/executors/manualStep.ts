import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';

export const manualStepExecutor: ActionExecutor = {
  type: 'manual_step',

  async execute(_ctx: ActionContext): Promise<ActionResult> {
    // Manual steps are no-ops — the user marks them complete via the UI
    return { success: true, data: {} };
  },
};
