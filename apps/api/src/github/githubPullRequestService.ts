/**
 * Pull request creation via GitHub GraphQL API.
 */

import { githubRequest } from './githubAppClient.js';
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
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3.diff',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

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
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/comments`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

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
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/files`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

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
      const contentResponse = await fetch(file.contents_url, {
        headers: {
          Authorization: `Bearer ${token}`,
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
  const token = await getInstallationToken(installationId);

  const response = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/pulls/${prNumber}/reviews`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ body, event }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    logApiError('postPullRequestReview', new Error(`HTTP ${response.status}: ${text}`), {
      repo: `${owner}/${repo}`,
      prNumber,
    });
    throw new Error(`Failed to post PR review: ${response.status}`);
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
    });

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
