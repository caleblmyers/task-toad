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
  acceptanceCriteria: z.string().optional().default(''),
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

export const StandupReportSchema = z.object({
  completed: z.array(z.string()),
  inProgress: z.array(z.string()),
  blockers: z.array(z.string()),
  summary: z.string(),
});

export type StandupReport = z.infer<typeof StandupReportSchema>;

export const SprintReportSchema = z.object({
  summary: z.string(),
  completionRate: z.number(),
  highlights: z.array(z.string()),
  concerns: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type SprintReport = z.infer<typeof SprintReportSchema>;

export const HealthIssueSchema = z.object({
  title: z.string(),
  severity: z.string(),
  description: z.string(),
});

export const HealthAnalysisSchema = z.object({
  healthScore: z.number(),
  status: z.string(),
  issues: z.array(HealthIssueSchema),
  strengths: z.array(z.string()),
  actionItems: z.array(z.string()),
});

export type HealthAnalysis = z.infer<typeof HealthAnalysisSchema>;

export const ExtractedTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional().default(''),
  assigneeName: z.string().optional().default(''),
  priority: z.string().optional().default('medium'),
  status: z.string().optional().default('todo'),
});

export const MeetingNotesExtractionSchema = z.object({
  tasks: z.array(ExtractedTaskSchema),
  summary: z.string(),
});

export type MeetingNotesExtraction = z.infer<typeof MeetingNotesExtractionSchema>;

export const GeneratedFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  language: z.string().optional().default(''),
  description: z.string().optional().default(''),
});

export const CodeGenerationSchema = z.object({
  files: z.array(GeneratedFileSchema),
  summary: z.string(),
  estimatedTokensUsed: z.number().optional().default(0),
});

export type GeneratedFile = z.infer<typeof GeneratedFileSchema>;
export type CodeGeneration = z.infer<typeof CodeGenerationSchema>;

// ---------------------------------------------------------------------------
// AI subsystem internal types
// ---------------------------------------------------------------------------

export type AIFeature =
  | 'generateProjectOptions'
  | 'generateTaskPlan'
  | 'expandTask'
  | 'summarizeProject'
  | 'planSprints'
  | 'generateTaskInstructions'
  | 'generateStandupReport'
  | 'generateSprintReport'
  | 'analyzeProjectHealth'
  | 'extractTasksFromNotes'
  | 'generateCode'
  | 'generateCommitMessage'
  | 'enrichPRDescription'
  | 'regenerateFile';

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}
