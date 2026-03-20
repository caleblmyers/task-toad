import {
  userInput,
  truncate,
  MAX_PROJECT_DESCRIPTION_CHARS,
  MAX_KB_CHARS,
  SYSTEM_JSON,
  type Prompt,
} from './utils.js';

export function buildManualTaskSpecPrompt(data: {
  taskTitle: string;
  taskDescription: string;
  taskInstructions: string;
  projectName: string;
  projectDescription: string;
  knowledgeBase?: string | null;
  repoFiles?: Array<{ path: string; language: string }>;
  acceptanceCriteria?: string | null;
}): Prompt {
  const kbLine = data.knowledgeBase
    ? `\nProject Knowledge Base:\n${userInput('knowledge_base', truncate(data.knowledgeBase, MAX_KB_CHARS))}`
    : '';
  const repoLine = data.repoFiles && data.repoFiles.length > 0
    ? `\nRepository files:\n${data.repoFiles.slice(0, 50).map((f) => `- ${f.path} (${f.language})`).join('\n')}`
    : '';
  const acLine = data.acceptanceCriteria
    ? `\nAcceptance Criteria: ${userInput('acceptance_criteria', data.acceptanceCriteria)}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate a detailed implementation specification for this task.

Project: ${userInput('project_name', data.projectName)}
Project Description: ${userInput('project_description', truncate(data.projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}

Task: ${userInput('task_title', data.taskTitle)}
Description: ${userInput('task_description', data.taskDescription)}
Instructions: ${userInput('task_instructions', data.taskInstructions)}${acLine}${kbLine}${repoLine}

Return JSON:
{
  "filesToChange": [{ "path": "string", "action": "create" | "modify" | "delete", "description": "what to do in this file" }],
  "approach": ["step 1", "step 2", ...],
  "codeSnippets": [{ "file": "path", "language": "ts", "code": "snippet", "explanation": "why" }],
  "testingNotes": "how to verify",
  "dependencies": ["package-name"]
}

Rules:
- filesToChange: max 10 files. List the most important files to create or modify.
- approach: 1-8 clear, actionable steps.
- codeSnippets: max 5. Show key implementation details, not boilerplate.
- testingNotes: concise verification strategy.
- dependencies: only external packages needed (empty array if none).`,
  };
}
