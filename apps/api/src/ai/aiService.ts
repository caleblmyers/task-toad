import { z } from 'zod';
import { GraphQLError } from 'graphql';
import * as Sentry from '@sentry/node';
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
  CodeReviewSchema,
  IssueDecompositionSchema,
  ReviewFixSchema,
  BugReportTaskSchema,
  PRDBreakdownSchema,
  SprintTransitionSchema,
  RepoBootstrapSchema,
  ProjectChatResponseSchema,
  DriftAnalysisSchema,
  BatchCodeGenerationSchema,
  TrendAnalysisSchema,
} from './aiTypes.js';
import type { ProjectOption, TaskPlan, SprintPlan, TaskInstructions, StandupReport, SprintReport, HealthAnalysis, MeetingNotesExtraction, CodeGeneration, GeneratedFile, CodeReview, IssueDecomposition, ReviewFix, BugReportTask, PRDBreakdown, SprintTransition, RepoBootstrap, ProjectChatResponse, DriftAnalysis, BatchCodeGeneration, TrendAnalysis } from './aiTypes.js';
import { FEATURE_CONFIG } from './aiConfig.js';
import { callAI, type PromptLogContext } from './aiClient.js';
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
  buildCodeReviewPrompt,
  buildDecomposeIssuePrompt,
  buildReviewFixPrompt,
  buildParseBugReportPrompt,
  buildPRDBreakdownPrompt,
  buildSprintTransitionPrompt,
  buildRepoBootstrapPrompt,
  buildProjectChatPrompt,
  buildRepoDriftPrompt,
  buildBatchCodeGenerationPrompt,
  buildTrendAnalysisPrompt,
} from './promptBuilder.js';

// ---------------------------------------------------------------------------
// Retry-on-validation-failure helper
// ---------------------------------------------------------------------------

/** Detect whether a Zod schema expects an array at the top level. */
function isArraySchema(schema: z.ZodType<unknown>): boolean {
  const def = schema._def as { type?: string; in?: z.ZodType<unknown> };
  if (def.type === 'array') return true;
  // Unwrap ZodPipe (e.g. .transform(), .refine() in Zod v4)
  if (def.type === 'pipe' && def.in) return isArraySchema(def.in);
  return false;
}

async function callAndParse<T>(
  apiKey: string,
  feature: AIFeature,
  prompt: { systemPrompt: string; userPrompt: string },
  schema: z.ZodType<T>,
  promptLogContext?: PromptLogContext
): Promise<T> {
  const config = FEATURE_CONFIG[feature];
  const prefill = isArraySchema(schema as z.ZodType<unknown>) ? '[' : '{';
  try {
    const result = await callAI({
      apiKey,
      systemPrompt: prompt.systemPrompt,
      userPrompt: prompt.userPrompt,
      maxTokens: config.maxTokens,
      feature,
      cacheTTLMs: config.cacheTTLMs,
      prefill,
      promptLogContext,
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
          prefill,
          promptLogContext,
        });
        return parseJSON(retry.raw, schema);
      }
      throw err;
    }
  } catch (err) {
    Sentry.captureException(err, {
      tags: { source: 'ai', feature },
      extra: { maxTokens: config.maxTokens },
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Feature functions — maintain exact signatures for schema.ts compatibility
// ---------------------------------------------------------------------------

export async function generateProjectOptions(
  apiKey: string,
  prompt: string,
  promptLogContext?: PromptLogContext
): Promise<ProjectOption[]> {
  const p = buildProjectOptionsPrompt(prompt);
  const options = await callAndParse(apiKey, 'generateProjectOptions', p, z.array(ProjectOptionSchema), promptLogContext);
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
  knowledgeBase?: string | null,
  existingTaskTitles?: string[],
  promptLogContext?: PromptLogContext
): Promise<TaskPlan[]> {
  const p = buildTaskPlanPrompt(projectTitle, projectDescription, projectPrompt, context, knowledgeBase, existingTaskTitles);
  const tasks = await callAndParse(apiKey, 'generateTaskPlan', p, z.array(TaskPlanSchema), promptLogContext);
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
  knowledgeBase?: string | null,
  siblingTitles?: string[],
  promptLogContext?: PromptLogContext
): Promise<TaskPlan[]> {
  const p = buildExpandTaskPrompt(taskTitle, taskDescription, projectName, context, knowledgeBase, siblingTitles);
  const subtasks = await callAndParse(apiKey, 'expandTask', p, z.array(TaskPlanSchema), promptLogContext);
  if (subtasks.length === 0) {
    throw new GraphQLError('Failed to parse AI response');
  }
  return subtasks;
}

export async function summarizeProject(
  apiKey: string,
  projectName: string,
  projectDescription: string,
  tasks: { title: string; status: string }[],
  promptLogContext?: PromptLogContext
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
    promptLogContext,
  });
  return result.raw;
}

export async function planSprints(
  apiKey: string,
  projectName: string,
  tasks: { title: string; estimatedHours: number | null; priority: string; dependsOn: string | null }[],
  sprintLengthWeeks: number,
  teamSize: number,
  promptLogContext?: PromptLogContext
): Promise<SprintPlan[]> {
  const p = buildPlanSprintsPrompt(projectName, tasks, sprintLengthWeeks, teamSize);
  const plans = await callAndParse(apiKey, 'planSprints', p, z.array(SprintPlanSchema), promptLogContext);
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
  knowledgeBase?: string | null,
  promptLogContext?: PromptLogContext
): Promise<TaskInstructions> {
  const p = buildGenerateTaskInstructionsPrompt(taskTitle, taskDescription, projectName, existingTaskTitles, knowledgeBase);
  return callAndParse(apiKey, 'generateTaskInstructions', p, TaskInstructionsSchema, promptLogContext);
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
  },
  promptLogContext?: PromptLogContext
): Promise<StandupReport> {
  const p = buildStandupPrompt(data);
  return callAndParse(apiKey, 'generateStandupReport', p, StandupReportSchema, promptLogContext);
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
  },
  promptLogContext?: PromptLogContext
): Promise<SprintReport> {
  const p = buildSprintReportPrompt(data);
  return callAndParse(apiKey, 'generateSprintReport', p, SprintReportSchema, promptLogContext);
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
  },
  promptLogContext?: PromptLogContext
): Promise<HealthAnalysis> {
  const p = buildHealthAnalysisPrompt(data);
  return callAndParse(apiKey, 'analyzeProjectHealth', p, HealthAnalysisSchema, promptLogContext);
}

