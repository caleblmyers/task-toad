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
