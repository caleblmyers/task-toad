import { SYSTEM_JSON } from '../aiConfig.js';
import { userInput, type Prompt } from './utils.js';

/**
 * Build a prompt that instructs the AI to generate a complete project scaffold
 * for a given framework template.
 */
export function buildScaffoldPrompt(data: {
  template: string;
  projectName: string;
  projectDescription: string;
  options?: string;
}): Prompt {
  const templateBlock = userInput('template', data.template);
  const projectBlock = userInput('projectName', data.projectName);
  const descBlock = userInput('projectDescription', data.projectDescription);
  const optionsBlock = data.options ? `\nAdditional options: ${userInput('options', data.options)}` : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate a complete project scaffold for the following framework template.

Template: ${templateBlock}
Project name: ${projectBlock}
Project description: ${descBlock}${optionsBlock}

Create the ABSOLUTE MINIMUM scaffold to get a running "hello world" — 3 to 5 files MAXIMUM. Include ONLY:
- Dependency file (package.json, requirements.txt, etc.)
- Single entry point file (under 30 lines)
- .gitignore (one line per entry, common ignores only)

Do NOT include: README, test files, CI configs, Docker files, linter configs, tsconfig, or any config beyond the dependency file. Every file content must be under 40 lines.

Return JSON:
{
  "files": [
    {
      "path": "relative/file/path",
      "content": "full file content",
      "language": "typescript|javascript|json|markdown|etc",
      "description": "what this file does"
    }
  ],
  "summary": "1-2 sentence summary of what was generated"
}`,
  };
}
