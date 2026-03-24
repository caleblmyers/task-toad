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

Create all the files needed for a production-ready starter project using this template. Include:
- Package configuration (package.json, tsconfig.json, etc.)
- Entry point files
- Basic project structure with source directories
- Configuration files (.gitignore, .eslintrc, etc.)
- A README.md with setup instructions

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
