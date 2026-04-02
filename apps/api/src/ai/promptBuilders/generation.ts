import {
  userInput,
  truncate,
  MAX_DESCRIPTION_CHARS,
  MAX_PROJECT_DESCRIPTION_CHARS,
  MAX_SIBLING_TITLES,
  MAX_KB_CHARS,
  SYSTEM_JSON,
  SYSTEM_PROSE,
  type Prompt,
} from './utils.js';

// ---------------------------------------------------------------------------
// Code & content generation prompts
// ---------------------------------------------------------------------------

export function buildProjectOptionsPrompt(prompt: string): Prompt {
  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `A user wants to start a project. Their description:
${userInput('prompt', prompt)}

Analyze their description and generate ONE recommended project plan — the best interpretation of what they want to build.

Return a JSON array with exactly 1 object:
[{
  "title": string (3-7 words, the project name),
  "description": string (2-3 sentences: scope summary + key assumptions made)
}]

Guidelines:
- Choose the most practical and complete interpretation of their description
- State any key assumptions you made about scope (e.g. "Assumes web-only, no mobile app")
- If the description is genuinely ambiguous (multiple plausible interpretations), add 1-2 alternatives as additional array items, each representing a meaningfully different scope
- Only add alternatives when the ambiguity is real, not just for variety
- Each alternative should have a clearly different scope, not just a size variation`,
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
  const kbLine = knowledgeBase ? `\nProject Knowledge Base (use for context):\n${userInput('knowledge_base', truncate(knowledgeBase, MAX_KB_CHARS))}` : '';
  const dedupLine = existingTaskTitles && existingTaskTitles.length > 0
    ? `\nIMPORTANT: Do NOT create tasks with the same or very similar titles as these existing tasks:\n${existingTaskTitles.slice(0, 30).join('\n')}`
    : '';
  const taskPlanSchema = `

Return a JSON array of 3–10 epics (NEVER more than 10). Use as few as 3 for simple projects, up to 10 for complex ones. Prefer fewer, well-scoped epics over many trivial ones. Each item:
{
  "title": string,
  "description": string,
  "instructions": string,
  "suggestedTools": [{ "name": string, "category": string, "reason": string }],
  "estimatedHours": number,
  "priority": "low" | "medium" | "high" | "critical",
  "dependsOn": string[],
  "tasks": [{ "title": string, "description": string, "instructions": string, "estimatedHours": number, "priority": "low" | "medium" | "high" | "critical", "acceptanceCriteria": string, "suggestedTools": [{ "name": string, "category": string, "reason": string }], "dependsOn": [{ "title": string, "linkType": "blocks" | "informs" }] }],
  "acceptanceCriteria": string
}
"title" is a short action phrase. "description" is 1–2 sentences. "instructions" is 3–6 sentences of detailed step-by-step guidance for a human or AI agent.
"category" is one of: "ai-model", "code-editor", "design-tool", "database", "cloud-service", "communication", "testing", "other".
List 1–3 tools per epic. Be specific (e.g. "Claude Sonnet", "Figma", "Vercel", "Jest").
"estimatedHours" is a realistic work estimate (e.g. 1, 2, 4, 8, 16). "priority" reflects business impact.
"dependsOn" lists titles of OTHER epics in this same list that must be completed first (empty array if none).
"tasks" is 1–8 implementation tasks that break down this epic. Each task has its own instructions, estimatedHours, priority, acceptanceCriteria, and suggestedTools.
For each task, include a "dependsOn" array of dependencies on OTHER tasks (within the same epic or across epics). Use "blocks" for hard dependencies (must complete first) and "informs" for context dependencies (provides useful context but not strictly required). Example: { "title": "Create API routes", "dependsOn": [{ "title": "Set up database schema", "linkType": "blocks" }] }. Use an empty array if no dependencies.
Keep "instructions" to 2–3 sentences. Keep "acceptanceCriteria" to 3–5 bullet items. Be concise.
"acceptanceCriteria" is a bullet list of testable conditions that define when the epic is complete.`;

  return {
    systemPrompt: SYSTEM_JSON + taskPlanSchema,
    userPrompt: `Break this project into implementation epics.

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
  const kbLine = knowledgeBase ? `\nProject Knowledge Base (use for context):\n${userInput('knowledge_base', truncate(knowledgeBase, MAX_KB_CHARS))}` : '';
  const dedupLine = siblingTitles && siblingTitles.length > 0
    ? `\nIMPORTANT: Do NOT create tasks with the same or very similar titles as these existing sibling tasks:\n${siblingTitles.slice(0, 30).join('\n')}`
    : '';
  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Break this epic into implementation tasks.

Epic: ${userInput('title', taskTitle)}
Epic description: ${userInput('description', truncate(taskDescription, MAX_DESCRIPTION_CHARS))}
Project: ${userInput('project', projectName)}${contextLine}${kbLine}${dedupLine}

Return a JSON array of tasks — as many as needed to fully break down this epic. Typically 2–8, but use your judgment based on complexity. Use the same schema:
{
  "title": string,
  "description": string,
  "instructions": string,
  "suggestedTools": [{ "name": string, "category": string, "reason": string }],
  "estimatedHours": number,
  "priority": "low" | "medium" | "high" | "critical",
  "acceptanceCriteria": string
}`,
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
  repoContext?: Array<{ path: string; language: string; content: string; relevanceReason: string }>;
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
    ? `\nProject Knowledge Base (use for context):\n${userInput('knowledge_base', truncate(data.knowledgeBase, MAX_KB_CHARS))}`
    : '';

  // Separate schema files and type definition files from general repo context
  const schemaPatterns = [/prisma\/.*schema.*\.prisma$/, /schema\.prisma$/, /models\.py$/, /schema\.sql$/];
  const typePatterns = [/\/types\//, /\/interfaces\//, /\.types\.ts$/, /\.d\.ts$/];

  const schemaFiles = (data.repoContext ?? []).filter((f) =>
    schemaPatterns.some((p) => p.test(f.path))
  );
  const typeFiles = (data.repoContext ?? []).filter((f) =>
    typePatterns.some((p) => p.test(f.path)) && !schemaFiles.includes(f)
  );
  const otherRepoFiles = (data.repoContext ?? []).filter(
    (f) => !schemaFiles.includes(f) && !typeFiles.includes(f)
  );

  const schemaConstraintLine = schemaFiles.length > 0
    ? `\nIMPORTANT: The following schema defines the data models for this project. Use EXACTLY these model names, field names, and relations. Do NOT invent new models or rename existing ones.\n${schemaFiles.map((f) => `--- ${f.path} ---\n${f.content}\n---`).join('\n')}`
    : '';

  const typeConstraintLine = typeFiles.length > 0
    ? `\nThe following type definitions are already established. Use these types and extend them as needed rather than creating conflicting definitions.\n${typeFiles.map((f) => `--- ${f.path} ---\n${f.content}\n---`).join('\n')}`
    : '';

  const repoContextLine = otherRepoFiles.length > 0
    ? `\nReference code from the repository (study for patterns, imports, conventions — do NOT regenerate):\n${otherRepoFiles.map((f) => `--- ${f.path} ---\n${f.content}\n---`).join('\n')}`
    : '';

  const hasRepoContext = schemaFiles.length > 0 || typeFiles.length > 0 || otherRepoFiles.length > 0;

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate code files to implement this task.

Task: ${userInput('title', data.taskTitle)}
Description: ${userInput('description', truncate(data.taskDescription, 400))}
Instructions: ${userInput('instructions', truncate(data.taskInstructions, 800))}
Project: ${userInput('project', data.projectName)}
${data.projectDescription ? `Project description: ${userInput('projectDescription', truncate(data.projectDescription, 400))}\n` : ''}${filesLine}${styleGuideLine}${kbLine}${schemaConstraintLine}${typeConstraintLine}${repoContextLine}
${hasRepoContext ? '\nMatch the coding style, import patterns, and naming conventions shown in the reference code and knowledge base. Reuse existing utilities rather than reimplementing them. Use correct relative import paths.' : ''}
Return JSON:
{
  "files": [{ "path": string, "content": string, "language": string, "description": string }],
  "summary": string,
  "estimatedTokensUsed": number,
  "delegationHint": string | null
}
Generate 1–4 files maximum. Each file should be complete and runnable.
Use appropriate file paths relative to the project root.
Keep each file under 150 lines — split larger implementations across files.
Focus on the core implementation. Omit tests, documentation, and config files unless they ARE the task.
If the task is too large, generate the most critical files and set "delegationHint" to suggest how remaining work could be split (e.g. "Consider separate tasks for tests and docs"). Otherwise omit "delegationHint".`,
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
  repoContext?: Array<{ path: string; language: string; content: string; relevanceReason: string }>;
}): Prompt {
  const feedbackLine = data.feedback
    ? `\nFeedback: ${userInput('feedback', data.feedback)}`
    : '';

  const styleGuideLine = data.styleGuide
    ? `\nFollow these project coding conventions:\n${userInput('style_guide', truncate(data.styleGuide, 1000))}`
    : '';

  const repoContextLine = data.repoContext && data.repoContext.length > 0
    ? `\nReference code from the repository:\n${data.repoContext.map((f) => `--- ${f.path} ---\n${f.content}\n---`).join('\n')}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Regenerate ONLY the file at ${userInput('filePath', data.filePath)} for this task.

Task: ${userInput('title', data.taskTitle)}
Description: ${userInput('description', truncate(data.taskDescription, 400))}
Instructions: ${userInput('instructions', truncate(data.taskInstructions, 800))}
Project: ${userInput('project', data.projectName)}${feedbackLine}${styleGuideLine}${repoContextLine}

Original content (for reference):
<user_input label="originalContent">
${truncate(data.originalContent, 2000)}
</user_input>

Return JSON:
{ "path": string, "content": string, "language": string, "description": string }
Generate a complete, runnable file. Incorporate the feedback if provided.${repoContextLine ? ' Match the coding style and import patterns from the reference code.' : ''}`,
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
  projectName?: string;
  projectDescription?: string | null;
  knowledgeBase?: string | null;
  parentTaskTitle?: string | null;
  acceptanceCriteria?: string | null;
  codeSummary?: string | null;
}): Prompt {
  const projectLine = data.projectName
    ? `\nProject: ${userInput('project', data.projectName)}${data.projectDescription ? ` — ${userInput('projectDescription', truncate(data.projectDescription, MAX_PROJECT_DESCRIPTION_CHARS))}` : ''}`
    : '';

  const acLine = data.acceptanceCriteria
    ? `\nAcceptance Criteria:\n${userInput('acceptance_criteria', truncate(data.acceptanceCriteria, 400))}`
    : '';

  const kbLine = data.knowledgeBase
    ? `\nProject Knowledge Base:\n${userInput('knowledge_base', truncate(data.knowledgeBase, MAX_KB_CHARS))}`
    : '';

  const parentLine = data.parentTaskTitle
    ? `\nParent task/epic: ${userInput('parent_task', data.parentTaskTitle)}`
    : '';

  const codeSummaryLine = data.codeSummary
    ? `\nCode generation summary: ${userInput('code_summary', truncate(data.codeSummary, 600))}`
    : '';

  return {
    systemPrompt: SYSTEM_PROSE,
    userPrompt: `Generate a pull request description in markdown for this task.

Task: ${userInput('title', data.taskTitle)}
Description: ${userInput('description', truncate(data.taskDescription, MAX_PROJECT_DESCRIPTION_CHARS))}
Instructions: ${userInput('instructions', truncate(data.taskInstructions, 800))}
Files: ${data.files.map((f) => f.path).join(', ')}${projectLine}${acLine}${parentLine}${codeSummaryLine}${kbLine}

Generate the PR description with these sections:
## Summary — 2-3 sentences explaining what this PR does and why
## Changes — bullet list of files changed with brief description of each
## Context — why this change is needed, referencing the task/epic context
## Testing — how to verify the changes, using acceptance criteria if available

Return ONLY the markdown.`,
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

export function buildCodeReviewPrompt(data: {
  taskTitle: string;
  taskDescription: string;
  taskInstructions?: string;
  acceptanceCriteria?: string;
  diff: string;
  projectName: string;
  repoContext?: Array<{ path: string; language: string; content: string; relevanceReason: string }>;
}): Prompt {
  const instructionsLine = data.taskInstructions
    ? `\nInstructions: ${userInput('instructions', truncate(data.taskInstructions, 800))}`
    : '';
  const acLine = data.acceptanceCriteria
    ? `\nAcceptance Criteria: ${userInput('acceptance_criteria', truncate(data.acceptanceCriteria, 400))}`
    : '';

  const repoContextLine = data.repoContext && data.repoContext.length > 0
    ? `\nSurrounding repository context (base branch):\n${data.repoContext.map((f) => `--- ${f.path} ---\n${f.content}\n---`).join('\n')}`
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
${repoContextLine}
Return JSON:
{
  "summary": string,
  "approved": boolean,
  "comments": [{ "file": string, "line": number | null, "severity": "info" | "warning" | "error", "comment": string }],
  "suggestions": string[]
}
Focus on actionable feedback. Be specific about file paths and line numbers when possible.${repoContextLine ? ' Verify imports reference real files. Check patterns match the surrounding codebase. Flag code that would conflict with existing implementations.' : ''}`,
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
  const kbLine = knowledgeBase ? `\nProject Knowledge Base (use for context):\n${userInput('knowledge_base', truncate(knowledgeBase, MAX_KB_CHARS))}` : '';

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
  "tasks": [{ "title": string, "description": string, "instructions": string, "estimatedHours": number, "priority": "low" | "medium" | "high" | "critical", "acceptanceCriteria": string, "suggestedTools": [{ "name": string, "category": string, "reason": string }] }]
}
"instructions" should be 4–8 sentences of specific, actionable steps.
"category" is one of: "ai-model", "code-editor", "design-tool", "database", "cloud-service", "communication", "testing", "other".
"estimatedHours" is a realistic work estimate (e.g. 1, 2, 4, 8). "priority" reflects business impact.
"dependsOn" lists titles from the "Other tasks" list that must be done before this one (empty array if none or no other tasks listed).
"tasks" is 2–6 implementation tasks that break down this item. Each task has its own instructions, estimatedHours, priority, acceptanceCriteria, and suggestedTools.`,
  };
}
