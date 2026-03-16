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
  context?: string | null,
  knowledgeBase?: string | null
): Prompt {
  const contextLine = context ? `\nAdditional context: ${userInput('context', context)}` : '';
  const kbLine = knowledgeBase ? `\nProject Knowledge Base (use for context):\n${userInput('knowledge_base', truncate(knowledgeBase, 800))}` : '';
  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Break this project into implementation tasks.

Project: ${userInput('title', projectTitle)}
Description: ${userInput('description', truncate(projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}
Original request: ${userInput('prompt', truncate(projectPrompt, MAX_PROJECT_DESCRIPTION_CHARS))}${contextLine}${kbLine}

Return a JSON array of 4–8 tasks. Each item:
{
  "title": string,
  "description": string,
  "instructions": string,
  "suggestedTools": [{ "name": string, "category": string, "reason": string }],
  "estimatedHours": number,
  "priority": "low" | "medium" | "high" | "critical",
  "dependsOn": string[],
  "subtasks": [{ "title": string, "description": string }],
  "acceptanceCriteria": string
}
"title" is a short action phrase. "description" is 1–2 sentences. "instructions" is 3–6 sentences of detailed step-by-step guidance for a human or AI agent.
"category" is one of: "ai-model", "code-editor", "design-tool", "database", "cloud-service", "communication", "testing", "other".
List 1–3 tools per task. Be specific (e.g. "Claude Sonnet", "Figma", "Vercel", "Jest").
"estimatedHours" is a realistic work estimate (e.g. 1, 2, 4, 8, 16). "priority" reflects business impact.
"dependsOn" lists titles of OTHER tasks in this same list that must be completed first (empty array if none).
"subtasks" is 2–6 concrete implementation steps that break down this task.
"acceptanceCriteria" is a bullet list of testable conditions that define when the task is complete.`,
  };
}

export function buildExpandTaskPrompt(
  taskTitle: string,
  taskDescription: string,
  projectName: string,
  context?: string | null,
  knowledgeBase?: string | null
): Prompt {
  const contextLine = context ? `\nAdditional context: ${userInput('context', context)}` : '';
  const kbLine = knowledgeBase ? `\nProject Knowledge Base (use for context):\n${userInput('knowledge_base', truncate(knowledgeBase, 800))}` : '';
  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Break this task into subtasks.

Task: ${userInput('title', taskTitle)}
Task description: ${userInput('description', truncate(taskDescription, MAX_DESCRIPTION_CHARS))}
Project: ${userInput('project', projectName)}${contextLine}${kbLine}

Return a JSON array of 2–6 subtasks using the same schema:
{
  "title": string,
  "description": string,
  "instructions": string,
  "suggestedTools": [{ "name": string, "category": string, "reason": string }],
  "acceptanceCriteria": string
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

export function buildStandupPrompt(data: {
  projectName: string;
  sprintName?: string | null;
  sprintStart?: string | null;
  sprintEnd?: string | null;
  completedTasks: string[];
  inProgressTasks: string[];
  overdueTasks: string[];
}): Prompt {
  const sprintLine = data.sprintName
    ? `\nActive sprint: ${userInput('sprint', data.sprintName)}${data.sprintStart ? ` (${data.sprintStart} – ${data.sprintEnd ?? '?'})` : ''}`
    : '';

  const completed = data.completedTasks.length > 0
    ? data.completedTasks.map((t) => `- ${t}`).join('\n')
    : '(none)';
  const inProgress = data.inProgressTasks.length > 0
    ? data.inProgressTasks.map((t) => `- ${t}`).join('\n')
    : '(none)';
  const overdue = data.overdueTasks.length > 0
    ? data.overdueTasks.map((t) => `- ${t}`).join('\n')
    : '(none)';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate a daily standup report for this project.

Project: ${userInput('project', data.projectName)}${sprintLine}

Tasks completed in the last 24 hours:
<user_input label="completed">
${completed}
</user_input>

Tasks currently in progress:
<user_input label="inProgress">
${inProgress}
</user_input>

Overdue / blocked tasks:
<user_input label="overdue">
${overdue}
</user_input>

Return JSON:
{
  "completed": string[],   // brief summary of what was done yesterday
  "inProgress": string[],  // what's being worked on today
  "blockers": string[],    // risks, blockers, or overdue items
  "summary": string        // 1-2 sentence overall status
}
Keep items concise (one sentence each). If a section has no items, return an empty array.`,
  };
}

export function buildSprintReportPrompt(data: {
  sprintName: string;
  startDate?: string | null;
  endDate?: string | null;
  tasks: { title: string; status: string; priority: string; assigneeEmail?: string | null }[];
  totalTasks: number;
  completedTasks: number;
}): Prompt {
  const taskLines = data.tasks
    .map((t) => `- [${t.status}] ${t.title} (${t.priority}${t.assigneeEmail ? `, ${t.assigneeEmail}` : ''})`)
    .join('\n');

  const dateRange = data.startDate
    ? ` (${data.startDate}${data.endDate ? ` – ${data.endDate}` : ''})`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate a sprint retrospective report.

Sprint: ${userInput('sprint', data.sprintName)}${dateRange}
Tasks (${data.totalTasks} total, ${data.completedTasks} completed):
<user_input label="tasks">
${taskLines}
</user_input>

Completion rate: ${data.totalTasks > 0 ? Math.round((data.completedTasks / data.totalTasks) * 100) : 0}%

Return JSON:
{
  "summary": string,           // 2-3 sentence overview of the sprint
  "completionRate": number,    // 0-100 percentage
  "highlights": string[],      // top achievements (2-4 items)
  "concerns": string[],        // missed items or risks (0-3 items)
  "recommendations": string[]  // suggestions for next sprint (2-4 items)
}`,
  };
}

export function buildHealthAnalysisPrompt(data: {
  projectName: string;
  totalTasks: number;
  tasksByStatus: { status: string; count: number }[];
  overdueCount: number;
  unassignedCount: number;
  tasksWithoutDueDate: number;
  avgTaskAgeInDays: number;
}): Prompt {
  const statusLines = data.tasksByStatus
    .map((s) => `- ${s.status}: ${s.count}`)
    .join('\n');

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Analyze the health of this project and provide a health score.

Project: ${userInput('project', data.projectName)}
Total tasks: ${data.totalTasks}

Tasks by status:
${statusLines}

Overdue tasks: ${data.overdueCount}
Unassigned tasks: ${data.unassignedCount}
Tasks without due date: ${data.tasksWithoutDueDate}
Average age of open tasks: ${data.avgTaskAgeInDays} days

Return JSON:
{
  "healthScore": number,     // 0-100
  "status": string,          // "healthy" | "at-risk" | "critical"
  "issues": [{ "title": string, "severity": string, "description": string }],  // severity: "high" | "medium" | "low"
  "strengths": string[],     // 1-3 positive aspects
  "actionItems": string[]    // 2-4 concrete next steps
}
Health score guide: 80-100 = healthy, 50-79 = at-risk, 0-49 = critical.
Be specific about the project data when describing issues and strengths.`,
  };
}

