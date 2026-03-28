import {
  userInput,
  SYSTEM_JSON,
  type Prompt,
} from './utils.js';

// ---------------------------------------------------------------------------
// Project option generation — single best recommendation
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
