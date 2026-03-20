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
5. Tasks and epics can have "dependsOn" — an array of { "title": string, "linkType": "blocks" | "informs" } objects referencing OTHER epic/task titles (not self, not own children).
   - "blocks" means the referenced item must complete before this one can start.
   - "informs" means the referenced item provides useful context but isn't blocking.
6. Subtasks have: title, description, estimatedHours, priority, acceptanceCriteria.
7. Each node should have "acceptanceCriteria" — a brief description of what "done" looks like.

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
    "dependsOn": [{ "title": string, "linkType": "blocks" | "informs" }],
    "tasks": [{
      "title": string,
      "description": string,
      "instructions": string,
      "estimatedHours": number,
      "priority": "low" | "medium" | "high" | "critical",
      "acceptanceCriteria": string,
      "autoComplete": boolean,
      "dependsOn": [{ "title": string, "linkType": "blocks" | "informs" }],
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