export function buildMeetingNotesPrompt(
  notes: string,
  projectName: string,
  teamMembers: string[]
): Prompt {
  const teamLine = teamMembers.length > 0
    ? `\nTeam members: ${teamMembers.join(', ')}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Extract actionable tasks from these meeting notes.

Project: ${userInput('project', projectName)}${teamLine}

Meeting notes:
<user_input label="notes">
${notes}
</user_input>

Identify action items, decisions with follow-ups, and tasks mentioned.
Return JSON:
{
  "tasks": [{
    "title": string,          // short action phrase
    "description": string,    // 1-2 sentences of context (optional, default "")
    "assigneeName": string,   // name/email if mentioned (optional, default "")
    "priority": string,       // "low" | "medium" | "high" | "critical" (optional, default "medium")
    "status": string          // "todo" | "in_progress" (optional, default "todo")
  }],
  "summary": string           // 1-2 sentence summary of the meeting
}
Extract 0-15 tasks. Only include clear, actionable items — not discussion points or FYIs.`,
  };
}

export function buildGenerateCodePrompt(data: {
  taskTitle: string;
  taskDescription: string;
  taskInstructions: string;
  projectName: string;
  projectDescription: string;
  existingFiles?: Array<{ path: string; language: string; size: number }>;
  styleGuide?: string | null;
  knowledgeBase?: string | null;
}): Prompt {
  const cappedFiles = (data.existingFiles ?? []).slice(0, 30);
  const filesLine =
    cappedFiles.length > 0
      ? `\nExisting project files (for context — do NOT regenerate these):\n${cappedFiles.map((f) => `- ${f.path} (${f.language}, ${f.size} bytes)`).join('\n')}`
      : '';

  const styleGuideLine = data.styleGuide
    ? `\nFollow these project coding conventions:\n${userInput('style_guide', truncate(data.styleGuide, 1000))}`
    : '';

  const kbLine = data.knowledgeBase
    ? `\nProject Knowledge Base (use for context):\n${userInput('knowledge_base', truncate(data.knowledgeBase, 800))}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate code files to implement this task.

Task: ${userInput('title', data.taskTitle)}
Description: ${userInput('description', truncate(data.taskDescription, 400))}
Instructions: ${userInput('instructions', truncate(data.taskInstructions, 800))}
Project: ${userInput('project', data.projectName)}
${data.projectDescription ? `Project description: ${userInput('projectDescription', truncate(data.projectDescription, 400))}\n` : ''}${filesLine}${styleGuideLine}${kbLine}

Return JSON:
{
  "files": [{ "path": string, "content": string, "language": string, "description": string }],
  "summary": string,
  "estimatedTokensUsed": number
}
Generate 1–6 files. Each file should be complete and runnable.
Use appropriate file paths relative to the project root.
Prefer small, focused files over large monolithic ones.
Keep total output concise — avoid generating files not directly needed for the task.`,
  };
}

