import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──

const mockCallAIStructured = vi.fn();
vi.mock('../../../ai/aiClient.js', () => ({
  callAIStructured: (...args: unknown[]) => mockCallAIStructured(...args),
}));

const mockCommitFiles = vi.fn();
vi.mock('../../../github/githubCommitService.js', () => ({
  commitFiles: (...args: unknown[]) => mockCommitFiles(...args),
}));

const mockGetPullRequestFiles = vi.fn();
vi.mock('../../../github/githubPullRequestService.js', () => ({
  getPullRequestFiles: (...args: unknown[]) => mockGetPullRequestFiles(...args),
}));

vi.mock('../../../utils/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { fixReviewExecutor } from '../fixReview.js';
import type { ActionContext } from '../../types.js';

// ── Helpers ──

function buildContext(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    action: {
      id: 'action-1',
      actionType: 'fix_review',
      config: JSON.stringify({ sourceReviewActionId: 'review-action-1' }),
      label: 'Fix review',
    },
    planId: 'plan-1',
    task: {
      taskId: 'task-1',
      title: 'Implement feature X',
      description: 'A test task',
      instructions: 'Build it well',
      projectId: 'project-1',
    },
    project: {
      projectId: 'project-1',
      name: 'Test Project',
      description: 'A test project',
      knowledgeBase: null,
    },
    knowledgeContext: null,
    repo: {
      repositoryId: 'repo-1',
      repositoryName: 'test-repo',
      repositoryOwner: 'test-owner',
      installationId: 'install-1',
      defaultBranch: 'main',
    },
    plan: { id: 'plan-1', branchName: 'feature/x', headOid: 'abc123' },
    apiKey: 'test-key',
    orgId: 'org-1',
    userId: 'user-1',
    prisma: {
      project: { findUnique: vi.fn() },
      task: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
      taskDependency: { create: vi.fn() },
    } as unknown as ActionContext['prisma'],
    previousResults: new Map(),
    ...overrides,
  };
}

const defaultAIResponse = {
  parsed: {
    fixes: [
      { path: 'src/index.ts', content: 'fixed content', description: 'Fixed issue' },
    ],
    commitMessage: 'fix: address review comments',
    deferredIssues: [],
    summary: 'Fixed the review comments',
  },
};

// ── Tests ──

