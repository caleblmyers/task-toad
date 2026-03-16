import { z } from 'zod';
import { GraphQLError } from 'graphql';
import type { AIFeature } from './aiTypes.js';
import { createChildLogger } from '../utils/logger.js';

const log = createChildLogger('ai');
import {
  ProjectOptionSchema,
  TaskPlanSchema,
  SprintPlanSchema,
  TaskInstructionsSchema,
  StandupReportSchema,
  SprintReportSchema,
  HealthAnalysisSchema,
  MeetingNotesExtractionSchema,
  CodeGenerationSchema,
  GeneratedFileSchema,
} from './aiTypes.js';
import type { ProjectOption, TaskPlan, SprintPlan, TaskInstructions, StandupReport, SprintReport, HealthAnalysis, MeetingNotesExtraction, CodeGeneration, GeneratedFile } from './aiTypes.js';
import { FEATURE_CONFIG } from './aiConfig.js';
import { callAI } from './aiClient.js';
import { parseJSON } from './responseParser.js';
import {
  buildProjectOptionsPrompt,
  buildTaskPlanPrompt,
  buildExpandTaskPrompt,
  buildSummarizeProjectPrompt,
  buildPlanSprintsPrompt,
  buildGenerateTaskInstructionsPrompt,
  buildGenerateCodePrompt,
  buildRegenerateFilePrompt,
  buildStandupPrompt,
  buildSprintReportPrompt,
  buildHealthAnalysisPrompt,
  buildMeetingNotesPrompt,
  buildCommitMessagePrompt,
  buildEnrichPRDescriptionPrompt,
} from './promptBuilder.js';

// ---------------------------------------------------------------------------
// Retry-on-validation-failure helper
// ---------------------------------------------------------------------------