export async function extractTasksFromNotes(
  apiKey: string,
  notes: string,
  projectName: string,
  teamMembers: string[],
  promptLogContext?: PromptLogContext
): Promise<MeetingNotesExtraction> {
  const p = buildMeetingNotesPrompt(notes, projectName, teamMembers);
  return callAndParse(apiKey, 'extractTasksFromNotes', p, MeetingNotesExtractionSchema, promptLogContext);
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
  knowledgeBase?: string | null,
  promptLogContext?: PromptLogContext
): Promise<CodeGeneration> {
  const p = buildGenerateCodePrompt({
    taskTitle, taskDescription, taskInstructions,
    projectName, projectDescription, existingFiles, styleGuide, knowledgeBase,
  });
  return callAndParse(apiKey, 'generateCode', p, CodeGenerationSchema, promptLogContext);
}

export async function regenerateFile(
  apiKey: string,
  taskTitle: string,
  taskDescription: string,
  taskInstructions: string,
  filePath: string,
  originalContent: string,
  projectName: string,
  feedback?: string | null,
  promptLogContext?: PromptLogContext
): Promise<GeneratedFile> {
  const p = buildRegenerateFilePrompt({
    taskTitle, taskDescription, taskInstructions,
    filePath, originalContent, feedback, projectName,
  });
  return callAndParse(apiKey, 'regenerateFile', p, GeneratedFileSchema, promptLogContext);
}

export async function generateCommitMessage(
  apiKey: string,
  taskTitle: string,
  taskDescription: string,
  files: Array<{ path: string }>,
  promptLogContext?: PromptLogContext
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
    promptLogContext,
  });
  return result.raw.trim();
}

export async function reviewCode(
  apiKey: string,
  data: {
    taskTitle: string;
    taskDescription: string;
    taskInstructions?: string;
    acceptanceCriteria?: string;
    diff: string;
    projectName: string;
  },
  promptLogContext?: PromptLogContext
): Promise<CodeReview> {
  const p = buildCodeReviewPrompt(data);
  return callAndParse(apiKey, 'reviewCode', p, CodeReviewSchema, promptLogContext);
}

export async function generateReviewFix(
  apiKey: string,
  data: {
    taskTitle: string;
    taskInstructions: string;
    reviewComments: string;
    currentFiles: Array<{ path: string; content: string }>;
    projectName: string;
  },
  promptLogContext?: PromptLogContext
): Promise<ReviewFix> {
  const p = buildReviewFixPrompt(data);
  return callAndParse(apiKey, 'generateReviewFix', p, ReviewFixSchema, promptLogContext);
}

export async function decomposeIssue(
  apiKey: string,
  data: {
    issueTitle: string;
    issueBody: string;
    issueLabels: string[];
    projectName: string;
    projectDescription?: string;
    existingTaskTitles: string[];
  },
  promptLogContext?: PromptLogContext
): Promise<IssueDecomposition> {
  const p = buildDecomposeIssuePrompt(data);
  return callAndParse(apiKey, 'decomposeIssue', p, IssueDecompositionSchema, promptLogContext);
}