describe('fixReviewExecutor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('approved review skip', () => {
    it('returns skipped when review has approved: true (nested structure)', async () => {
      const ctx = buildContext();
      ctx.previousResults.set('review-action-1', {
        review: { approved: true, summary: 'Looks good', comments: [], suggestions: [] },
        approved: true,
        prNumber: 42,
      });

      const result = await fixReviewExecutor.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.data.skipped).toBe(true);
      expect(mockCallAIStructured).not.toHaveBeenCalled();
    });

    it('returns skipped when review has approved: true (direct structure)', async () => {
      const ctx = buildContext();
      ctx.previousResults.set('review-action-1', {
        approved: true,
        summary: 'All good',
        comments: [],
        suggestions: [],
      });

      const result = await fixReviewExecutor.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.data.skipped).toBe(true);
      expect(mockCallAIStructured).not.toHaveBeenCalled();
    });
  });

  describe('missing review result', () => {
    it('returns failure when sourceReviewActionId has no matching result', async () => {
      const ctx = buildContext();
      // previousResults is empty — no review-action-1 entry

      const result = await fixReviewExecutor.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('No review result found');
    });
  });

  describe('AI fixes with source code context', () => {
    it('fetches PR files and includes source code in AI prompt', async () => {
      const ctx = buildContext();
      ctx.previousResults.set('review-action-1', {
        review: {
          approved: false,
          summary: 'Needs fixes',
          comments: [{ file: 'src/index.ts', line: 10, severity: 'error', comment: 'Fix this' }],
          suggestions: [],
        },
        approved: false,
        prNumber: 42,
      });

      const prisma = ctx.prisma as unknown as {
        project: { findUnique: ReturnType<typeof vi.fn> };
        task: { findUnique: ReturnType<typeof vi.fn> };
      };
      prisma.project.findUnique.mockResolvedValue({
        githubInstallationId: 'install-1',
        githubRepositoryOwner: 'test-owner',
        githubRepositoryName: 'test-repo',
      });

      mockGetPullRequestFiles.mockResolvedValue([
        { path: 'src/index.ts', content: 'const x = 1;' },
        { path: 'src/other.ts', content: 'const y = 2;' },
      ]);

      mockCallAIStructured.mockResolvedValue(defaultAIResponse);
      mockCommitFiles.mockResolvedValue({ oid: 'new-oid-123' });

      prisma.task.findUnique.mockResolvedValue({ parentTaskId: null });

      const result = await fixReviewExecutor.execute(ctx);

      expect(result.success).toBe(true);
      expect(mockGetPullRequestFiles).toHaveBeenCalledWith('install-1', 'test-owner', 'test-repo', 42);
      // Verify the AI prompt includes source code context — the user prompt is the second argument
      const aiCall = mockCallAIStructured.mock.calls[0][0] as { userPrompt: string };
      expect(aiCall.userPrompt).toContain('src/index.ts');
      expect(aiCall.userPrompt).toContain('const x = 1;');
      // The non-mentioned file should not be included
      expect(aiCall.userPrompt).not.toContain('const y = 2;');
    });
  });

  describe('AI returns invalid response', () => {
    it('returns failure when AI response does not match schema', async () => {
      const ctx = buildContext();
      ctx.previousResults.set('review-action-1', {
        review: { approved: false, summary: 'Needs work', comments: [], suggestions: [] },
        approved: false,
      });

      mockCallAIStructured.mockResolvedValue({ parsed: null });

      const result = await fixReviewExecutor.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('AI did not return valid fix response');
    });
  });

  describe('successful fix commit', () => {
    it('commits fixes via commitFiles and returns headOid', async () => {
      const ctx = buildContext();
      ctx.previousResults.set('review-action-1', {
        review: { approved: false, summary: 'Fix it', comments: [], suggestions: [] },
        approved: false,
      });

      mockCallAIStructured.mockResolvedValue(defaultAIResponse);
      mockCommitFiles.mockResolvedValue({ oid: 'commit-oid-456' });

      const prisma = ctx.prisma as unknown as {
        task: { findUnique: ReturnType<typeof vi.fn>; findFirst: ReturnType<typeof vi.fn> };
      };
      prisma.task.findUnique.mockResolvedValue({ parentTaskId: null });

      const result = await fixReviewExecutor.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.data.headOid).toBe('commit-oid-456');
      expect(result.data.fixCount).toBe(1);
      expect(mockCommitFiles).toHaveBeenCalledWith(
        ctx.repo,
        {
          branch: 'feature/x',
          message: 'fix: address review comments',
          additions: [{ path: 'src/index.ts', content: 'fixed content' }],
        },
        'abc123',
      );
    });
  });

  describe('deferred task creation with duplicate detection', () => {
    it('creates deferred tasks and dependencies when no duplicates exist', async () => {
      const ctx = buildContext();
      ctx.previousResults.set('review-action-1', {
        review: { approved: false, summary: 'Fix it', comments: [], suggestions: [] },
        approved: false,
      });

      const aiResponse = {
        parsed: {
          fixes: [],
          commitMessage: 'fix: minor',
          deferredIssues: [
            { title: 'Add rate limiting middleware', description: 'Need rate limiter', severity: 'warning' as const },
          ],
          summary: 'Deferred rate limiting',
        },
      };
      mockCallAIStructured.mockResolvedValue(aiResponse);

      const prisma = ctx.prisma as unknown as {
        task: {
          findUnique: ReturnType<typeof vi.fn>;
          findFirst: ReturnType<typeof vi.fn>;
          create: ReturnType<typeof vi.fn>;
        };
        taskDependency: { create: ReturnType<typeof vi.fn> };
      };
      prisma.task.findUnique.mockResolvedValue({ parentTaskId: 'epic-1' });
      prisma.task.findFirst.mockResolvedValue(null); // no duplicate
      prisma.task.create.mockResolvedValue({ taskId: 'new-task-1' });

      const result = await fixReviewExecutor.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.data.tasksCreated).toBe(1);
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: 'Add rate limiting middleware',
            priority: 'medium', // severity 'warning' → medium
            parentTaskId: 'epic-1',
          }),
        }),
      );
      expect(prisma.taskDependency.create).toHaveBeenCalledWith({
        data: {
          sourceTaskId: 'task-1',
          targetTaskId: 'new-task-1',
          linkType: 'informs',
        },
      });
    });

    it('skips task creation when duplicate exists (title prefix match)', async () => {
      const ctx = buildContext();
      ctx.previousResults.set('review-action-1', {
        review: { approved: false, summary: 'Fix it', comments: [], suggestions: [] },
        approved: false,
      });

      const aiResponse = {
        parsed: {
          fixes: [],
          commitMessage: 'fix: minor',
          deferredIssues: [
            { title: 'Add rate limiting middleware', description: 'Need rate limiter', severity: 'error' as const },
          ],
          summary: 'Deferred',
        },
      };
      mockCallAIStructured.mockResolvedValue(aiResponse);

      const prisma = ctx.prisma as unknown as {
        task: {
          findUnique: ReturnType<typeof vi.fn>;
          findFirst: ReturnType<typeof vi.fn>;
          create: ReturnType<typeof vi.fn>;
        };
      };
      prisma.task.findUnique.mockResolvedValue({ parentTaskId: null });
      prisma.task.findFirst.mockResolvedValue({ taskId: 'existing-task' }); // duplicate found

      const result = await fixReviewExecutor.execute(ctx);

      expect(result.success).toBe(true);
      expect(result.data.tasksCreated).toBe(0);
      expect(prisma.task.create).not.toHaveBeenCalled();
    });
  });

  describe('abort signal handling', () => {
    it('throws AbortError when signal is aborted before AI call', async () => {
      const controller = new AbortController();
      controller.abort();

      const ctx = buildContext({ signal: controller.signal });
      ctx.previousResults.set('review-action-1', {
        review: { approved: false, summary: 'Fix', comments: [], suggestions: [] },
        approved: false,
      });

      await expect(fixReviewExecutor.execute(ctx)).rejects.toThrow('Action cancelled');
    });

    it('throws AbortError when signal is aborted after AI call', async () => {
      const controller = new AbortController();

      const ctx = buildContext({ signal: controller.signal });
      ctx.previousResults.set('review-action-1', {
        review: { approved: false, summary: 'Fix', comments: [], suggestions: [] },
        approved: false,
      });

      mockCallAIStructured.mockImplementation(async () => {
        controller.abort();
        return defaultAIResponse;
      });

      await expect(fixReviewExecutor.execute(ctx)).rejects.toThrow('Action cancelled');
    });
  });
});
