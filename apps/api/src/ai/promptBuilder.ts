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
  knowledgeBase?: string | null,
  existingTaskTitles?: string[]
): Prompt {
  const contextLine = context ? `\nAdditional context: ${userInput('context', context)}` : '';
  const kbLine = knowledgeBase ? `\nProject Knowledge Base (use for context):\n${userInput('knowledge_base', truncate(knowledgeBase, 800))}` : '';
  const dedupLine = existingTaskTitles && existingTaskTitles.length > 0
    ? `\nIMPORTANT: Do NOT create tasks with the same or very similar titles as these existing tasks:\n${existingTaskTitles.slice(0, 30).join('\n')}`
    : '';
  const taskPlanSchema = `

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
"acceptanceCriteria" is a bullet list of testable conditions that define when the task is complete.`;

  return {
    systemPrompt: SYSTEM_JSON + taskPlanSchema,
    userPrompt: `Break this project into implementation tasks.

Project: ${userInput('title', projectTitle)}
Description: ${userInput('description', truncate(projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}
Original request: ${userInput('prompt', truncate(projectPrompt, MAX_PROJECT_DESCRIPTION_CHARS))}${contextLine}${kbLine}${dedupLine}`,
  };
}

export function buildExpandTaskPrompt(
  taskTitle: string,
  taskDescription: string,
  projectName: string,
  context?: string | null,
  knowledgeBase?: string | null,
  siblingTitles?: string[]
): Prompt {
  const contextLine = context ? `\nAdditional context: ${userInput('context', context)}` : '';
  const kbLine = knowledgeBase ? `\nProject Knowledge Base (use for context):\n${userInput('knowledge_base', truncate(knowledgeBase, 800))}` : '';
  const dedupLine = siblingTitles && siblingTitles.length > 0
    ? `\nIMPORTANT: Do NOT create subtasks with the same or very similar titles as these existing sibling tasks:\n${siblingTitles.slice(0, 30).join('\n')}`
    : '';
  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Break this task into subtasks.

Task: ${userInput('title', taskTitle)}
Task description: ${userInput('description', truncate(taskDescription, MAX_DESCRIPTION_CHARS))}
Project: ${userInput('project', projectName)}${contextLine}${kbLine}${dedupLine}

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
  const cappedFiles = (data.existingFiles ?? []).slice(0, 15);
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

export function buildReviewFixPrompt(data: {
  taskTitle: string;
  taskInstructions: string;
  reviewComments: string;
  currentFiles: Array<{ path: string; content: string }>;
  projectName: string;
}): Prompt {
  const filesSection = data.currentFiles
    .map((f) => `--- ${f.path} ---\n${truncate(f.content, 2000)}`)
    .join('\n\n');

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Fix the code based on the review feedback. Return updated file contents that address each comment. Only include files that need changes.

Task: ${userInput('title', data.taskTitle)}
Instructions: ${userInput('instructions', truncate(data.taskInstructions, 800))}
Project: ${userInput('project', data.projectName)}

Review comments:
<user_input label="review_comments">
${truncate(data.reviewComments, 3000)}
</user_input>

Current file contents:
<user_input label="current_files">
${truncate(filesSection, 6000)}
</user_input>

Return JSON:
{
  "files": [{ "path": string, "content": string, "language": string, "description": string }],
  "commitMessage": string
}
Generate complete, updated file contents (not patches). Only include files that need changes.
The commit message should summarize what was fixed.`,
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

export function buildParseBugReportPrompt(data: {
  bugReport: string;
  projectName: string;
  projectDescription?: string | null;
}): Prompt {
  const descLine = data.projectDescription
    ? `\nProject description: ${userInput('projectDescription', truncate(data.projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Parse this bug report and extract a structured task from it.

Project: ${userInput('project', data.projectName)}${descLine}

Bug report:
<user_input label="bug_report">
${truncate(data.bugReport, 2000)}
</user_input>

Return JSON:
{
  "title": string,
  "description": string,
  "priority": "low" | "medium" | "high" | "critical",
  "suggestedTools": [{ "name": string, "category": string, "reason": string }],
  "acceptanceCriteria": string
}
"title" should be a concise bug summary (e.g. "Fix login timeout on slow connections").
"description" must include structured sections: Steps to Reproduce, Expected Behavior, Actual Behavior.
"priority" should reflect severity: critical = data loss/crash, high = major feature broken, medium = degraded experience, low = cosmetic/minor.
"acceptanceCriteria" should describe how to verify the fix is working.`,
  };
}

export function buildPRDBreakdownPrompt(data: {
  prd: string;
  projectName: string;
  projectDescription?: string | null;
}): Prompt {
  const descLine = data.projectDescription
    ? `\nProject description: ${userInput('projectDescription', truncate(data.projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Break this Product Requirements Document (PRD) into epics, each containing implementation tasks.

Project: ${userInput('project', data.projectName)}${descLine}

PRD:
<user_input label="prd">
${truncate(data.prd, 4000)}
</user_input>

Return JSON:
{
  "epics": [{
    "title": string,
    "description": string,
    "tasks": [{
      "title": string,
      "description": string,
      "priority": "low" | "medium" | "high" | "critical",
      "estimatedHours": number,
      "acceptanceCriteria": string
    }]
  }]
}
Group related work into 2-6 epics. Each epic should have 2-8 tasks.
Tasks should be concrete, actionable implementation items.
Order epics and tasks by logical implementation sequence.`,
  };
}

export function buildSprintTransitionPrompt(data: {
  sprintName: string;
  sprintGoal?: string | null;
  tasks: Array<{ taskId: string; title: string; status: string; priority: string; assignee?: string | null; storyPoints?: number | null }>;
  completionRate: number;
}): Prompt {
  const taskLines = data.tasks
    .map((t) => `[${t.taskId}] "${t.title}" — status: ${t.status}, priority: ${t.priority}${t.assignee ? `, assignee: ${t.assignee}` : ''}${t.storyPoints != null ? `, points: ${t.storyPoints}` : ''}`)
    .join('\n');

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Analyze the incomplete tasks from this sprint and recommend which to carry over to the next sprint vs deprioritize to backlog.

Sprint: ${userInput('sprint', data.sprintName)}${data.sprintGoal ? `\nGoal: ${userInput('goal', data.sprintGoal)}` : ''}
Completion rate: ${data.completionRate}%

Incomplete tasks:
<user_input label="tasks">
${taskLines}
</user_input>

Return JSON:
{
  "summary": string,
  "carryOver": [{ "taskId": string, "reason": string }],
  "deprioritize": [{ "taskId": string, "reason": string }],
  "recommendations": string[]
}
"carryOver" — tasks that should move to the next sprint (high priority, in progress, nearly done, critical path).
"deprioritize" — tasks that should go back to backlog (low priority, not started, scope creep).
"recommendations" — 2-4 actionable suggestions for the next sprint.
"summary" — 2-3 sentence overview of the sprint completion and transition.
Every incomplete task must appear in either carryOver or deprioritize.`,
  };
}

export function buildRepoBootstrapPrompt(data: {
  repoName: string;
  repoDescription?: string | null;
  readme?: string | null;
  packageJson?: string | null;
  fileTree: Array<{ path: string; language?: string | null; size?: number | null }>;
  languages: string[];
}): Prompt {
  const filesSection = data.fileTree
    .slice(0, 50)
    .map((f) => `- ${f.path}${f.language ? ` (${f.language})` : ''}${f.size != null ? ` [${f.size}B]` : ''}`)
    .join('\n');
  const readmeSection = data.readme
    ? `\nREADME:\n<user_input label="readme">\n${truncate(data.readme, 2000)}\n</user_input>`
    : '';
  const packageSection = data.packageJson
    ? `\npackage.json:\n<user_input label="package_json">\n${truncate(data.packageJson, 1000)}\n</user_input>`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Analyze this GitHub repository and generate a project description and initial task breakdown for improving and maintaining the codebase.

Repository: ${userInput('repo', data.repoName)}${data.repoDescription ? `\nDescription: ${userInput('description', data.repoDescription)}` : ''}
Languages: ${data.languages.join(', ')}

File tree (${data.fileTree.length} files):
${filesSection}${readmeSection}${packageSection}

Return JSON:
{
  "projectDescription": string,
  "tasks": [{
    "title": string,
    "description": string,
    "priority": "low" | "medium" | "high" | "critical",
    "estimatedHours": number,
    "taskType": "epic" | "story" | "task"
  }]
}
"projectDescription" — 2-3 sentences summarizing the project purpose and tech stack.
Generate 5-15 tasks covering: setup/documentation, code quality, testing, features, and maintenance.
Tasks should be specific to THIS codebase — reference actual files, technologies, and patterns found.`,
  };
}

export function buildProjectChatPrompt(data: {
  question: string;
  projectName: string;
  projectDescription?: string | null;
  tasks: Array<{ taskId: string; title: string; status: string; priority: string; assignee?: string | null; sprintName?: string | null }>;
  sprints: Array<{ name: string; isActive: boolean; taskCount: number }>;
  recentActivity: Array<{ action: string; field?: string | null; taskTitle?: string | null; createdAt: string }>;
  knowledgeBase?: string | null;
}): Prompt {
  const taskLines = data.tasks
    .slice(0, 50)
    .map((t) => `[${t.taskId}] "${t.title}" — ${t.status}, ${t.priority}${t.assignee ? `, assigned: ${t.assignee}` : ''}${t.sprintName ? `, sprint: ${t.sprintName}` : ''}`)
    .join('\n');

  const sprintLines = data.sprints
    .map((s) => `"${s.name}" — ${s.isActive ? 'ACTIVE' : 'inactive'}, ${s.taskCount} tasks`)
    .join('\n');

  const activityLines = data.recentActivity
    .slice(0, 20)
    .map((a) => `${a.action}${a.field ? ` (${a.field})` : ''}${a.taskTitle ? ` on "${a.taskTitle}"` : ''} at ${a.createdAt}`)
    .join('\n');

  const descLine = data.projectDescription
    ? `\nDescription: ${userInput('description', truncate(data.projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}`
    : '';
  const kbLine = data.knowledgeBase
    ? `\nKnowledge Base:\n${userInput('knowledge_base', truncate(data.knowledgeBase, 800))}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Answer the user's question about this project using ONLY the provided data. If the data doesn't contain enough information to answer, say so honestly.

Project: ${userInput('project', data.projectName)}${descLine}${kbLine}

Tasks (${data.tasks.length} total):
${taskLines || '(no tasks)'}

Sprints:
${sprintLines || '(no sprints)'}

Recent activity:
${activityLines || '(no recent activity)'}

Question:
<user_input label="question">
${truncate(data.question, 500)}
</user_input>

Return JSON:
{
  "answer": string,
  "references": [{ "type": "task" | "sprint" | "activity", "id": string, "title": string }]
}
"answer" — clear, concise answer grounded in the project data above.
"references" — specific tasks, sprints, or activities you referenced in your answer. Use taskId for tasks, sprint name for sprints. Only include items you actually mentioned.`,
  };
}

export function buildRepoDriftPrompt(data: {
  repoName: string;
  recentCommits: Array<{ sha: string; message: string; date: string }>;
  openPRs: Array<{ title: string; state: string }>;
  tasks: Array<{ taskId: string; title: string; status: string; description?: string | null }>;
}): Prompt {
  const commitLines = data.recentCommits
    .slice(0, 30)
    .map((c) => `${c.sha} — ${c.message} (${c.date})`)
    .join('\n');

  const prLines = data.openPRs
    .slice(0, 10)
    .map((pr) => `"${pr.title}" — ${pr.state}`)
    .join('\n');

  const taskLines = data.tasks
    .slice(0, 50)
    .map((t) => `[${t.taskId}] "${t.title}" — ${t.status}${t.description ? `: ${truncate(t.description, 80)}` : ''}`)
    .join('\n');

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Compare this repository's recent activity against its task board to find drift — mismatches between code work and tracked tasks.

Repository: ${userInput('repo', data.repoName)}

Recent commits (${data.recentCommits.length}):
${commitLines || '(none)'}

Open PRs (${data.openPRs.length}):
${prLines || '(none)'}

Task board (${data.tasks.length} tasks):
${taskLines || '(no tasks)'}

Return JSON:
{
  "summary": string,
  "outdatedTasks": [{ "taskId": string, "title": string, "reason": string }],
  "untrackedWork": [{ "description": string, "suggestedTaskTitle": string }],
  "completedButOpen": [{ "taskId": string, "title": string, "evidence": string }]
}
"outdatedTasks" — tasks that reference code/features that have changed significantly since the task was created.
"untrackedWork" — commits or PRs that don't correspond to any tracked task (suggest a task title).
"completedButOpen" — tasks whose work appears done in the repo (matching commits/PRs) but are still marked todo/in_progress.
"summary" — 2-3 sentence overview of repo↔task alignment.`,
  };
}

export function buildTrendAnalysisPrompt(data: {
  projectName: string;
  reports: Array<{ type: string; title: string; data: string; createdAt: string }>;
  period?: string | null;
}): Prompt {
  const reportLines = data.reports
    .slice(0, 20)
    .map((r) => `[${r.createdAt}] ${r.type}: ${r.title}\n${truncate(r.data, 500)}`)
    .join('\n\n');

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Analyze historical trends from these saved reports for a project. Identify patterns in completion rates, velocity, and project health over time.

Project: ${userInput('project', data.projectName)}
Period: ${data.period ?? 'all time'}

Historical reports (${data.reports.length} total, most recent first):
<user_input label="reports">
${reportLines || '(no reports)'}
</user_input>

Return JSON:
{
  "period": string,
  "completionTrend": string,
  "velocityTrend": string,
  "healthTrend": string,
  "insights": string[],
  "recommendations": string[]
}
"completionTrend" — "improving" | "declining" | "stable" with a brief explanation.
"velocityTrend" — "increasing" | "decreasing" | "stable" with a brief explanation.
"healthTrend" — "improving" | "declining" | "stable" with a brief explanation.
"insights" — 3-5 specific observations based on the data.
"recommendations" — 2-4 actionable suggestions to improve the project.`,
  };
}

export function buildBatchCodeGenerationPrompt(data: {
  tasks: Array<{ title: string; description: string; instructions: string }>;
  projectName: string;
  projectDescription?: string | null;
  existingFiles?: Array<{ path: string; language: string; size: number }>;
  styleGuide?: string | null;
  knowledgeBase?: string | null;
}): Prompt {
  const cappedFiles = (data.existingFiles ?? []).slice(0, 15);
  const filesLine = cappedFiles.length > 0
    ? `\nExisting files:\n${cappedFiles.map((f) => `- ${f.path} (${f.language}, ${f.size}B)`).join('\n')}`
    : '';
  const styleGuideLine = data.styleGuide
    ? `\nCoding conventions:\n${userInput('style_guide', truncate(data.styleGuide, 1000))}`
    : '';
  const kbLine = data.knowledgeBase
    ? `\nKnowledge Base:\n${userInput('knowledge_base', truncate(data.knowledgeBase, 800))}`
    : '';

  const taskSections = data.tasks
    .slice(0, 5)
    .map((t, i) => `Task ${i + 1}: ${userInput('title', t.title)}\nDescription: ${userInput('description', truncate(t.description, 200))}\nInstructions: ${userInput('instructions', truncate(t.instructions, 500))}`)
    .join('\n\n');

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate code files to implement ALL of the following tasks in a single cohesive codebase. Organize files logically and avoid duplication between tasks.

Project: ${userInput('project', data.projectName)}${data.projectDescription ? `\nDescription: ${userInput('projectDescription', truncate(data.projectDescription, 400))}` : ''}${filesLine}${styleGuideLine}${kbLine}

${taskSections}

Return JSON:
{
  "files": [{ "path": string, "content": string, "language": string, "description": string }],
  "summary": string,
  "estimatedTokensUsed": number
}
Generate complete, runnable files. Keep total output focused — avoid generating files not directly needed.`,
  };
}