export async function enrichPRDescription(
  apiKey: string,
  taskTitle: string,
  taskDescription: string,
  taskInstructions: string,
  files: Array<{ path: string; language: string }>,
  promptLogContext?: PromptLogContext
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
    promptLogContext,
  });
  return result.raw.trim();
}

export async function parseBugReport(
  apiKey: string,
  data: { bugReport: string; projectName: string; projectDescription?: string | null },
  promptLogContext?: PromptLogContext
): Promise<BugReportTask> {
  const p = buildParseBugReportPrompt(data);
  return callAndParse(apiKey, 'parseBugReport', p, BugReportTaskSchema, promptLogContext);
}

export async function breakdownPRD(
  apiKey: string,
  data: { prd: string; projectName: string; projectDescription?: string | null },
  promptLogContext?: PromptLogContext
): Promise<PRDBreakdown> {
  const p = buildPRDBreakdownPrompt(data);
  return callAndParse(apiKey, 'breakdownPRD', p, PRDBreakdownSchema, promptLogContext);
}

export async function analyzeSprintTransition(
  apiKey: string,
  data: {
    sprintName: string;
    sprintGoal?: string | null;
    tasks: Array<{ taskId: string; title: string; status: string; priority: string; assignee?: string | null; storyPoints?: number | null }>;
    completionRate: number;
  },
  promptLogContext?: PromptLogContext
): Promise<SprintTransition> {
  const p = buildSprintTransitionPrompt(data);
  return callAndParse(apiKey, 'analyzeSprintTransition', p, SprintTransitionSchema, promptLogContext);
}

export async function bootstrapFromRepo(
  apiKey: string,
  data: {
    repoName: string;
    repoDescription?: string | null;
    readme?: string | null;
    packageJson?: string | null;
    fileTree: Array<{ path: string; language?: string | null; size?: number | null }>;
    languages: string[];
  },
  promptLogContext?: PromptLogContext
): Promise<RepoBootstrap> {
  const p = buildRepoBootstrapPrompt(data);
  return callAndParse(apiKey, 'bootstrapFromRepo', p, RepoBootstrapSchema, promptLogContext);
}

export async function projectChat(
  apiKey: string,
  data: {
    question: string;
    projectName: string;
    projectDescription?: string | null;
    tasks: Array<{ taskId: string; title: string; status: string; priority: string; assignee?: string | null; sprintName?: string | null }>;
    sprints: Array<{ name: string; isActive: boolean; taskCount: number }>;
    recentActivity: Array<{ action: string; field?: string | null; taskTitle?: string | null; createdAt: string }>;
    knowledgeBase?: string | null;
  },
  promptLogContext?: PromptLogContext
): Promise<ProjectChatResponse> {
  const p = buildProjectChatPrompt(data);
  return callAndParse(apiKey, 'projectChat', p, ProjectChatResponseSchema, promptLogContext);
}

export async function analyzeRepoDrift(
  apiKey: string,
  data: {
    repoName: string;
    recentCommits: Array<{ sha: string; message: string; date: string }>;
    openPRs: Array<{ title: string; state: string }>;
    tasks: Array<{ taskId: string; title: string; status: string; description?: string | null }>;
  },
  promptLogContext?: PromptLogContext
): Promise<DriftAnalysis> {
  const p = buildRepoDriftPrompt(data);
  return callAndParse(apiKey, 'analyzeRepoDrift', p, DriftAnalysisSchema, promptLogContext);
}

export async function batchGenerateCode(
  apiKey: string,
  data: {
    tasks: Array<{ title: string; description: string; instructions: string }>;
    projectName: string;
    projectDescription?: string | null;
    existingFiles?: Array<{ path: string; language: string; size: number }>;
    styleGuide?: string | null;
    knowledgeBase?: string | null;
  },
  promptLogContext?: PromptLogContext
): Promise<BatchCodeGeneration> {
  const p = buildBatchCodeGenerationPrompt(data);
  return callAndParse(apiKey, 'batchGenerateCode', p, BatchCodeGenerationSchema, promptLogContext);
}

export async function analyzeTrends(
  apiKey: string,
  data: {
    projectName: string;
    reports: Array<{ type: string; title: string; data: string; createdAt: string }>;
    period?: string | null;
  },
  promptLogContext?: PromptLogContext
): Promise<TrendAnalysis> {
  const p = buildTrendAnalysisPrompt(data);
  return callAndParse(apiKey, 'analyzeTrends', p, TrendAnalysisSchema, promptLogContext);
}
