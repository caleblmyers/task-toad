import { SYSTEM_JSON, SYSTEM_PROSE } from '../aiConfig.js';

// ---------------------------------------------------------------------------
// Injection defense — wraps user-controlled text in delimiter tags
// ---------------------------------------------------------------------------

export function userInput(label: string, value: string): string {
  return `<user_input label=${JSON.stringify(label)}>${value}</user_input>`;
}

// ---------------------------------------------------------------------------
// Context compression — truncate verbose fields before injecting into prompts
// ---------------------------------------------------------------------------

export const MAX_DESCRIPTION_CHARS = 200;
export const MAX_PROJECT_DESCRIPTION_CHARS = 400;
export const MAX_SIBLING_TITLES = 15;
export const MAX_KB_CHARS = 3000;

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
}

export function groupTasksByStatus(
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

export interface Prompt {
  systemPrompt: string;
  userPrompt: string;
}

// Re-export AI config constants for convenience
export { SYSTEM_JSON, SYSTEM_PROSE };
