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
 */
export async function mergePullRequest(
  installationId: string,
  pullRequestId: string,
  mergeMethod: 'SQUASH' | 'MERGE' | 'REBASE' = 'SQUASH',
): Promise<{ merged: boolean; url: string; number: number }> {
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
    throw error;
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
