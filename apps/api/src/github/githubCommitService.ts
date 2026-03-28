/**
 * Git operations: branch creation and committing files via GitHub GraphQL.
 */

import { githubRequest } from './githubAppClient.js';
import { getInstallationToken } from './githubAppAuth.js';
import type { CommitInput, GitHubRepoLink } from './githubTypes.js';
import { logBranchCreation, logCommit, logApiError } from './githubLogger.js';

// -- GraphQL queries and mutations --

const GET_DEFAULT_BRANCH_OID = `
  query GetDefaultBranchOid($owner: String!, $name: String!, $ref: String!) {
    repository(owner: $owner, name: $name) {
      ref(qualifiedName: $ref) {
        target { oid }
      }
    }
  }
`;

const CREATE_REF = `
  mutation CreateRef($repositoryId: ID!, $name: String!, $oid: GitObjectID!) {
    createRef(input: { repositoryId: $repositoryId, name: $name, oid: $oid }) {
      ref { name }
    }
  }
`;

const CREATE_COMMIT_ON_BRANCH = `
  mutation CreateCommitOnBranch(
    $branchId: CommittableBranch!,
    $message: CommitMessage!,
    $fileChanges: FileChanges!,
    $expectedHeadOid: GitObjectID!
  ) {
    createCommitOnBranch(input: {
      branch: $branchId,
      message: $message,
      fileChanges: $fileChanges,
      expectedHeadOid: $expectedHeadOid
    }) {
      commit { oid url }
    }
  }
`;

// -- Response types --

interface GetBranchOidResponse {
  repository: {
    ref: { target: { oid: string } } | null;
  };
}

interface CreateRefResponse {
  createRef: { ref: { name: string } };
}

interface CreateCommitResponse {
  createCommitOnBranch: {
    commit: { oid: string; url: string };
  };
}

const GITHUB_REST_BASE = 'https://api.github.com';

/**
 * Simple REST helper for the GitHub Git Data API.
 */
