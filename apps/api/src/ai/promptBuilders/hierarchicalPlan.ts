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

export function buildHierarchicalPlanPrompt(data: {
  projectName: string;
  projectDescription: string;
  prompt: string;
  knowledgeBase?: string | null;
  existingTaskTitles?: string[];
}): Prompt {
  const kbLine = data.knowledgeBase
    ? `\nKnowledge Base:\n${userInput('knowledge_base', truncate(data.knowledgeBase, MAX_KB_CHARS))}`
    : '';

  const dedupLine = data.existingTaskTitles && data.existingTaskTitles.length > 0
    ? `\nExisting task titles (do NOT duplicate these):\n${data.existingTaskTitles.map((t) => `- ${t}`).join('\n')}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate a hierarchical project plan with epics (high-level features), tasks (implementable work units), and subtasks (atomic steps).

Project: ${userInput('name', data.projectName)}
Description: ${userInput('description', truncate(data.projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}${kbLine}${dedupLine}

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
10. Each task should be scoped so that code generation produces 3–8 files maximum. If a task would require generating more than 8 files, break it into smaller tasks. For example, "Set up API framework" should be split into "Create data models", "Add CRUD API routes", "Add auth middleware" as separate tasks. Each task should produce one focused, reviewable PR.

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
