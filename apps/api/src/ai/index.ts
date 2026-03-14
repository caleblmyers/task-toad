// Public API for the AI subsystem.
// All consumers should import from this barrel file.

export {
  generateProjectOptions,
  generateTaskPlan,
  expandTask,
  summarizeProject,
  planSprints,
  generateTaskInstructions,
  generateStandupReport,
  generateSprintReport,
  analyzeProjectHealth,
  extractTasksFromNotes,
} from './aiService.js';

export type {
  ProjectOption,
  ToolSuggestion,
  SubtaskPlan,
  TaskPlan,
  SprintPlan,
  TaskInstructions,
  StandupReport,
  SprintReport,
  HealthAnalysis,
  MeetingNotesExtraction,
  AIFeature,
} from './aiTypes.js';
