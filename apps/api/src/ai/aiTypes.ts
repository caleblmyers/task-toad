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

export const CodeReviewCommentSchema = z.object({
  file: z.string().describe('file path'),
  line: z.number().optional().describe('line number if applicable'),
  severity: z.enum(['info', 'warning', 'error']).describe('severity level'),
  comment: z.string().describe('review comment'),
});

export const CodeReviewSchema = z.object({
  summary: z.string().describe('overall review summary'),
  approved: z.boolean().describe('whether the changes look good overall'),
  comments: z.array(CodeReviewCommentSchema).describe('specific code comments'),
  suggestions: z.array(z.string()).optional().default([]).describe('general improvement suggestions'),
});

export type CodeReview = z.infer<typeof CodeReviewSchema>;

export const IssueDecompositionTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  estimatedHours: z.number().optional(),
  instructions: z.string().optional(),
  acceptanceCriteria: z.string().optional(),
});

export const IssueDecompositionSchema = z.object({
  tasks: z.array(IssueDecompositionTaskSchema),
});

export type IssueDecomposition = z.infer<typeof IssueDecompositionSchema>;

export const ReviewFixFileSchema = z.object({
  path: z.string(),
  content: z.string(),
  language: z.string(),
  description: z.string(),
});

export const ReviewFixSchema = z.object({
  files: z.array(ReviewFixFileSchema),
  commitMessage: z.string(),
});

export type ReviewFix = z.infer<typeof ReviewFixSchema>;

// ---------------------------------------------------------------------------
// AI subsystem internal types
// ---------------------------------------------------------------------------

export const BugReportTaskSchema = z.object({
  title: z.string(),
  description: z.string().describe('structured: steps to reproduce, expected, actual'),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  suggestedTools: z.array(ToolSuggestionSchema).optional().default([]),
  acceptanceCriteria: z.string().optional(),
});

export type BugReportTask = z.infer<typeof BugReportTaskSchema>;

export const PRDTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  priority: z.enum(['low', 'medium', 'high', 'critical']),
  estimatedHours: z.number().optional(),
  acceptanceCriteria: z.string().optional(),
});

export const PRDEpicSchema = z.object({
  title: z.string(),
  description: z.string(),
  tasks: z.array(PRDTaskSchema),
});

export const PRDBreakdownSchema = z.object({
  epics: z.array(PRDEpicSchema),
});

export type PRDTask = z.infer<typeof PRDTaskSchema>;
export type PRDEpic = z.infer<typeof PRDEpicSchema>;
export type PRDBreakdown = z.infer<typeof PRDBreakdownSchema>;

export const SprintTransitionTaskSchema = z.object({
  taskId: z.string(),
  reason: z.string(),
});

export const SprintTransitionSchema = z.object({
  summary: z.string(),
  carryOver: z.array(SprintTransitionTaskSchema),
  deprioritize: z.array(SprintTransitionTaskSchema),
  recommendations: z.array(z.string()),
});

export type SprintTransition = z.infer<typeof SprintTransitionSchema>;

export const RepoBootstrapSchema = z.object({
  projectDescription: z.string(),
  tasks: z.array(z.object({
    title: z.string(),
    description: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    estimatedHours: z.number().optional(),
    taskType: z.enum(['epic', 'story', 'task']).optional().default('task'),
  })),
});

export type RepoBootstrap = z.infer<typeof RepoBootstrapSchema>;

export const TrendAnalysisSchema = z.object({
  period: z.string(),
  completionTrend: z.string(),
  velocityTrend: z.string(),
  healthTrend: z.string(),
  insights: z.array(z.string()),
  recommendations: z.array(z.string()),
});

export type TrendAnalysis = z.infer<typeof TrendAnalysisSchema>;

export type AIFeature =
  | 'analyzeTrends'
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
  | 'regenerateFile'
  | 'reviewCode'
  | 'decomposeIssue'
  | 'generateReviewFix'
  | 'parseBugReport'
  | 'breakdownPRD'
  | 'analyzeSprintTransition'
  | 'bootstrapFromRepo'
  | 'projectChat'
  | 'analyzeRepoDrift'
  | 'batchGenerateCode';

export const ProjectChatResponseSchema = z.object({
  answer: z.string(),
  references: z.array(z.object({
    type: z.enum(['task', 'sprint', 'activity']),
    id: z.string(),
    title: z.string(),
  })).optional().default([]),
});

export type ProjectChatResponse = z.infer<typeof ProjectChatResponseSchema>;

export const DriftAnalysisSchema = z.object({
  summary: z.string(),
  outdatedTasks: z.array(z.object({ taskId: z.string(), title: z.string(), reason: z.string() })),
  untrackedWork: z.array(z.object({ description: z.string(), suggestedTaskTitle: z.string() })),
  completedButOpen: z.array(z.object({ taskId: z.string(), title: z.string(), evidence: z.string() })),
});

export type DriftAnalysis = z.infer<typeof DriftAnalysisSchema>;

export const BatchCodeGenerationSchema = z.object({
  files: z.array(GeneratedFileSchema),
  summary: z.string(),
  estimatedTokensUsed: z.number().optional().default(0),
});

export type BatchCodeGeneration = z.infer<typeof BatchCodeGenerationSchema>;

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}