export function buildRegenerateFilePrompt(data: {
  taskTitle: string;
  taskDescription: string;
  taskInstructions: string;
  filePath: string;
  originalContent: string;
  feedback?: string | null;
  projectName: string;
  styleGuide?: string | null;
}): Prompt {
  const feedbackLine = data.feedback
    ? `\nFeedback: ${userInput('feedback', data.feedback)}`
    : '';

  const styleGuideLine = data.styleGuide
    ? `\nFollow these project coding conventions:\n${userInput('style_guide', truncate(data.styleGuide, 1000))}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Regenerate ONLY the file at ${userInput('filePath', data.filePath)} for this task.

Task: ${userInput('title', data.taskTitle)}
Description: ${userInput('description', truncate(data.taskDescription, 400))}
Instructions: ${userInput('instructions', truncate(data.taskInstructions, 800))}
Project: ${userInput('project', data.projectName)}${feedbackLine}${styleGuideLine}

Original content (for reference):
<user_input label="originalContent">
${truncate(data.originalContent, 2000)}
</user_input>

Return JSON:
{ "path": string, "content": string, "language": string, "description": string }
Generate a complete, runnable file. Incorporate the feedback if provided.`,
  };
}

export function buildCommitMessagePrompt(data: {
  taskTitle: string;
  taskDescription: string;
  files: Array<{ path: string }>;
}): Prompt {
  return {
    systemPrompt: SYSTEM_PROSE,
    userPrompt: `Generate a concise git commit message (max 72 chars first line, optional body after blank line) for this task implementation.

Task: ${userInput('title', data.taskTitle)}
Description: ${userInput('description', truncate(data.taskDescription, MAX_DESCRIPTION_CHARS))}
Files changed: ${data.files.map((f) => f.path).join(', ')}

Use conventional commits format (feat:, fix:, etc). Return ONLY the commit message text.`,
  };
}

export function buildEnrichPRDescriptionPrompt(data: {
  taskTitle: string;
  taskDescription: string;
  taskInstructions: string;
  files: Array<{ path: string; language: string }>;
}): Prompt {
  return {
    systemPrompt: SYSTEM_PROSE,
    userPrompt: `Generate a pull request description in markdown for this task.

Task: ${userInput('title', data.taskTitle)}
Description: ${userInput('description', truncate(data.taskDescription, MAX_PROJECT_DESCRIPTION_CHARS))}
Instructions: ${userInput('instructions', truncate(data.taskInstructions, 800))}
Files: ${data.files.map((f) => f.path).join(', ')}

Include: ## Summary (2-3 sentences), ## Changes (bullet list), ## Testing (how to verify). Return ONLY the markdown.`,
  };
}

