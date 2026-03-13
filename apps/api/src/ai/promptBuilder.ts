import { SYSTEM_JSON, SYSTEM_PROSE } from './aiConfig.js';

// ---------------------------------------------------------------------------
// Injection defense — wraps user-controlled text in delimiter tags
// ---------------------------------------------------------------------------

export function userInput(label: string, value: string): string {
  return `<user_input label=${JSON.stringify(label)}>${value}</user_input>`;
}

// ---------------------------------------------------------------------------
// Context compression — truncate verbose fields before injecting into prompts
// ---------------------------------------------------------------------------

const MAX_DESCRIPTION_CHARS = 200;
const MAX_PROJECT_DESCRIPTION_CHARS = 400;
const MAX_SIBLING_TITLES = 15;

function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
}

function groupTasksByStatus(
  tasks: { title: string; status: string }[]
): string {
  const groups: Record<string, string[]> = {};
  for (const t of tasks) {
    (groups[t.status] ??= []).push(t.title);
  }
  const lines: string[] = [];
  // Order: done first (context for what's finished), then in_progress, then todo
  for (const status of ['done', 'in_progress', 'todo']) {
    const titles = groups[status];
    if (!titles || titles.length === 0) continue;
    const label = status === 'done' ? 'Done' : status === 'in_progress' ? 'In Progress' : 'To Do';
    lines.push(`${label} (${titles.length}): ${titles.join(', ')}`);
  }
  // Catch any non-standard statuses
  for (const [status, titles] of Object.entries(groups)) {
    if (['done', 'in_progress', 'todo'].includes(status)) continue;
    lines.push(`${status} (${titles.length}): ${titles.join(', ')}`);
  }
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Prompt return type
// ---------------------------------------------------------------------------

interface Prompt {
  systemPrompt: string;
  userPrompt: string;
}

// ---------------------------------------------------------------------------
// Per-feature prompt builders
// ---------------------------------------------------------------------------

export function buildProjectOptionsPrompt(prompt: string): Prompt {
  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `A user wants to start a project. Their description:
${userInput('prompt', prompt)}

Return a JSON array of exactly 3 distinct project interpretations.
Each item: { "title": string, "description": string }
"title" should be 3–7 words. "description" should be 1–2 sentences explaining the scope.
Vary the options: make one narrow/focused, one medium-scope, one ambitious.`,
  };
}

