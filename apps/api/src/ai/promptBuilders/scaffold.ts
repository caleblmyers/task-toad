import { SYSTEM_JSON } from '../aiConfig.js';
import { userInput, type Prompt } from './utils.js';

// ---------------------------------------------------------------------------
// Structured scaffold config (replaces template string)
// ---------------------------------------------------------------------------

export interface ScaffoldConfig {
  framework: string;
  language: string;
  packages: string[];
  projectType: string;
}

/**
 * Build a prompt that instructs the AI to generate a complete project scaffold
 * for a given structured stack configuration.
 */
export function buildScaffoldPrompt(data: {
  config: ScaffoldConfig;
  projectName: string;
  projectDescription: string;
  options?: string;
}): Prompt {
  const { config } = data;
  const stackDescription = [
    `Framework: ${config.framework}`,
    `Language: ${config.language}`,
    `Project type: ${config.projectType}`,
    config.packages.length > 0 ? `Key packages: ${config.packages.join(', ')}` : '',
  ].filter(Boolean).join('\n');

  const projectBlock = userInput('projectName', data.projectName);
  const descBlock = userInput('projectDescription', data.projectDescription);
  const optionsBlock = data.options ? `\nAdditional options: ${userInput('options', data.options)}` : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Generate a project scaffold for the following stack configuration. The scaffold must produce a working app that starts with a single install + dev command.

Stack:
${stackDescription}

Project name: ${projectBlock}
Project description: ${descBlock}${optionsBlock}

**Requirements:**
1. The scaffold must be a COMPLETE, BUILDABLE project. After \`npm install && npm run dev\` (or equivalent), the dev server must start without errors.
2. Include every config file the framework requires to run — tsconfig.json, postcss.config.js/mjs, next.config.js/ts, tailwind.config.js/ts, etc. Do not skip config files.
3. Include a minimal but functional entry point — not just "Coming Soon" text, but a basic working page that reflects the project's purpose (e.g., a layout with navigation placeholder, a simple data display, or an API health endpoint).
4. Keep it lean — typically 8-15 files. No test files, CI configs, Docker files, or deployment configs.

**Required files:**
- Dependency file (package.json, requirements.txt, etc.) with all dependencies needed to run
- All framework config files (tsconfig, postcss, next.config, tailwind.config, etc.)
- .gitignore with standard ignores for the framework
- Entry point / main page with basic working UI
- CLAUDE.md at repo root with:
  - Project name and one-line description
  - Development commands (install, dev, test, build)
  - Tech stack and key dependencies
  - Directory structure overview
  Keep CLAUDE.md concise (under 30 lines).

**Do NOT include:** README, test files, CI/CD configs, Docker files, deployment configs, .env files with secrets.

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

// ---------------------------------------------------------------------------
// AI stack recommendation prompt
// ---------------------------------------------------------------------------

export interface RecommendStackInput {
  projectName: string;
  projectDescription: string;
  additionalContext?: string;
}

/**
 * Build a prompt that instructs the AI to recommend a tech stack for a project.
 */
export function buildRecommendStackPrompt(data: RecommendStackInput): Prompt {
  const projectBlock = userInput('projectName', data.projectName);
  const descBlock = userInput('projectDescription', data.projectDescription);
  const contextBlock = data.additionalContext
    ? `\nAdditional context: ${userInput('additionalContext', data.additionalContext)}`
    : '';

  return {
    systemPrompt: SYSTEM_JSON,
    userPrompt: `Analyze the following project and recommend the best tech stack for it.

Project name: ${projectBlock}
Project description: ${descBlock}${contextBlock}

Return a primary recommendation with rationale, plus 2-3 alternatives. Be practical and opinionated — don't list every possible option. Pick stacks that are well-suited for this specific project.

Each option must include a structured scaffold config with: framework, language, key packages, and project type (full-stack, api-only, or frontend-only).

Return JSON:
{
  "recommended": {
    "label": "Short label (e.g. 'Next.js + TypeScript')",
    "description": "One sentence describing what this stack includes",
    "rationale": "Why this is the best fit for this project",
    "config": {
      "framework": "e.g. nextjs, express, django",
      "language": "e.g. typescript, python, go",
      "packages": ["key-package-1", "key-package-2"],
      "projectType": "full-stack|api-only|frontend-only"
    }
  },
  "alternatives": [
    {
      "label": "...",
      "description": "...",
      "rationale": "...",
      "config": { "framework": "...", "language": "...", "packages": [...], "projectType": "..." }
    }
  ]
}`,
  };
}
