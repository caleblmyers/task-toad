import { userInput, truncate, SYSTEM_JSON, MAX_KB_CHARS, MAX_SIBLING_TITLES } from './utils.js';
import type { Prompt } from './utils.js';

export function buildGenerateTaskInsightsPrompt(data: {
  taskTitle: string;
  taskInstructions: string;
  generatedFiles: Array<{ path: string; language?: string }>;
  codeSummary: string;
  siblingTaskTitles: string[];
  projectName: string;
  knowledgeBase?: string | null;
}): Prompt {
  const fileList = data.generatedFiles
    .map((f) => `- ${f.path}${f.language ? ` (${f.language})` : ''}`)
    .join('\n');

  const siblings = data.siblingTaskTitles
    .slice(0, MAX_SIBLING_TITLES)
    .map((t, i) => `${i + 1}. ${t}`)
    .join('\n');

  const kbSection = data.knowledgeBase
    ? `\n\n[Knowledge Base]\n${truncate(data.knowledgeBase, MAX_KB_CHARS)}`
    : '';

  const userPrompt = `Analyze the code that was just generated for a task and produce insights for the team.

[Project]
${userInput('projectName', data.projectName)}

[Completed Task]
Title: ${userInput('taskTitle', data.taskTitle)}
Instructions: ${userInput('taskInstructions', data.taskInstructions)}

[Generated Files]
${fileList}

[Code Summary]
${userInput('codeSummary', data.codeSummary)}

[Sibling Tasks (not yet completed)]
${siblings || '(none)'}${kbSection}

[Instructions]
Produce a JSON object with an "insights" array (max 10 items). Each insight has:
- "type": one of "discovery" (new patterns/approaches found), "warning" (potential issues for sibling tasks), "pattern" (reusable conventions established)
- "content": concise description of the insight
- "targetTaskTitle": (optional) the exact title of a sibling task this insight applies to. Omit if the insight is general.

Focus on actionable insights that help sibling tasks succeed. Prefer warnings and patterns over discoveries. Be specific — reference file paths and conventions from the generated code.`;

  return { systemPrompt: SYSTEM_JSON, userPrompt };
}
