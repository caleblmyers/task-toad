import { z } from 'zod';

/** Schema for JSON-encoded string arrays (columns, events, statuses). */
export const StringArraySchema = z.array(z.string());

/** Schema for automation trigger conditions. */
export const TriggerConditionSchema = z.object({
  event: z.string(),
  condition: z.record(z.string(), z.unknown()).optional(),
});

/** Schema for automation actions. */
export const ActionSchema = z.object({
  type: z.enum(['notify_assignee', 'move_to_column', 'set_status', 'assign_to']),
  column: z.string().optional(),
  status: z.string().optional(),
  userId: z.string().optional(),
});

/** Schema for PRD breakdown epics input. */
export const EpicsInputSchema = z.array(
  z.object({
    title: z.string(),
    description: z.string(),
    tasks: z.array(
      z.object({
        title: z.string(),
        description: z.string(),
        priority: z.string(),
        estimatedHours: z.number().optional(),
        acceptanceCriteria: z.string().optional(),
      })
    ),
  })
);

export type TriggerCondition = z.infer<typeof TriggerConditionSchema>;
export type AutomationAction = z.infer<typeof ActionSchema>;
export type EpicsInput = z.infer<typeof EpicsInputSchema>;
