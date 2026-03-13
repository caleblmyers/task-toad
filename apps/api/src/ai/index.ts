// Public API for the AI subsystem.
// All consumers should import from this barrel file.

export {
  generateProjectOptions,
  generateTaskPlan,
  expandTask,
  summarizeProject,
  planSprints,
  generateTaskInstructions,
} from './aiService.js';

export type {
  ProjectOption,
  ToolSuggestion,
  SubtaskPlan,
  TaskPlan,
  SprintPlan,
  TaskInstructions,
  AIFeature,
} from './aiTypes.js';
