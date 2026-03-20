import { SYSTEM_JSON, type Prompt } from './utils.js';

interface EntryTitle {
  id: string;
  title: string;
  category: string;
}

export function buildKnowledgeRetrievalPrompt(
  taskContext: string,
  entries: EntryTitle[]
): Prompt {
  const entryList = entries
    .map(e => `- ID: "${e.id}" | Title: "${e.title}" | Category: ${e.category}`)
    .join('\n');

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Given a task context and a list of knowledge base entries, select the 5–8 most relevant entries that would help an AI agent understand and complete the task.

Task context:
${taskContext}

Available knowledge entries:
${entryList}

Return JSON: { "selectedEntryIds": string[] }
Select 5–8 entry IDs that are most relevant to the task. If fewer than 5 are relevant, select only the relevant ones.`,
  };
}
