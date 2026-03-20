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

/**
 * Get the latest commit OID for a ref (branch).
 */
async function getBranchOid(
  token: string,
  owner: string,
  name: string,
  ref: string
): Promise<string> {
  const data = await githubRequest<GetBranchOidResponse>(token, GET_DEFAULT_BRANCH_OID, {
    owner,
    name,
    ref,
  });

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
    .slice(0, 30);
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
  taskTitle?: string
): Promise<{ branchName: string; baseOid: string }> {
  const token = await getInstallationToken(repo.installationId);
  const slug = taskTitle ? slugify(taskTitle) : 'ai';
  const baseBranchName = `task-${taskId}-${slug}`;
  const qualifiedRef = `refs/heads/${repo.defaultBranch}`;

  const baseOid = await getBranchOid(token, repo.repositoryOwner, repo.repositoryName, qualifiedRef);

  // Try creating with the base name, then retry with random suffix on conflict
  const candidates = [baseBranchName];

  for (const branchName of candidates) {
    try {
      await githubRequest<CreateRefResponse>(token, CREATE_REF, {
        repositoryId: repo.repositoryId,
        name: `refs/heads/${branchName}`,
        oid: baseOid,
      });
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
          `refs/heads/${branchName}`
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
  headOid: string
): Promise<{ oid: string; url: string }> {
  const token = await getInstallationToken(repo.installationId);

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
    });

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
