import type { PrismaClient } from '@prisma/client';

export type ActionType = 'generate_code' | 'create_pr' | 'write_docs' | 'manual_step';

export interface ActionContext {
  action: { id: string; actionType: string; config: string; label: string };
  task: { taskId: string; title: string; description: string | null; instructions: string | null; projectId: string };
  project: { projectId: string; name: string; description: string | null; knowledgeBase: string | null };
  apiKey: string;
  prisma: PrismaClient;
  previousResults: Map<string, unknown>; // actionId → parsed result from earlier steps
}

export interface ActionResult {
  success: boolean;
  data: Record<string, unknown>;
}

export interface ActionExecutor {
  type: ActionType;
  execute(ctx: ActionContext): Promise<ActionResult>;
}
