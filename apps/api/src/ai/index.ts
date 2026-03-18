// Public API for the AI subsystem.
// All consumers should import from this barrel file.

export {
  generateProjectOptions,
  generateTaskPlan,
  expandTask,
  summarizeProject,
  planSprints,
  generateTaskInstructions,
  generateCode,
  regenerateFile,
  generateStandupReport,
  generateSprintReport,
  analyzeProjectHealth,
  extractTasksFromNotes,
  generateCommitMessage,
  enrichPRDescription,
  reviewCode,
  decomposeIssue,
  generateReviewFix,
  parseBugReport,
  breakdownPRD,
  analyzeSprintTransition,
  bootstrapFromRepo,
  projectChat,
  analyzeRepoDrift,
  planTaskActions,
  generateRepoProfile,
} from './aiService.js';

export { logUsageToDB, checkBudget, type BudgetStatus } from './aiUsageTracker.js';

export type { PromptLogContext } from './aiClient.js';

export type {
  ProjectOption,
  ToolSuggestion,
  ChildTaskPlan,
  TaskPlan,
  SprintPlan,
  TaskInstructions,
  CodeGeneration,
  GeneratedFile,
  StandupReport,
  SprintReport,
  HealthAnalysis,
  MeetingNotesExtraction,
  CodeReview,
  IssueDecomposition,
  ReviewFix,
  BugReportTask,
  PRDBreakdown,
  PRDEpic,
  PRDTask,
  SprintTransition,
  RepoBootstrap,
  ProjectChatResponse,
  DriftAnalysis,
  ActionPlanResponse,
  ActionPlanItem,
  AIFeature,
} from './aiTypes.js';
