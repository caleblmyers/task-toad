import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { generateCode as aiGenerateCode } from '../../ai/aiService.js';
import { getProjectRepo, fetchProjectFileTree } from '../../github/index.js';

interface GenerateCodeConfig {
  styleGuide?: string;
}

export const generateCodeExecutor: ActionExecutor = {
  type: 'generate_code',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, project, apiKey } = ctx;

    if (!task.instructions) {
      return { success: false, data: { error: 'Task has no instructions' } };
    }

    // Fetch project file tree for context if repo is connected
    let projectFiles: Array<{ path: string; language: string; size: number }> | undefined;
    const repo = await getProjectRepo(task.projectId);
    if (repo) {
      projectFiles = await fetchProjectFileTree(repo).catch(() => undefined);
    }

    const config: GenerateCodeConfig = JSON.parse(ctx.action.config || '{}');

    const result = await aiGenerateCode(
      apiKey,
      task.title,
      task.description ?? '',
      task.instructions,
      project.name,
      project.description ?? '',
      projectFiles,
      config.styleGuide ?? null,
      project.knowledgeBase,
    );

    return {
      success: true,
      data: {
        files: result.files,
        summary: result.summary,
        estimatedTokensUsed: result.estimatedTokensUsed,
      },
    };
  },
};