export function buildTaskPlanPrompt(
  projectTitle: string,
  projectDescription: string,
  projectPrompt: string,
  context?: string | null
): Prompt {
  const contextLine = context ? `\nAdditional context: ${userInput('context', context)}` : '';
  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Break this project into implementation tasks.

Project: ${userInput('title', projectTitle)}
Description: ${userInput('description', truncate(projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}
Original request: ${userInput('prompt', truncate(projectPrompt, MAX_PROJECT_DESCRIPTION_CHARS))}${contextLine}

Return a JSON array of 4–8 tasks. Each item:
{
  "title": string,
  "description": string,
  "instructions": string,
  "suggestedTools": [{ "name": string, "category": string, "reason": string }],
  "estimatedHours": number,
  "priority": "low" | "medium" | "high" | "critical",
  "dependsOn": string[],
  "subtasks": [{ "title": string, "description": string }]
}
"title" is a short action phrase. "description" is 1–2 sentences. "instructions" is 3–6 sentences of detailed step-by-step guidance for a human or AI agent.
"category" is one of: "ai-model", "code-editor", "design-tool", "database", "cloud-service", "communication", "testing", "other".
List 1–3 tools per task. Be specific (e.g. "Claude Sonnet", "Figma", "Vercel", "Jest").
"estimatedHours" is a realistic work estimate (e.g. 1, 2, 4, 8, 16). "priority" reflects business impact.
"dependsOn" lists titles of OTHER tasks in this same list that must be completed first (empty array if none).
"subtasks" is 2–6 concrete implementation steps that break down this task.`,
  };
}

export function buildExpandTaskPrompt(
  taskTitle: string,
  taskDescription: string,
  projectName: string,
  context?: string | null
): Prompt {
  const contextLine = context ? `\nAdditional context: ${userInput('context', context)}` : '';
  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Break this task into subtasks.

Task: ${userInput('title', taskTitle)}
Task description: ${userInput('description', truncate(taskDescription, MAX_DESCRIPTION_CHARS))}
Project: ${userInput('project', projectName)}${contextLine}

Return a JSON array of 2–6 subtasks using the same schema:
{
  "title": string,
  "description": string,
  "instructions": string,
  "suggestedTools": [{ "name": string, "category": string, "reason": string }]
}`,
  };
}

export function buildSummarizeProjectPrompt(
  projectName: string,
  projectDescription: string,
  tasks: { title: string; status: string }[]
): Prompt {
  // Deterministic preprocessing: group tasks by status so the model
  // focuses on synthesis rather than counting/categorization.
  const grouped = groupTasksByStatus(tasks);

  return {
    systemPrompt: SYSTEM_PROSE,
    userPrompt: `Summarize the current state of this project for the team.

Project: ${userInput('name', projectName)}
${projectDescription ? `Description: ${userInput('description', truncate(projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}\n` : ''}
Tasks (${tasks.length} total):
${grouped}

Write 2–4 sentences covering: what has been completed, what is in progress, and what still needs to be done. Be specific about the work, not the process.`,
  };
}

export function buildPlanSprintsPrompt(
  projectName: string,
  tasks: { title: string; estimatedHours: number | null; priority: string; dependsOn: string | null }[],
  sprintLengthWeeks: number,
  teamSize: number
): Prompt {
  const capacityPerSprint = Math.round(sprintLengthWeeks * teamSize * 40 * 0.7);

  const taskLines = tasks
    .map((t, i) => {
      const hours = t.estimatedHours ?? 2;
      return `[${i}] "${t.title}" (${hours}h, priority: ${t.priority})`;
    })
    .join('\n');

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `You are planning development sprints for a project.

Project: ${userInput('name', projectName)}
Sprint length: ${sprintLengthWeeks} week(s)
Team size: ${teamSize} developer(s)
Capacity per sprint: ~${capacityPerSprint} hours (assumes 70% efficiency)

Backlog tasks to assign (index, title, estimate, priority):
${taskLines}

Rules:
1. Keep total estimated hours per sprint at or under the capacity limit.
2. Higher priority tasks (critical > high > medium > low) should appear in earlier sprints.
3. Group related tasks together when sensible.
4. Tasks without an estimate should be treated as 2 hours.
5. Every task must appear in exactly one sprint. Do not omit any tasks.

Return a JSON array of sprint plans. Name each sprint descriptively based on the work it contains (e.g. "Sprint 1 – Core Auth", "Sprint 2 – Dashboard UI"):
[{ "name": string, "taskIndices": number[], "totalHours": number }]`,
  };
}

export function buildGenerateTaskInstructionsPrompt(
  taskTitle: string,
  taskDescription: string,
  projectName: string,
  existingTaskTitles: string[]
): Prompt {
  // Cap sibling titles to avoid bloating prompts on large projects
  const cappedTitles = existingTaskTitles.slice(0, MAX_SIBLING_TITLES);
  const siblingsLine =
    cappedTitles.length > 0
      ? `Other tasks in this project (${existingTaskTitles.length} total): ${cappedTitles.map((t) => JSON.stringify(t)).join(', ')}${existingTaskTitles.length > MAX_SIBLING_TITLES ? ', …' : ''}`
      : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Write detailed implementation instructions for this task.

Task: ${userInput('title', taskTitle)}
Description: ${userInput('description', truncate(taskDescription, MAX_DESCRIPTION_CHARS))}
Project: ${userInput('project', projectName)}
${siblingsLine}

Return JSON:
{
  "instructions": string,
  "suggestedTools": [{ "name": string, "category": string, "reason": string }],
  "estimatedHours": number,
  "priority": "low" | "medium" | "high" | "critical",
  "dependsOn": string[],
  "subtasks": [{ "title": string, "description": string }]
}
"instructions" should be 4–8 sentences of specific, actionable steps.
"category" is one of: "ai-model", "code-editor", "design-tool", "database", "cloud-service", "communication", "testing", "other".
"estimatedHours" is a realistic work estimate (e.g. 1, 2, 4, 8). "priority" reflects business impact.
"dependsOn" lists titles from the "Other tasks" list that must be done before this one (empty array if none or no other tasks listed).
"subtasks" is 2–6 concrete implementation steps.`,
  };
}