async function githubRestRequest<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const response = await fetch(`${GITHUB_REST_BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub REST API error ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Get the latest commit OID for a ref (branch).
 * Returns null if the ref doesn't exist (e.g. empty repo).
 */
export async function getDefaultBranchOid(
  repo: GitHubRepoLink,
  tokenOverride?: string
): Promise<string | null> {
  const token = tokenOverride ?? await getInstallationToken(repo.installationId);
  const qualifiedRef = `refs/heads/${repo.defaultBranch}`;

  const data = await githubRequest<GetBranchOidResponse>(token, GET_DEFAULT_BRANCH_OID, {
    owner: repo.repositoryOwner,
    name: repo.repositoryName,
    ref: qualifiedRef,
  }, repo.installationId);

  return data.repository.ref?.target.oid ?? null;
}

/**
 * Get the latest commit OID for a ref (branch).
 */
async function getBranchOid(
  token: string,
  owner: string,
  name: string,
  ref: string,
  installationId?: string,
): Promise<string> {
  const data = await githubRequest<GetBranchOidResponse>(token, GET_DEFAULT_BRANCH_OID, {
    owner,
    name,
    ref,
  }, installationId);

  if (!data.repository.ref) {
    throw new Error(`Ref "${ref}" not found in ${owner}/${name}`);
  }

  return data.repository.ref.target.oid;
}

/**
 * Derive a URL-safe slug from a task title.
 * Lowercase, alphanumeric + hyphens, max 30 chars.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

/**
 * Create a branch from the repository's default branch.
 *
 * Branch name format: task-{taskId}-{slug}
 * If the branch already exists and taskTitle is provided, retries once
 * with a random 4-char suffix to avoid conflicts.
 */
export async function createBranch(
  repo: GitHubRepoLink,
  taskId: string,
  taskTitle?: string,
  tokenOverride?: string
): Promise<{ branchName: string; baseOid: string }> {
  const token = tokenOverride ?? await getInstallationToken(repo.installationId);
  const shortId = taskId.slice(0, 8);
  const slug = taskTitle ? slugify(taskTitle) : 'ai';
  const baseBranchName = `${slug}-${shortId}`;
  const qualifiedRef = `refs/heads/${repo.defaultBranch}`;

  const baseOid = await getBranchOid(token, repo.repositoryOwner, repo.repositoryName, qualifiedRef, repo.installationId);

  // Try creating with the base name, then retry with random suffix on conflict
  const candidates = [baseBranchName];

  for (const branchName of candidates) {
    try {
      await githubRequest<CreateRefResponse>(token, CREATE_REF, {
        repositoryId: repo.repositoryId,
        name: `refs/heads/${branchName}`,
        oid: baseOid,
      }, repo.installationId);
      logBranchCreation(repo.repositoryOwner, repo.repositoryName, branchName);
      return { branchName, baseOid };
    } catch (error) {
      const msg = error instanceof Error ? error.message : '';
      if (msg.includes('already exists')) {
        // If this was our first attempt, retry with a random suffix
        if (branchName === baseBranchName) {
          const suffix = Math.random().toString(36).slice(2, 6);
          candidates.push(`${baseBranchName}-${suffix}`);
          continue;
        }
        // Second attempt also exists — use the existing branch
        const existingOid = await getBranchOid(
          token,
          repo.repositoryOwner,
          repo.repositoryName,
          `refs/heads/${branchName}`,
          repo.installationId,
        );
        return { branchName, baseOid: existingOid };
      }
      logApiError('createBranch', error, { branchName });
      throw error;
    }
  }

  // Unreachable, but satisfy TS
  return { branchName: baseBranchName, baseOid };
}

/**
 * Commit file changes to a branch.
 *
 * Uses the createCommitOnBranch mutation which supports multiple
 * file additions and deletions in a single commit.
 */
export async function commitFiles(
  repo: GitHubRepoLink,
  input: CommitInput,
  headOid: string,
  tokenOverride?: string
): Promise<{ oid: string; url: string }> {
  const token = tokenOverride ?? await getInstallationToken(repo.installationId);

  const fileChanges: Record<string, unknown> = {};

  if (input.additions.length > 0) {
    fileChanges.additions = input.additions.map((f) => ({
      path: f.path,
      contents: Buffer.from(f.content).toString('base64'),
    }));
  }

  if (input.deletions && input.deletions.length > 0) {
    fileChanges.deletions = input.deletions.map((f) => ({ path: f.path }));
  }

  try {
    const data = await githubRequest<CreateCommitResponse>(token, CREATE_COMMIT_ON_BRANCH, {
      branchId: {
        repositoryNameWithOwner: `${repo.repositoryOwner}/${repo.repositoryName}`,
        branchName: input.branch,
      },
      message: { headline: input.message },
      fileChanges,
      expectedHeadOid: headOid,
    }, repo.installationId);

    const { oid, url } = data.createCommitOnBranch.commit;
    logCommit(repo.repositoryOwner, repo.repositoryName, input.branch, oid);
    return { oid, url };
  } catch (error) {
    logApiError('commitFiles', error, {
      repo: `${repo.repositoryOwner}/${repo.repositoryName}`,
      branch: input.branch,
    });
    throw error;
  }
}

/**
 * Commit files to an empty GitHub repository (no existing commits).
 *
 * Empty repos have no defaultBranchRef, so `createCommitOnBranch` GraphQL
 * won't work. Uses the REST Git Data API to create an initial commit.
 */
export async function commitFilesToEmptyRepo(
  repo: GitHubRepoLink,
  files: Array<{ path: string; content: string }>,
  message: string,
  tokenOverride?: string
): Promise<{ oid: string; url: string }> {
  const token = tokenOverride ?? await getInstallationToken(repo.installationId);
  const owner = encodeURIComponent(repo.repositoryOwner);
  const name = encodeURIComponent(repo.repositoryName);
  const repoPath = `/repos/${owner}/${name}`;

  try {
    // GitHub's Git Data API (blobs/trees/commits/refs) doesn't work on truly empty repos.
    // Bootstrap with the Contents API which handles empty repos, then add remaining files via GraphQL.

    // 1. Create the first file via Contents API (initializes the repo with a commit)
    const firstFile = files[0];
    const createResult = await githubRestRequest<{ commit: { sha: string; html_url: string } }>(
      token,
      'PUT',
      `${repoPath}/contents/${encodeURIComponent(firstFile.path)}`,
      {
        message,
        content: Buffer.from(firstFile.content).toString('base64'),
        branch: repo.defaultBranch,
      }
    );

    const initialOid = createResult.commit.sha;
    let commitUrl = createResult.commit.html_url;

    // 2. If there are more files, commit them via GraphQL (repo is no longer empty)
    if (files.length > 1) {
      const remainingFiles = files.slice(1);
      const result = await commitFiles(
        repo,
        {
          branch: repo.defaultBranch,
          message: `chore: add scaffold files`,
          additions: remainingFiles,
        },
        initialOid,
        tokenOverride
      );
      commitUrl = result.url;
    }

    logCommit(repo.repositoryOwner, repo.repositoryName, repo.defaultBranch, initialOid);
    return { oid: initialOid, url: commitUrl };
  } catch (error) {
    logApiError('commitFilesToEmptyRepo', error, {
      repo: `${repo.repositoryOwner}/${repo.repositoryName}`,
    });
    throw error;
  }
}
