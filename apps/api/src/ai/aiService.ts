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
} from './aiTypes.js';
import type { ProjectOption, TaskPlan, SprintPlan, TaskInstructions } from './aiTypes.js';
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
  context?: string | null
): Promise<TaskPlan[]> {
  const p = buildTaskPlanPrompt(projectTitle, projectDescription, projectPrompt, context);
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
  context?: string | null
): Promise<TaskPlan[]> {
  const p = buildExpandTaskPrompt(taskTitle, taskDescription, projectName, context);
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
  existingTaskTitles: string[] = []
): Promise<TaskInstructions> {
  const p = buildGenerateTaskInstructionsPrompt(taskTitle, taskDescription, projectName, existingTaskTitles);
  return callAndParse(apiKey, 'generateTaskInstructions', p, TaskInstructionsSchema);
}
