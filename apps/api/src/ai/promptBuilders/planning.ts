import {
  userInput,
  truncate,
  MAX_PROJECT_DESCRIPTION_CHARS,
  MAX_KB_CHARS,
  SYSTEM_JSON,
  type Prompt,
} from './utils.js';

// ---------------------------------------------------------------------------
// Sprint & task planning prompts
// ---------------------------------------------------------------------------

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
    ? `\nKnowledge Base:\n${userInput('knowledge_base', truncate(data.knowledgeBase, MAX_KB_CHARS))}`
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

export function buildPlanTaskActionsPrompt(data: {
  taskTitle: string;
  taskDescription: string;
  taskInstructions: string;
  acceptanceCriteria?: string | null;
  suggestedTools?: string | null;
  projectName: string;
  projectDescription?: string | null;
  hasGitHubRepo: boolean;
  availableActionTypes: string[];
}): Prompt {
  const acLine = data.acceptanceCriteria
    ? `\nAcceptance Criteria: ${userInput('acceptance_criteria', truncate(data.acceptanceCriteria, 400))}`
    : '';
  const toolsLine = data.suggestedTools
    ? `\nSuggested Tools: ${userInput('suggested_tools', data.suggestedTools)}`
    : '';
  const repoLine = data.hasGitHubRepo
    ? '\nThis project has a connected GitHub repository, so create_pr and review_pr actions are available after code generation.'
    : '\nNo GitHub repo is connected — do not include create_pr or review_pr actions.';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Analyze this task and create an ordered action plan to complete it. Each action should be a concrete step.

Task: ${userInput('title', data.taskTitle)}
Description: ${userInput('description', truncate(data.taskDescription, 400))}
Instructions: ${userInput('instructions', truncate(data.taskInstructions, 800))}${acLine}${toolsLine}
Project: ${userInput('project', data.projectName)}
${data.projectDescription ? `Project description: ${userInput('projectDescription', truncate(data.projectDescription, 400))}` : ''}${repoLine}

Available action types: ${data.availableActionTypes.join(', ')}

Action type guide:
- generate_code: Generate implementation code files. Config: { "styleGuide"?: string }
- create_pr: Create a GitHub pull request from previously generated code. Config: { "sourceActionId": "<id of generate_code action>" }. ONLY use if GitHub repo is connected.
- review_pr: Review the PR created by a prior create_pr action. Config: { "sourcePRActionId": "<id of create_pr action>" }. ONLY use after create_pr.
- write_docs: Generate documentation (README, API docs, changelog). Config: { "docType": "readme" | "api-docs" | "changelog" }
- manual_step: A step the user must complete manually. Config: { "description": string, "checklist"?: string[] }

Rules:
1. Order actions logically — code gen before PR creation, setup before implementation.
2. Use manual_step for anything that can't be automated (account setup, API key configuration, manual testing, deployment).
3. Set requiresApproval to true for actions that modify external systems (create_pr) and false for safe actions (generate_code, write_docs, review_pr).
4. Keep the plan focused — typically 2–6 actions. Don't over-plan.
5. create_pr must always reference a prior generate_code action via sourceActionId (use a placeholder ID like "action_0" referring to the action at index 0).
6. If the plan includes create_pr, always follow it with review_pr. review_pr should have requiresApproval: false.

Return JSON:
{
  "actions": [{
    "actionType": string,
    "label": string,
    "config": object,
    "requiresApproval": boolean,
    "reasoning": string
  }],
  "summary": string
}
"summary" — 1-2 sentence overview of what this plan accomplishes.
"label" — short human-readable description of each action (e.g. "Generate authentication middleware").
"reasoning" — 1 sentence explaining why this action is needed.`,
  };
}
