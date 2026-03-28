import type { PrismaClient } from '@prisma/client';
import type { GitHubRepoLink } from '../github/githubTypes.js';

export type ActionType = 'generate_code' | 'create_pr' | 'review_pr' | 'write_docs' | 'manual_step' | 'monitor_ci' | 'fix_ci' | 'fix_review' | 'merge_pr' | 'verify_build';

export interface ActionContext {
  action: { id: string; actionType: string; config: string; label: string };
  planId: string; // the action plan ID (needed for scheduling follow-up jobs)
  task: { taskId: string; title: string; description: string | null; instructions: string | null; projectId: string };
  project: { projectId: string; name: string; description: string | null; knowledgeBase: string | null };
  knowledgeContext: string | null;
  repo: GitHubRepoLink | null; // project's connected GitHub repo
  plan: { id: string; branchName: string | null; headOid: string | null }; // plan's branch state
  apiKey: string;
  orgId: string;
  userId: string;
  prisma: PrismaClient;
  previousResults: Map<string, unknown>; // actionId → parsed result from earlier steps
  previousStepContext?: string; // Formatted summary of completed actions in this plan
  upstreamTaskContext?: string; // Completion summaries from upstream dependency tasks
  failureContext?: string; // Context from previous failed attempt of this action
  userGitHubToken?: string; // User's GitHub OAuth token for personal account operations
  signal?: AbortSignal; // cancellation signal — check in long-running actions
}

export interface ActionResult {
  success: boolean;
  data: Record<string, unknown>;
}

export interface ActionExecutor {
  type: ActionType;
  execute(ctx: ActionContext): Promise<ActionResult>;
}
