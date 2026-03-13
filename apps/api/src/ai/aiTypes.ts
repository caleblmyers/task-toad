import { z } from 'zod';

// ---------------------------------------------------------------------------
// Zod schemas for AI response validation
// ---------------------------------------------------------------------------

export const ProjectOptionSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const ToolSuggestionSchema = z.object({
  name: z.string(),
  category: z.string(),
  reason: z.string(),
});

export const SubtaskPlanSchema = z.object({
  title: z.string(),
  description: z.string(),
});

export const TaskPlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  instructions: z.string().optional().default(''),
  suggestedTools: z.array(ToolSuggestionSchema).optional().default([]),
  estimatedHours: z.number().optional().default(2),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  dependsOn: z.array(z.string()).optional().default([]),
  subtasks: z.array(SubtaskPlanSchema).optional().default([]),
});

export const SprintPlanSchema = z.object({
  name: z.string(),
  taskIndices: z.array(z.number()),
  totalHours: z.number(),
});

export const TaskInstructionsSchema = z.object({
  instructions: z.string(),
  suggestedTools: z.array(ToolSuggestionSchema).optional().default([]),
  estimatedHours: z.number().optional().default(2),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  dependsOn: z.array(z.string()).optional().default([]),
  subtasks: z.array(SubtaskPlanSchema).optional().default([]),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ProjectOption = z.infer<typeof ProjectOptionSchema>;
export type ToolSuggestion = z.infer<typeof ToolSuggestionSchema>;
export type SubtaskPlan = z.infer<typeof SubtaskPlanSchema>;
export type TaskPlan = z.infer<typeof TaskPlanSchema>;
export type SprintPlan = z.infer<typeof SprintPlanSchema>;
export type TaskInstructions = z.infer<typeof TaskInstructionsSchema>;

// ---------------------------------------------------------------------------
// AI subsystem internal types
// ---------------------------------------------------------------------------

export type AIFeature =
  | 'generateProjectOptions'
  | 'generateTaskPlan'
  | 'expandTask'
  | 'summarizeProject'
  | 'planSprints'
  | 'generateTaskInstructions';

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}
