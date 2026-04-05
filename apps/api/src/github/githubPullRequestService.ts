/**
 * Pull request creation via GitHub GraphQL API.
 */

import { githubRequest, githubRestRequest } from './githubAppClient.js';
import { getInstallationToken } from './githubAppAuth.js';
import type { CreatePullRequestInput, PullRequestResult, GitHubRepoLink } from './githubTypes.js';
import { logPullRequest, logApiError } from './githubLogger.js';

/**
 * Fetch the unified diff for a pull request via GitHub REST API.
 */
export async function getPullRequestDiff(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<string> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`;
  const response = await githubRestRequest(installationId, url, {
    headers: {
      Accept: 'application/vnd.github.v3.diff',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    logApiError('getPullRequestDiff', new Error(`HTTP ${response.status}: ${body}`), {
      repo: `${owner}/${repo}`,
      prNumber,
    });
    throw new Error(`Failed to fetch PR diff: ${response.status}`);
  }

  return response.text();
}

interface PRComment {
  path: string;
  body: string;
  line?: number;
}

/**
 * Fetch review comments on a pull request.
 */
export async function getPullRequestComments(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<PRComment[]> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/comments`;
  const response = await githubRestRequest(installationId, url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    logApiError('getPullRequestComments', new Error(`HTTP ${response.status}`), {
      repo: `${owner}/${repo}`,
      prNumber,
    });
    throw new Error(`Failed to fetch PR comments: ${response.status}`);
  }

  const data = (await response.json()) as Array<{ path: string; body: string; line?: number }>;
  return data.map((c) => ({ path: c.path, body: c.body, line: c.line ?? undefined }));
}

interface PRFileEntry {
  filename: string;
  contents_url: string;
  status: string;
}

/**
 * Fetch the files changed in a pull request and their current contents.
 */
export async function getPullRequestFiles(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number
): Promise<Array<{ path: string; content: string }>> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/files`;
  const response = await githubRestRequest(installationId, url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    logApiError('getPullRequestFiles', new Error(`HTTP ${response.status}`), {
      repo: `${owner}/${repo}`,
      prNumber,
    });
    throw new Error(`Failed to fetch PR files: ${response.status}`);
  }

  const files = (await response.json()) as PRFileEntry[];

  // Fetch content for each file (skip removed files)
  const results: Array<{ path: string; content: string }> = [];
  for (const file of files) {
    if (file.status === 'removed') continue;

    try {
      const contentResponse = await githubRestRequest(installationId, file.contents_url, {
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });

      if (contentResponse.ok) {
        const contentData = (await contentResponse.json()) as { content?: string; encoding?: string };
        if (contentData.content && contentData.encoding === 'base64') {
          results.push({
            path: file.filename,
            content: Buffer.from(contentData.content, 'base64').toString('utf8'),
          });
        }
      }
    } catch {
      // Skip files we can't fetch
    }
  }

  return results;
}

/**
 * Post a review on a pull request via GitHub REST API.
 * Posts as a single review with an overall comment body.
 */
export async function postPullRequestReview(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number,
  body: string,
  event: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES' = 'COMMENT'
): Promise<void> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/reviews`;
  const response = await githubRestRequest(installationId, url, {
    method: 'POST',
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    body: JSON.stringify({ body, event }),
  });

  if (!response.ok) {
    const text = await response.text();
    logApiError('postPullRequestReview', new Error(`HTTP ${response.status}: ${text}`), {
      repo: `${owner}/${repo}`,
      prNumber,
    });
    throw new Error(`Failed to post PR review: ${response.status}`);
  }
}

const GET_PULL_REQUEST_STATE = `
  query GetPullRequestState($nodeId: ID!) {
    node(id: $nodeId) {
      ... on PullRequest {
        state
        number
        url
      }
    }
  }
`;

interface GetPullRequestStateResponse {
  node: {
    state: 'OPEN' | 'CLOSED' | 'MERGED';
    number: number;
    url: string;
  } | null;
}

/**
 * Query the current state of a pull request via GitHub GraphQL.
 */
export async function getPullRequestState(
  installationId: string,
  pullRequestId: string,
): Promise<{ state: 'OPEN' | 'CLOSED' | 'MERGED'; number: number; url: string }> {
  const token = await getInstallationToken(installationId);

  const data = await githubRequest<GetPullRequestStateResponse>(
    token,
    GET_PULL_REQUEST_STATE,
    { nodeId: pullRequestId },
    installationId,
  );

  if (!data.node) {
    throw new Error(`Pull request not found: ${pullRequestId}`);
  }

  return { state: data.node.state, number: data.node.number, url: data.node.url };
}

