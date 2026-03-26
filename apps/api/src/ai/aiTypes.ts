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

export const ChildTaskPlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  instructions: z.string().optional().default(''),
  estimatedHours: z.number().optional().default(2),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  acceptanceCriteria: z.string().optional().default(''),
  suggestedTools: z.array(ToolSuggestionSchema).optional().default([]),
});

export const TaskPlanSchema = z.object({
  title: z.string(),
  description: z.string(),
  instructions: z.string().optional().default(''),
  suggestedTools: z.array(ToolSuggestionSchema).optional().default([]),
  estimatedHours: z.number().optional().default(2),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  dependsOn: z.array(z.string()).optional().default([]),
  tasks: z.array(ChildTaskPlanSchema).optional().default([]),
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
  tasks: z.array(ChildTaskPlanSchema).optional().default([]),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ProjectOption = z.infer<typeof ProjectOptionSchema>;
export type ToolSuggestion = z.infer<typeof ToolSuggestionSchema>;
export type ChildTaskPlan = z.infer<typeof ChildTaskPlanSchema>;
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
  delegationHint: z.string().optional(),
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
  repoProfile: z.string().optional().default(''),
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

export const HierarchicalSubtaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedHours: z.number().optional().default(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  acceptanceCriteria: z.string().optional().default(''),
});

export const HierarchicalTaskSchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedHours: z.number().optional().default(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  acceptanceCriteria: z.string().optional().default(''),
  instructions: z.string().optional().default(''),
  autoComplete: z.boolean().optional().default(false),
  dependsOn: z.array(z.object({ title: z.string(), linkType: z.enum(['blocks', 'informs']) })).optional().default([]),
  subtasks: z.array(HierarchicalSubtaskSchema).optional().default([]),
});

export const HierarchicalEpicSchema = z.object({
  title: z.string(),
  description: z.string(),
  estimatedHours: z.number().optional().default(1),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  acceptanceCriteria: z.string().optional().default(''),
  instructions: z.string().optional().default(''),
  autoComplete: z.boolean().optional().default(false),
  dependsOn: z.array(z.object({ title: z.string(), linkType: z.enum(['blocks', 'informs']) })).optional().default([]),
  tasks: z.array(HierarchicalTaskSchema).optional().default([]),
});

export const HierarchicalPlanResponseSchema = z.object({
  epics: z.array(HierarchicalEpicSchema).min(1).max(10),
});

export type HierarchicalSubtask = z.infer<typeof HierarchicalSubtaskSchema>;
export type HierarchicalTask = z.infer<typeof HierarchicalTaskSchema>;
export type HierarchicalEpic = z.infer<typeof HierarchicalEpicSchema>;
export type HierarchicalPlanResponse = z.infer<typeof HierarchicalPlanResponseSchema>;

export const TaskInsightItemSchema = z.object({
  targetTaskTitle: z.string().optional(),
  type: z.enum(['discovery', 'warning', 'pattern']),
  content: z.string(),
});

export const TaskInsightsResponseSchema = z.object({
  insights: z.array(TaskInsightItemSchema).max(10),
});

export type TaskInsightItem = z.infer<typeof TaskInsightItemSchema>;
export type TaskInsightsResponse = z.infer<typeof TaskInsightsResponseSchema>;

export const ActionPlanItemSchema = z.object({
  actionType: z.enum(['generate_code', 'create_pr', 'review_pr', 'write_docs', 'manual_step', 'monitor_ci', 'fix_ci', 'fix_review']),
  label: z.string(),
  config: z.record(z.string(), z.unknown()),
  requiresApproval: z.boolean(),
  reasoning: z.string(),
});

export const ActionPlanResponseSchema = z.object({
  actions: z.array(ActionPlanItemSchema),
  summary: z.string(),
});

export type ActionPlanItem = z.infer<typeof ActionPlanItemSchema>;
export type ActionPlanResponse = z.infer<typeof ActionPlanResponseSchema>;

export const ReleaseNotesSchema = z.object({
  summary: z.string(),
  features: z.array(z.string()),
  bugFixes: z.array(z.string()),
  improvements: z.array(z.string()),
  breakingChanges: z.array(z.string()),
});

export type ReleaseNotes = z.infer<typeof ReleaseNotesSchema>;

export const StackConfigSchema = z.object({
  framework: z.string(),
  language: z.string(),
  packages: z.array(z.string()),
  projectType: z.enum(['full-stack', 'api-only', 'frontend-only']),
});

export const StackOptionSchema = z.object({
  label: z.string(),
  description: z.string(),
  rationale: z.string(),
  config: StackConfigSchema,
});

export const StackRecommendationSchema = z.object({
  recommended: StackOptionSchema,
  alternatives: z.array(StackOptionSchema),
});

export type StackConfig = z.infer<typeof StackConfigSchema>;
export type StackOption = z.infer<typeof StackOptionSchema>;
export type StackRecommendation = z.infer<typeof StackRecommendationSchema>;

export type AIFeature =
  | 'generateReleaseNotes'
  | 'planTaskActions'
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
  | 'batchGenerateCode'
  | 'knowledgeRetrieval'
  | 'onboardingQuestion'
  | 'generateHierarchicalPlan'
  | 'generateTaskInsights'
  | 'generateManualTaskSpec'
  | 'scaffoldProject'
  | 'recommendStack'
  | 'generateCompletionSummary';

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

export const KnowledgeRetrievalResponseSchema = z.object({
  selectedEntryIds: z.array(z.string()),
});

export type KnowledgeRetrievalResponse = z.infer<typeof KnowledgeRetrievalResponseSchema>;

export const OnboardingQuestionSchema = z.object({
  question: z.string(),
  context: z.string(),
  category: z.enum(['standard', 'pattern', 'business', 'integration']),
});

export const OnboardingQuestionsResponseSchema = z.object({
  questions: z.array(OnboardingQuestionSchema).min(3).max(6),
});

export type OnboardingQuestion = z.infer<typeof OnboardingQuestionSchema>;
export type OnboardingQuestionsResponse = z.infer<typeof OnboardingQuestionsResponseSchema>;

export const ManualTaskSpecFileSchema = z.object({
  path: z.string(),
  action: z.enum(['create', 'modify', 'delete']),
  description: z.string(),
});

export const ManualTaskSpecSchema = z.object({
  filesToChange: z.array(ManualTaskSpecFileSchema).max(10),
  approach: z.array(z.string()).min(1).max(8),
  codeSnippets: z.array(z.object({
    file: z.string(),
    language: z.string(),
    code: z.string(),
    explanation: z.string(),
  })).max(5),
  testingNotes: z.string(),
  dependencies: z.array(z.string()).optional().default([]),
});

export type ManualTaskSpecFile = z.infer<typeof ManualTaskSpecFileSchema>;
export type ManualTaskSpec = z.infer<typeof ManualTaskSpecSchema>;

export const TaskCompletionSummarySchema = z.object({
  whatWasBuilt: z.string(),
  filesChanged: z.array(z.string()),
  apiContracts: z.array(z.object({
    endpoint: z.string(),
    method: z.string(),
    description: z.string(),
  })).optional().default([]),
  keyDecisions: z.array(z.string()).optional().default([]),
  gotchas: z.array(z.string()).optional().default([]),
  dependencyInfo: z.string().optional(),
});

export type TaskCompletionSummary = z.infer<typeof TaskCompletionSummarySchema>;

export interface AIUsage {
  inputTokens: number;
  outputTokens: number;
  stopReason: string;
}
