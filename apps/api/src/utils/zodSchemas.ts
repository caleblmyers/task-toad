import { z } from 'zod';

/** Schema for JSON-encoded string arrays (columns, events, statuses). */
export const StringArraySchema = z.array(z.string());

/** Schema for a single compound condition entry. */
const CompoundConditionEntry = z.object({
  field: z.string(),
  op: z.enum(['eq', 'not_eq']),
  value: z.unknown(),
});

/** Schema for compound conditions with AND/OR support. */
const CompoundConditionSchema: z.ZodType<CompoundCondition> = z.object({
  operator: z.enum(['AND', 'OR']),
  conditions: z.lazy(() => z.array(z.union([CompoundConditionEntry, CompoundConditionSchema]))),
});

export interface CompoundCondition {
  operator: 'AND' | 'OR';
  conditions: Array<{ field: string; op: 'eq' | 'not_eq'; value: unknown } | CompoundCondition>;
}

/** Schema for automation trigger conditions — supports simple {key: value} or compound conditions. */
export const TriggerConditionSchema = z.object({
  event: z.string(),
  condition: z.union([
    z.record(z.string(), z.unknown()),
    CompoundConditionSchema,
  ]).optional(),
});

/** Schema for a single automation action. */
export const ActionSchema = z.object({
  type: z.enum([
    'notify_assignee', 'move_to_column', 'set_status', 'assign_to',
    'send_webhook', 'add_label', 'add_comment', 'set_due_date',
  ]),
  column: z.string().optional(),
  status: z.string().optional(),
  userId: z.string().optional(),
  url: z.string().url().optional(),
  labelId: z.string().optional(),
  content: z.string().optional(),
  daysFromNow: z.number().int().min(0).optional(),
});

/** Schema for multi-action — accepts a single action or an array of actions. */
export const MultiActionSchema = z.union([ActionSchema, z.array(ActionSchema)]);

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
export type CompoundConditionEntry = z.infer<typeof CompoundConditionEntry>;
export type EpicsInput = z.infer<typeof EpicsInputSchema>;