async function callAndParse<T>(
  apiKey: string,
  feature: AIFeature,
  prompt: { systemPrompt: string; userPrompt: string },
  schema: z.ZodType<T>
): Promise<T> {
  const config = FEATURE_CONFIG[feature];
  const result = await callAI({
    apiKey,
    systemPrompt: prompt.systemPrompt,
    userPrompt: prompt.userPrompt,
    maxTokens: config.maxTokens,
    feature,
    cacheTTLMs: config.cacheTTLMs,
  });

  try {
    return parseJSON(result.raw, schema);
  } catch (err) {
    if (config.retryOnValidationFailure && !result.cached) {
      log.warn({ feature }, 'Validation failed, retrying once');
      const retry = await callAI({
        apiKey,
        systemPrompt: prompt.systemPrompt,
        userPrompt: prompt.userPrompt,
        maxTokens: config.maxTokens,
        feature,
        cacheTTLMs: 0, // skip cache on retry
      });
      return parseJSON(retry.raw, schema);
    }
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Feature functions — maintain exact signatures for schema.ts compatibility
// ---------------------------------------------------------------------------

export async function generateProjectOptions(
  apiKey: string,
  prompt: string
): Promise<ProjectOption[]> {
  const p = buildProjectOptionsPrompt(prompt);
  const options = await callAndParse(apiKey, 'generateProjectOptions', p, z.array(ProjectOptionSchema));
  if (options.length === 0) {
    throw new GraphQLError('Failed to parse AI response');
  }
  return options.slice(0, 3);
}

export async function generateTaskPlan(
  apiKey: string,
  projectTitle: string,
  projectDescription: string,
  projectPrompt: string,
  context?: string | null,
  knowledgeBase?: string | null
): Promise<TaskPlan[]> {
  const p = buildTaskPlanPrompt(projectTitle, projectDescription, projectPrompt, context, knowledgeBase);
  const tasks = await callAndParse(apiKey, 'generateTaskPlan', p, z.array(TaskPlanSchema));
  if (tasks.length === 0) {
    throw new GraphQLError('Failed to parse AI response');
  }
  return tasks;
}

export async function expandTask(
  apiKey: string,
  taskTitle: string,
  taskDescription: string,
  projectName: string,
  context?: string | null,
  knowledgeBase?: string | null
): Promise<TaskPlan[]> {
  const p = buildExpandTaskPrompt(taskTitle, taskDescription, projectName, context, knowledgeBase);
  const subtasks = await callAndParse(apiKey, 'expandTask', p, z.array(TaskPlanSchema));
  if (subtasks.length === 0) {
    throw new GraphQLError('Failed to parse AI response');
  }
  return subtasks;
}

export async function summarizeProject(
  apiKey: string,
  projectName: string,
  projectDescription: string,
  tasks: { title: string; status: string }[]
): Promise<string> {
  const p = buildSummarizeProjectPrompt(projectName, projectDescription, tasks);
  const config = FEATURE_CONFIG.summarizeProject;
  const result = await callAI({
    apiKey,
    systemPrompt: p.systemPrompt,
    userPrompt: p.userPrompt,
    maxTokens: config.maxTokens,
    feature: 'summarizeProject',
    cacheTTLMs: config.cacheTTLMs,
  });
  return result.raw;
}

export async function planSprints(
  apiKey: string,
  projectName: string,
  tasks: { title: string; estimatedHours: number | null; priority: string; dependsOn: string | null }[],
  sprintLengthWeeks: number,
  teamSize: number
): Promise<SprintPlan[]> {
  const p = buildPlanSprintsPrompt(projectName, tasks, sprintLengthWeeks, teamSize);
  const plans = await callAndParse(apiKey, 'planSprints', p, z.array(SprintPlanSchema));
  if (plans.length === 0) {
    throw new GraphQLError('Failed to parse AI sprint plan');
  }
  return plans;
}

export async function generateTaskInstructions(
  apiKey: string,
  taskTitle: string,
  taskDescription: string,
  projectName: string,
  existingTaskTitles: string[] = [],
  knowledgeBase?: string | null
): Promise<TaskInstructions> {
  const p = buildGenerateTaskInstructionsPrompt(taskTitle, taskDescription, projectName, existingTaskTitles, knowledgeBase);
  return callAndParse(apiKey, 'generateTaskInstructions', p, TaskInstructionsSchema);
}

export async function generateStandupReport(
  apiKey: string,
  data: {
    projectName: string;
    sprintName?: string | null;
    sprintStart?: string | null;
    sprintEnd?: string | null;
    completedTasks: string[];
    inProgressTasks: string[];
    overdueTasks: string[];
  }
): Promise<StandupReport> {
  const p = buildStandupPrompt(data);
  return callAndParse(apiKey, 'generateStandupReport', p, StandupReportSchema);
}

export async function generateSprintReport(
  apiKey: string,
  data: {
    sprintName: string;
    startDate?: string | null;
    endDate?: string | null;
    tasks: { title: string; status: string; priority: string; assigneeEmail?: string | null }[];
    totalTasks: number;
    completedTasks: number;
  }
): Promise<SprintReport> {
  const p = buildSprintReportPrompt(data);
  return callAndParse(apiKey, 'generateSprintReport', p, SprintReportSchema);
}

export async function analyzeProjectHealth(
  apiKey: string,
  data: {
    projectName: string;
    totalTasks: number;
    tasksByStatus: { status: string; count: number }[];
    overdueCount: number;
    unassignedCount: number;
    tasksWithoutDueDate: number;
    avgTaskAgeInDays: number;
  }
): Promise<HealthAnalysis> {
  const p = buildHealthAnalysisPrompt(data);
  return callAndParse(apiKey, 'analyzeProjectHealth', p, HealthAnalysisSchema);
}

export async function extractTasksFromNotes(
  apiKey: string,
  notes: string,
  projectName: string,
  teamMembers: string[]
): Promise<MeetingNotesExtraction> {
  const p = buildMeetingNotesPrompt(notes, projectName, teamMembers);
  return callAndParse(apiKey, 'extractTasksFromNotes', p, MeetingNotesExtractionSchema);
}

export async function generateCode(
  apiKey: string,
  taskTitle: string,
  taskDescription: string,
  taskInstructions: string,
  projectName: string,
  projectDescription: string,
  existingFiles?: Array<{ path: string; language: string; size: number }>,
  styleGuide?: string | null,
  knowledgeBase?: string | null
): Promise<CodeGeneration> {
  const p = buildGenerateCodePrompt({
    taskTitle, taskDescription, taskInstructions,
    projectName, projectDescription, existingFiles, styleGuide, knowledgeBase,
  });
  return callAndParse(apiKey, 'generateCode', p, CodeGenerationSchema);
}

export async function regenerateFile(
  apiKey: string,
  taskTitle: string,
  taskDescription: string,
  taskInstructions: string,
  filePath: string,
  originalContent: string,
  projectName: string,
  feedback?: string | null
): Promise<GeneratedFile> {
  const p = buildRegenerateFilePrompt({
    taskTitle, taskDescription, taskInstructions,
    filePath, originalContent, feedback, projectName,
  });
  return callAndParse(apiKey, 'regenerateFile', p, GeneratedFileSchema);
}

export async function generateCommitMessage(
  apiKey: string,
  taskTitle: string,
  taskDescription: string,
  files: Array<{ path: string }>
): Promise<string> {
  const p = buildCommitMessagePrompt({ taskTitle, taskDescription, files });
  const config = FEATURE_CONFIG.generateCommitMessage;
  const result = await callAI({
    apiKey,
    systemPrompt: p.systemPrompt,
    userPrompt: p.userPrompt,
    maxTokens: config.maxTokens,
    feature: 'generateCommitMessage',
    cacheTTLMs: config.cacheTTLMs,
  });
  return result.raw.trim();
}

export async function enrichPRDescription(
  apiKey: string,
  taskTitle: string,
  taskDescription: string,
  taskInstructions: string,
  files: Array<{ path: string; language: string }>
): Promise<string> {
  const p = buildEnrichPRDescriptionPrompt({ taskTitle, taskDescription, taskInstructions, files });
  const config = FEATURE_CONFIG.enrichPRDescription;
  const result = await callAI({
    apiKey,
    systemPrompt: p.systemPrompt,
    userPrompt: p.userPrompt,
    maxTokens: config.maxTokens,
    feature: 'enrichPRDescription',
    cacheTTLMs: config.cacheTTLMs,
  });
  return result.raw.trim();
}
