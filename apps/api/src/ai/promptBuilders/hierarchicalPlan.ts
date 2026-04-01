import {
  userInput,
  truncate,
  MAX_PROJECT_DESCRIPTION_CHARS,
  MAX_KB_CHARS,
  SYSTEM_JSON,
  type Prompt,
} from './utils.js';

// ---------------------------------------------------------------------------
// Hierarchical plan generation prompt (epics → tasks → subtasks)
// ---------------------------------------------------------------------------

export interface ExecutionHistoryEntry {
  title: string;
  status: string;
  estimatedHours: number | null;
  completionSummary: string | null;
  taskType: string | null;
}

const MAX_SUMMARY_CHARS = 200;

function formatExecutionHistory(history: ExecutionHistoryEntry[]): string {
  if (history.length === 0) return '';

  const lines = history.map((t) => {
    const est = t.estimatedHours != null ? `, estimated ${t.estimatedHours}h` : '';
    const summary = t.completionSummary
      ? ` — Summary: ${t.completionSummary.length > MAX_SUMMARY_CHARS ? t.completionSummary.slice(0, MAX_SUMMARY_CHARS) + '…' : t.completionSummary}`
      : '';
    return `- "${t.title}" (${t.status}${est})${summary}`;
  });

  return `\n## Recent execution history for this project
The following tasks were recently completed or failed. Use this to calibrate your estimates and avoid repeating planning mistakes.

${lines.join('\n')}`;
}

export function buildHierarchicalPlanPrompt(data: {
  projectName: string;
  projectDescription: string;
  prompt: string;
  knowledgeBase?: string | null;
  existingTaskTitles?: string[];
  executionHistory?: ExecutionHistoryEntry[];
}): Prompt {
  const kbLine = data.knowledgeBase
    ? `\nKnowledge Base:\n${userInput('knowledge_base', truncate(data.knowledgeBase, MAX_KB_CHARS))}`
    : '';

  const dedupLine = data.existingTaskTitles && data.existingTaskTitles.length > 0
    ? `\nExisting task titles (do NOT duplicate these):\n${data.existingTaskTitles.map((t) => `- ${t}`).join('\n')}`
    : '';

  const historyLine = data.executionHistory && data.executionHistory.length > 0
    ? formatExecutionHistory(data.executionHistory)
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate a hierarchical project plan with epics (high-level features), tasks (implementable work units), and subtasks (atomic steps).

Project: ${userInput('name', data.projectName)}
Description: ${userInput('description', truncate(data.projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}${kbLine}${dedupLine}${historyLine}

User prompt:
${userInput('prompt', data.prompt)}

Structure rules:
1. Return 1–10 epics. Each epic has 1–8 tasks. Each task has 0–4 subtasks.
2. Every node needs a title, description, estimatedHours, and priority (low/medium/high/critical).
3. Tasks and epics can have "instructions" — implementation guidance for developers.
4. Tasks can have "autoComplete: true" to mark them for automated execution.
5. Tasks and epics can have "dependsOn" — an array of { "title": string, "linkType": "blocks" | "informs", "reason": string } objects referencing OTHER epic/task titles (not self, not own children).
   - "blocks" means the referenced item must complete before this one can start (e.g., "Set up database" blocks "Create API endpoints").
   - "informs" means the referenced item provides useful context but isn't blocking.
   - "reason" explains why this dependency exists (e.g., "API endpoints need database tables to query against").
   - Only add dependencies that are genuinely necessary — don't over-constrain the plan.
6. Subtasks have: title, description, estimatedHours, priority, acceptanceCriteria.
7. Each node should have "acceptanceCriteria" — a brief description of what "done" looks like.
8. Task instructions must describe WHAT to build, not which specific vendor or service to use. Never prescribe specific deployment platforms (Vercel, Railway, Heroku, AWS), specific CI providers, or specific third-party services. Instead describe the capability needed (e.g., "add deployment config files and health check endpoint" not "configure Vercel deployment"). The user chooses their own infrastructure.
9. Do NOT create tasks for deployment, hosting setup, CI/CD pipeline configuration, or infrastructure provisioning. Focus on application code, features, and configuration files that live in the repo.

Estimation guidelines:
estimatedHours should reflect realistic AI agent execution time, not human development time.
Calibration:
- Simple config/setup tasks: 0.5-1h
- Single-file feature with tests: 1-2h
- Multi-file feature touching 3+ files: 2-4h
- Complex feature with new schema + API + UI: 4-8h
- Large refactor or migration: 8-16h
Be conservative — overestimates are better than underestimates for planning.
Include buffer for AI retry attempts and review cycles.
10. Each task should be scoped so that code generation produces 3–8 files maximum. If a task would require generating more than 8 files, break it into smaller tasks. For example, "Set up API framework" should be split into "Create data models", "Add CRUD API routes", "Add auth middleware" as separate tasks. Each task should produce one focused, reviewable PR.
11. Tasks that involve choosing between technologies, services, or approaches should use "taskKind": "decision" with an "options" array of 2–4 choices. Examples:
    - "Set up authentication" → decision with options: Auth0, in-house JWT, Clerk
    - "Choose database" → decision with options: PostgreSQL, MySQL, MongoDB
    - "Select hosting" → decision with options: Vercel, Railway, AWS
    Mark your recommendation with "recommended": true, but don't assume the user will pick it.
    Implementation tasks use "taskKind": "implementation" (default) — they have clear, opinionated instructions and no options.

Return JSON:
{
  "epics": [{
    "title": string,
    "description": string,
    "instructions": string,
    "estimatedHours": number,
    "priority": "low" | "medium" | "high" | "critical",
    "acceptanceCriteria": string,
    "autoComplete": boolean,
    "dependsOn": [{ "title": string, "linkType": "blocks" | "informs", "reason": string }],
    "tasks": [{
      "title": string,
      "description": string,
      "instructions": string,
      "estimatedHours": number,
      "priority": "low" | "medium" | "high" | "critical",
      "acceptanceCriteria": string,
      "autoComplete": boolean,
      "taskKind": "implementation" | "decision",
      "options": [{ "label": string, "description": string, "recommended": boolean }],
      "dependsOn": [{ "title": string, "linkType": "blocks" | "informs", "reason": string }],
      "subtasks": [{
        "title": string,
        "description": string,
        "estimatedHours": number,
        "priority": "low" | "medium" | "high" | "critical",
        "acceptanceCriteria": string
      }]
    }]
  }]
}`,
  };
}
