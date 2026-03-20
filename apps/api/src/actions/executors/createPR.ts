import type { ActionExecutor, ActionContext, ActionResult } from '../types.js';
import { createPullRequestFromTask } from '../../github/githubService.js';

interface CreatePRConfig {
  sourceActionId: string; // ID of the generate_code action whose result contains files
}

export const createPRExecutor: ActionExecutor = {
  type: 'create_pr',

  async execute(ctx: ActionContext): Promise<ActionResult> {
    const { task, apiKey, previousResults, project, knowledgeContext } = ctx;
    const config: CreatePRConfig = JSON.parse(ctx.action.config || '{}');

    // Get files from a previous generate_code action result
    const sourceResult = previousResults.get(config.sourceActionId) as
      | { files?: Array<{ path: string; content: string }>; summary?: string }
      | undefined;

    if (!sourceResult?.files || sourceResult.files.length === 0) {
      return { success: false, data: { error: 'No files from source action to create PR from' } };
    }

    // Fetch parent task title and acceptance criteria for richer PR context
    const taskWithContext = await ctx.prisma.task.findUnique({
      where: { taskId: task.taskId },
      select: {
        acceptanceCriteria: true,
        parentTask: { select: { title: true } },
      },
    });

    const result = await createPullRequestFromTask({
      projectId: task.projectId,
      taskId: task.taskId,
      files: sourceResult.files,
      apiKey,
      enrichContext: {
        knowledgeContext,
        projectName: project.name,
        projectDescription: project.description,
        parentTaskTitle: taskWithContext?.parentTask?.title ?? null,
        acceptanceCriteria: taskWithContext?.acceptanceCriteria ?? null,
        codeSummary: sourceResult.summary ?? null,
      },
    });

    return {
      success: true,
      data: { url: result.url, number: result.number, branch: result.title },
    };
  },
};
