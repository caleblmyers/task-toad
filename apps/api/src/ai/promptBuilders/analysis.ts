import {
  userInput,
  truncate,
  groupTasksByStatus,
  MAX_PROJECT_DESCRIPTION_CHARS,
  SYSTEM_JSON,
  SYSTEM_PROSE,
  type Prompt,
} from './utils.js';

// ---------------------------------------------------------------------------
// Analysis & insights prompts
// ---------------------------------------------------------------------------

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
Extract all clear, actionable items — there is no fixed limit. Do not include discussion points or FYIs.`,
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
Generate as many tasks as the issue warrants. Simple bugs may need 1 task; large features may need up to 12. Each task should be a concrete, actionable work item.`,
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
    userPrompt: `Analyze this GitHub repository and generate a project description, repo profile, and initial task breakdown for improving and maintaining the codebase.

Repository: ${userInput('repo', data.repoName)}${data.repoDescription ? `\nDescription: ${userInput('description', data.repoDescription)}` : ''}
Languages: ${data.languages.join(', ')}

File tree (${data.fileTree.length} files):
${filesSection}${readmeSection}${packageSection}

Return JSON:
{
  "projectDescription": string,
  "repoProfile": string,
  "tasks": [{
    "title": string,
    "description": string,
    "priority": "low" | "medium" | "high" | "critical",
    "estimatedHours": number,
    "taskType": "epic" | "story" | "task"
  }]
}
"projectDescription" — 2-3 sentences summarizing the project purpose and tech stack.
"repoProfile" — A markdown-formatted knowledge base (1500-2500 chars) covering:
  - Architecture overview (directory structure, key modules, entry points)
  - Coding conventions (naming, patterns, error handling approach)
  - Key utilities and helpers (path + what they do)
  - Import patterns (absolute vs relative, path aliases, barrel exports)
  - Tech stack details (frameworks, libraries, build tools)
  - Testing patterns (framework, file naming, test location)
This profile will be injected into future AI prompts to help the AI write code that matches this repo's patterns.
Generate tasks covering: setup/documentation, code quality, testing, features, and maintenance. Include as many as the codebase warrants — small repos may need 5–8; large repos with many concerns may need up to 20.
Tasks should be specific to THIS codebase — reference actual files, technologies, and patterns found.`,
  };
}

export function buildRepoProfilePrompt(data: {
  repoName: string;
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
    systemPrompt: SYSTEM_PROSE,
    userPrompt: `Analyze this GitHub repository and generate a repo profile — a structured knowledge base that will be injected into future AI prompts to help the AI write code matching this repo's patterns.

Repository: ${userInput('repo', data.repoName)}
Languages: ${data.languages.join(', ')}

File tree (${data.fileTree.length} files):
${filesSection}${readmeSection}${packageSection}

Generate a markdown-formatted profile (1500-2500 chars) covering:
- **Architecture overview** — directory structure, key modules, entry points
- **Coding conventions** — naming, patterns, error handling approach
- **Key utilities and helpers** — path + what they do (e.g. "src/utils/db.ts — database connection helper")
- **Import patterns** — absolute vs relative, path aliases, barrel exports
- **Tech stack** — frameworks, libraries, build tools with versions if visible
- **Testing patterns** — framework, file naming, test location

Be specific to THIS codebase — reference actual files, directories, and patterns found. Return ONLY the markdown profile text.`,
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
