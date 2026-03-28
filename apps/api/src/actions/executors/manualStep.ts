import { z } from 'zod';
import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';

const ManualStepConfigSchema = z.object({
  description: z.string().optional(),
  checklist: z.array(z.string()).optional(),
}).passthrough();

export const manualStepExecutor: ActionExecutor = {
  type: 'manual_step',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    // Validate config shape
    ManualStepConfigSchema.parse(JSON.parse(ctx.action.config || '{}'));

    // Manual steps are no-ops — the user marks them complete via the UI
    return { success: true, data: {} };
  },
};
