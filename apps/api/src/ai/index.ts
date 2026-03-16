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
} from './aiService.js';

export { logUsageToDB, checkBudget } from './aiUsageTracker.js';

export type {
  ProjectOption,
  ToolSuggestion,
  SubtaskPlan,
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
  AIFeature,
} from './aiTypes.js';