export function buildDecomposeIssuePrompt(data: {
  issueTitle: string;
  issueBody: string;
  issueLabels: string[];
  projectName: string;
  projectDescription?: string;
  existingTaskTitles: string[];
}): Prompt {
  const labelsLine = data.issueLabels.length > 0
    ? `\nLabels: ${data.issueLabels.join(', ')}`
    : '';
  const descLine = data.projectDescription
    ? `\nProject description: ${userInput('projectDescription', truncate(data.projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}`
    : '';
  const existingLine = data.existingTaskTitles.length > 0
    ? `\nDo NOT create tasks that duplicate these existing titles: ${data.existingTaskTitles.map((t) => JSON.stringify(t)).join(', ')}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Break this GitHub issue into implementable tasks. Each task should be self-contained and actionable. Include acceptance criteria for each task.

Issue: ${userInput('title', data.issueTitle)}${labelsLine}
Project: ${userInput('project', data.projectName)}${descLine}${existingLine}

Issue body:
<user_input label="issue_body">
${truncate(data.issueBody, 3000)}
</user_input>

Return JSON:
{
  "tasks": [{
    "title": string,
    "description": string,
    "priority": "low" | "medium" | "high" | "critical",
    "estimatedHours": number,
    "instructions": string,
    "acceptanceCriteria": string
  }]
}
Generate 1-8 tasks. Each task should be a concrete, actionable work item.`,
  };
}

export function buildCodeReviewPrompt(data: {
  taskTitle: string;
  taskDescription: string;
  taskInstructions?: string;
  acceptanceCriteria?: string;
  diff: string;
  projectName: string;
}): Prompt {
  const instructionsLine = data.taskInstructions
    ? `\nInstructions: ${userInput('instructions', truncate(data.taskInstructions, 800))}`
    : '';
  const acLine = data.acceptanceCriteria
    ? `\nAcceptance Criteria: ${userInput('acceptance_criteria', truncate(data.acceptanceCriteria, 400))}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Review the following code changes for a task. Check for: bugs, security issues, performance problems, missing error handling, deviation from task requirements. The diff is in unified format.

Task: ${userInput('title', data.taskTitle)}
Description: ${userInput('description', truncate(data.taskDescription, MAX_DESCRIPTION_CHARS))}${instructionsLine}${acLine}
Project: ${userInput('project', data.projectName)}

Diff:
<user_input label="diff">
${truncate(data.diff, 6000)}
</user_input>

Return JSON:
{
  "summary": string,
  "approved": boolean,
  "comments": [{ "file": string, "line": number | null, "severity": "info" | "warning" | "error", "comment": string }],
  "suggestions": string[]
}
Focus on actionable feedback. Be specific about file paths and line numbers when possible.`,
  };
}

export function buildGenerateTaskInstructionsPrompt(
  taskTitle: string,
  taskDescription: string,
  projectName: string,
  existingTaskTitles: string[],
  knowledgeBase?: string | null
): Prompt {
  // Cap sibling titles to avoid bloating prompts on large projects
  const cappedTitles = existingTaskTitles.slice(0, MAX_SIBLING_TITLES);
  const siblingsLine =
    cappedTitles.length > 0
      ? `Other tasks in this project (${existingTaskTitles.length} total): ${cappedTitles.map((t) => JSON.stringify(t)).join(', ')}${existingTaskTitles.length > MAX_SIBLING_TITLES ? ', …' : ''}`
      : '';
  const kbLine = knowledgeBase ? `\nProject Knowledge Base (use for context):\n${userInput('knowledge_base', truncate(knowledgeBase, 800))}` : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Write detailed implementation instructions for this task.

Task: ${userInput('title', taskTitle)}
Description: ${userInput('description', truncate(taskDescription, MAX_DESCRIPTION_CHARS))}
Project: ${userInput('project', projectName)}
${siblingsLine}${kbLine}

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
