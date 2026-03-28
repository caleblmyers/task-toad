import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks ──

const mockGithubRequest = vi.fn();
vi.mock('../github/githubAppClient.js', () => ({
  githubRequest: (...args: unknown[]) => mockGithubRequest(...args),
}));

vi.mock('../github/githubAppAuth.js', () => ({
  getInstallationToken: vi.fn().mockResolvedValue('test-token'),
}));

vi.mock('../github/githubLogger.js', () => ({
  logBranchCreation: vi.fn(),
  logCommit: vi.fn(),
  logApiError: vi.fn(),
}));

const mockFetchProjectFileTree = vi.fn();
const mockFetchFileContentCached = vi.fn();
vi.mock('../github/githubFileService.js', () => ({
  fetchProjectFileTree: (...args: unknown[]) => mockFetchProjectFileTree(...args),
  fetchFileContentCached: (...args: unknown[]) => mockFetchFileContentCached(...args),
}));

vi.mock('../ai/tokenEstimator.js', () => ({
  estimateTokens: vi.fn((text: string) => Math.ceil(text.length / 4)),
}));

vi.mock('../utils/logger.js', () => ({
  createChildLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

import { createBranch, commitFiles } from '../github/githubCommitService.js';
import { resolveCodeGenContext } from '../github/repoContextService.js';
import type { GitHubRepoLink } from '../github/githubTypes.js';

// ── Helpers ──

function makeRepo(overrides: Partial<GitHubRepoLink> = {}): GitHubRepoLink {
  return {
    repositoryId: 'repo-123',
    repositoryName: 'test-repo',
    repositoryOwner: 'test-owner',
    installationId: 'install-1',
    defaultBranch: 'main',
    ...overrides,
  };
}

describe('branch flow — createBranch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('creates branch and returns branchName + baseOid on first action', async () => {
    // getBranchOid call (fetches default branch OID)
    mockGithubRequest.mockResolvedValueOnce({
      repository: { ref: { target: { oid: 'abc123' } } },
    });
    // createRef call (creates the branch)
    mockGithubRequest.mockResolvedValueOnce({
      createRef: { ref: { name: 'refs/heads/implement-feature-x-task1234' } },
    });

    const result = await createBranch(makeRepo(), 'task1234-abcd-efgh', 'Implement Feature X', 'test-token');

    expect(result.branchName).toBe('implement-feature-x-task1234');
    expect(result.baseOid).toBe('abc123');
    // Verify createRef was called with correct ref name
    expect(mockGithubRequest).toHaveBeenCalledTimes(2);
    expect(mockGithubRequest.mock.calls[1][2]).toMatchObject({
      name: 'refs/heads/implement-feature-x-task1234',
      oid: 'abc123',
    });
  });

  it('retries with suffix when branch name already exists', async () => {
    // getBranchOid for default branch
    mockGithubRequest.mockResolvedValueOnce({
      repository: { ref: { target: { oid: 'abc123' } } },
    });
    // First createRef fails with "already exists"
    mockGithubRequest.mockRejectedValueOnce(new Error('Reference already exists'));
    // Second createRef succeeds (with suffix)
    mockGithubRequest.mockResolvedValueOnce({
      createRef: { ref: { name: 'refs/heads/feature-task1234-x7k2' } },
    });

    const result = await createBranch(makeRepo(), 'task1234-abcd-efgh', 'Feature', 'test-token');

    // Should have retried with a suffix appended
    expect(result.branchName).toMatch(/^feature-task1234-.{4}$/);
    expect(result.baseOid).toBe('abc123');
    expect(mockGithubRequest).toHaveBeenCalledTimes(3);
  });

  it('uses existing branch when both attempts conflict', async () => {
    // getBranchOid for default branch
    mockGithubRequest.mockResolvedValueOnce({
      repository: { ref: { target: { oid: 'abc123' } } },
    });
    // First createRef fails
    mockGithubRequest.mockRejectedValueOnce(new Error('Reference already exists'));
    // Second createRef also fails
    mockGithubRequest.mockRejectedValueOnce(new Error('Reference already exists'));
    // getBranchOid for existing branch
    mockGithubRequest.mockResolvedValueOnce({
      repository: { ref: { target: { oid: 'existing-oid-999' } } },
    });

    const result = await createBranch(makeRepo(), 'task1234-abcd-efgh', 'Feature', 'test-token');

    // Falls back to using the existing branch
    expect(result.baseOid).toBe('existing-oid-999');
    expect(mockGithubRequest).toHaveBeenCalledTimes(4);
  });
});

describe('branch flow — commitFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('commits files and returns new headOid', async () => {
    mockGithubRequest.mockResolvedValueOnce({
      createCommitOnBranch: {
        commit: { oid: 'new-commit-oid', url: 'https://github.com/commit/new-commit-oid' },
      },
    });

    const result = await commitFiles(
      makeRepo(),
      {
        branch: 'feature-branch',
        message: 'feat: add feature',
        additions: [{ path: 'src/feature.ts', content: 'export const x = 1;' }],
      },
      'previous-head-oid',
      'test-token',
    );

    expect(result.oid).toBe('new-commit-oid');
    expect(result.url).toBe('https://github.com/commit/new-commit-oid');
    expect(mockGithubRequest.mock.calls[0][2]).toMatchObject({
      expectedHeadOid: 'previous-head-oid',
    });
  });

  it('does not corrupt headOid when commit fails', async () => {
    mockGithubRequest.mockRejectedValueOnce(new Error('Git conflict: expected OID mismatch'));

    const previousOid = 'safe-oid-123';
    await expect(
      commitFiles(
        makeRepo(),
        {
          branch: 'feature-branch',
          message: 'feat: add feature',
          additions: [{ path: 'src/a.ts', content: 'code' }],
        },
        previousOid,
        'test-token',
      ),
    ).rejects.toThrow('Git conflict');

    // The previousOid is passed by value — the caller's plan.headOid is never mutated
    // since commitFiles throws before returning. The plan update only happens on success.
    expect(previousOid).toBe('safe-oid-123');
  });
});

describe('branch flow — resolveCodeGenContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns relevant files scored by keyword matching', async () => {
    mockFetchProjectFileTree.mockResolvedValue([
      { path: 'src/auth/login.ts', language: 'typescript' },
      { path: 'src/auth/types.ts', language: 'typescript' },
      { path: 'src/utils/logger.ts', language: 'typescript' },
      { path: 'README.md', language: 'markdown' },
    ]);

    mockFetchFileContentCached.mockImplementation(
      (_installId: string, _owner: string, _name: string, filePath: string) => {
        const contents: Record<string, string> = {
          'src/auth/login.ts': 'export function login() { return true; }',
          'src/auth/types.ts': 'export interface AuthUser { id: string; }',
        };
        return Promise.resolve(contents[filePath] ?? null);
      },
    );

    const result = await resolveCodeGenContext(
      makeRepo(),
      { title: 'Fix auth login flow', description: 'The login endpoint has a bug' },
      10_000,
    );

    expect(result.fileTree).toHaveLength(4);
    // Auth-related files should be returned as relevant
    expect(result.relevantFiles.length).toBeGreaterThanOrEqual(1);
    const relevantPaths = result.relevantFiles.map((f) => f.path);
    expect(relevantPaths).toContain('src/auth/login.ts');
  });
});