/**
 * Update a pull request branch (sync with base branch) via GitHub REST API.
 */
export async function updatePullRequestBranch(
  installationId: string,
  owner: string,
  repo: string,
  prNumber: number,
): Promise<{ updated: boolean }> {
  const url = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/update-branch`;
  const response = await githubRestRequest(installationId, url, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    logApiError('updatePullRequestBranch', new Error(`HTTP ${response.status}: ${body}`), {
      repo: `${owner}/${repo}`,
      prNumber,
    });
    return { updated: false };
  }

  return { updated: true };
}

export type MergeErrorReason = 'already_merged' | 'out_of_date' | 'conflict' | 'unknown';

const MERGE_PULL_REQUEST = `
  mutation MergePullRequest($pullRequestId: ID!, $mergeMethod: PullRequestMergeMethod) {
    mergePullRequest(input: {
      pullRequestId: $pullRequestId,
      mergeMethod: $mergeMethod
    }) {
      pullRequest {
        id
        number
        url
        merged
        state
      }
    }
  }
`;

interface MergePullRequestResponse {
  mergePullRequest: {
    pullRequest: {
      id: string;
      number: number;
      url: string;
      merged: boolean;
      state: string;
    };
  };
}

/**
 * Merge a pull request on GitHub via GraphQL.
 * Returns errorReason on failure for structured error handling.
 */
export async function mergePullRequest(
  installationId: string,
  pullRequestId: string,
  mergeMethod: 'SQUASH' | 'MERGE' | 'REBASE' = 'SQUASH',
): Promise<{ merged: boolean; url: string; number: number; errorReason?: MergeErrorReason }> {
  const token = await getInstallationToken(installationId);

  try {
    const data = await githubRequest<MergePullRequestResponse>(token, MERGE_PULL_REQUEST, {
      pullRequestId,
      mergeMethod,
    }, installationId);

    const pr = data.mergePullRequest.pullRequest;
    return { merged: pr.merged, url: pr.url, number: pr.number };
  } catch (error) {
    logApiError('mergePullRequest', error, { pullRequestId, mergeMethod });
    const msg = error instanceof Error ? error.message.toLowerCase() : '';
    let errorReason: MergeErrorReason = 'unknown';
    if (msg.includes('already been merged') || msg.includes('pull request is in an unmergeable state')) {
      errorReason = 'already_merged';
    } else if (msg.includes('not up to date') || msg.includes('out-of-date') || msg.includes('out of date') || msg.includes('head ref must be a ref')) {
      errorReason = 'out_of_date';
    } else if (msg.includes('merge conflict') || msg.includes('not mergeable')) {
      errorReason = 'conflict';
    }
    return { merged: false, url: '', number: 0, errorReason };
  }
}

const CREATE_PULL_REQUEST = `
  mutation CreatePullRequest(
    $repositoryId: ID!,
    $baseRefName: String!,
    $headRefName: String!,
    $title: String!,
    $body: String!
  ) {
    createPullRequest(input: {
      repositoryId: $repositoryId,
      baseRefName: $baseRefName,
      headRefName: $headRefName,
      title: $title,
      body: $body
    }) {
      pullRequest {
        id
        number
        url
        title
      }
    }
  }
`;

interface CreatePullRequestResponse {
  createPullRequest: {
    pullRequest: {
      id: string;
      number: number;
      url: string;
      title: string;
    };
  };
}

/**
 * Create a pull request on GitHub.
 */
export async function createPullRequest(
  repo: GitHubRepoLink,
  input: CreatePullRequestInput
): Promise<PullRequestResult> {
  const token = await getInstallationToken(repo.installationId);

  try {
    const data = await githubRequest<CreatePullRequestResponse>(token, CREATE_PULL_REQUEST, {
      repositoryId: input.repositoryId,
      baseRefName: input.baseRefName,
      headRefName: input.headRefName,
      title: input.title,
      body: input.body,
    }, repo.installationId);

    const pr = data.createPullRequest.pullRequest;
    logPullRequest(repo.repositoryOwner, repo.repositoryName, pr.number, pr.url);

    return {
      pullRequestId: pr.id,
      number: pr.number,
      url: pr.url,
      title: pr.title,
    };
  } catch (error) {
    logApiError('createPullRequest', error, {
      repo: `${repo.repositoryOwner}/${repo.repositoryName}`,
      base: input.baseRefName,
      head: input.headRefName,
    });
    throw error;
  }
}
