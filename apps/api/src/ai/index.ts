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
  generateStandupReport,
  generateSprintReport,
  analyzeProjectHealth,
  extractTasksFromNotes,
  generateCommitMessage,
  enrichPRDescription,
} from './aiService.js';

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
  AIFeature,
} from './aiTypes.js';
