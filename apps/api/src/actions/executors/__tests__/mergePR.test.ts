import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──

const mockMergePullRequest = vi.fn();
const mockGetPullRequestState = vi.fn();
const mockUpdatePullRequestBranch = vi.fn();

vi.mock('../../../github/githubPullRequestService.js', () => ({
  mergePullRequest: (...args: unknown[]) => mockMergePullRequest(...args),
  getPullRequestState: (...args: unknown[]) => mockGetPullRequestState(...args),
  updatePullRequestBranch: (...args: unknown[]) => mockUpdatePullRequestBranch(...args),
}));

vi.mock('../../../utils/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { mergePRExecutor } from '../mergePR.js';
import type { ActionContext } from '../../types.js';

// ── Helpers ──

function buildContext(overrides: Partial<ActionContext> = {}): ActionContext {
  return {
    action: {
      id: 'action-1',
      actionType: 'merge_pr',
      config: JSON.stringify({ sourcePRActionId: 'create-pr-action-1' }),
      label: 'Merge PR',
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
      project: {
        findUnique: vi.fn().mockResolvedValue({
          githubInstallationId: 'install-1',
          githubRepositoryOwner: 'test-owner',
          githubRepositoryName: 'test-repo',
        }),
      },
    } as unknown as ActionContext['prisma'],
    previousResults: new Map([
      ['create-pr-action-1', { number: 42, pullRequestId: 'pr-node-id-1' }],
    ]),
    ...overrides,
  };
}

// ── Tests ──

describe('mergePRExecutor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('already-merged PR', () => {
    it('returns success with alreadyMerged when PR state is MERGED', async () => {
      mockGetPullRequestState.mockResolvedValue({
        state: 'MERGED',
        number: 42,
        url: 'https://github.com/test-owner/test-repo/pull/42',
      });

      const result = await mergePRExecutor.execute(buildContext());

      expect(result.success).toBe(true);
      expect(result.data.alreadyMerged).toBe(true);
      expect(result.data.prNumber).toBe(42);
      expect(mockMergePullRequest).not.toHaveBeenCalled();
    });
  });

  describe('closed PR', () => {
    it('returns failure when PR state is CLOSED', async () => {
      mockGetPullRequestState.mockResolvedValue({
        state: 'CLOSED',
        number: 42,
        url: 'https://github.com/test-owner/test-repo/pull/42',
      });

      const result = await mergePRExecutor.execute(buildContext());

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('closed');
      expect(mockMergePullRequest).not.toHaveBeenCalled();
    });
  });

  describe('successful merge', () => {
    it('merges PR and returns success', async () => {
      mockGetPullRequestState.mockResolvedValue({
        state: 'OPEN',
        number: 42,
        url: 'https://github.com/test-owner/test-repo/pull/42',
      });
      mockMergePullRequest.mockResolvedValue({
        merged: true,
        number: 42,
        url: 'https://github.com/test-owner/test-repo/pull/42',
      });

      const result = await mergePRExecutor.execute(buildContext());

      expect(result.success).toBe(true);
      expect(result.data.merged).toBe(true);
      expect(result.data.prNumber).toBe(42);
      expect(result.data.mergeMethod).toBe('SQUASH');
      expect(mockMergePullRequest).toHaveBeenCalledWith('install-1', 'pr-node-id-1', 'SQUASH');
    });
  });

  describe('out-of-date branch — retry succeeds', () => {
    it('updates branch, retries merge, and succeeds', async () => {
      mockGetPullRequestState.mockResolvedValue({
        state: 'OPEN',
        number: 42,
        url: 'https://github.com/test-owner/test-repo/pull/42',
      });
      mockMergePullRequest
        .mockResolvedValueOnce({ merged: false, errorReason: 'out_of_date', url: '', number: 42 })
        .mockResolvedValueOnce({
          merged: true,
          number: 42,
          url: 'https://github.com/test-owner/test-repo/pull/42',
        });
      mockUpdatePullRequestBranch.mockResolvedValue({ updated: true });

      const resultPromise = mergePRExecutor.execute(buildContext());
      await vi.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;

      expect(result.success).toBe(true);
      expect(result.data.retriedAfterUpdate).toBe(true);
      expect(mockUpdatePullRequestBranch).toHaveBeenCalledWith('install-1', 'test-owner', 'test-repo', 42);
      expect(mockMergePullRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('out-of-date branch — retry fails', () => {
    it('returns failure when merge still fails after branch update', async () => {
      mockGetPullRequestState.mockResolvedValue({
        state: 'OPEN',
        number: 42,
        url: 'https://github.com/test-owner/test-repo/pull/42',
      });
      mockMergePullRequest
        .mockResolvedValueOnce({ merged: false, errorReason: 'out_of_date', url: '', number: 42 })
        .mockResolvedValueOnce({ merged: false, errorReason: 'unknown', url: '', number: 42 });
      mockUpdatePullRequestBranch.mockResolvedValue({ updated: true });

      const resultPromise = mergePRExecutor.execute(buildContext());
      await vi.advanceTimersByTimeAsync(5000);
      const result = await resultPromise;

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('Failed to merge PR after updating branch');
      expect(mockMergePullRequest).toHaveBeenCalledTimes(2);
    });
  });

  describe('merge conflict', () => {
    it('returns failure with conflict error reason', async () => {
      mockGetPullRequestState.mockResolvedValue({
        state: 'OPEN',
        number: 42,
        url: 'https://github.com/test-owner/test-repo/pull/42',
      });
      mockMergePullRequest.mockResolvedValue({
        merged: false,
        errorReason: 'conflict',
        url: '',
        number: 42,
      });

      const result = await mergePRExecutor.execute(buildContext());

      expect(result.success).toBe(false);
      expect(result.data.errorReason).toBe('conflict');
      expect(result.data.error).toContain('merge conflicts');
    });
  });

  describe('missing PR ID', () => {
    it('returns failure when no PR result from source action', async () => {
      const ctx = buildContext();
      ctx.previousResults = new Map(); // no source PR result

      const result = await mergePRExecutor.execute(ctx);

      expect(result.success).toBe(false);
      expect(result.data.error).toContain('No PR ID');
      expect(mockGetPullRequestState).not.toHaveBeenCalled();
      expect(mockMergePullRequest).not.toHaveBeenCalled();
    });
  });

  describe('abort signal', () => {
    it('throws AbortError when signal is aborted before merge', async () => {
      const controller = new AbortController();
      controller.abort();

      const ctx = buildContext({ signal: controller.signal });

      // The abort check happens after the project lookup but before merge
      await expect(mergePRExecutor.execute(ctx)).rejects.toThrow('Action cancelled');
      expect(mockMergePullRequest).not.toHaveBeenCalled();
    });
  });
});
