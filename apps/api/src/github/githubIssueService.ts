/**
 * GitHub Issue service: create and manage GitHub Issues via the GitHub GraphQL API.
 */

import { getInstallationToken } from './githubAppAuth.js';
import { githubRequest } from './githubAppClient.js';
import { logApiError } from './githubLogger.js';

interface CreateIssueResponse {
  createIssue: {
    issue: { id: string; number: number; url: string };
  };
}

interface GetRepositoryIdResponse {
  repository: { id: string };
}

interface UpdateIssueResponse {
  updateIssue: {
    issue: { id: string; state: string };
  };
}

interface GetIssueResponse {
  node: {
    state: string;
    title: string;
    labels: { nodes: Array<{ name: string }> };
  };
}

/**
 * Create a GitHub Issue in the specified repository.
 */
export async function createGitHubIssue(
  installationId: string,
  owner: string,
  repo: string,
  title: string,
  body?: string
): Promise<{ nodeId: string; number: number; url: string }> {
  const token = await getInstallationToken(installationId);

  const repoData = await githubRequest<GetRepositoryIdResponse>(
    token,
    `query($owner: String!, $name: String!) {
      repository(owner: $owner, name: $name) { id }
    }`,
    { owner, name: repo }
  );

  const result = await githubRequest<CreateIssueResponse>(
    token,
    `mutation($input: CreateIssueInput!) {
      createIssue(input: $input) {
        issue { id number url }
      }
    }`,
    { input: { repositoryId: repoData.repository.id, title, body: body ?? '' } }
  );

  return {
    nodeId: result.createIssue.issue.id,
    number: result.createIssue.issue.number,
    url: result.createIssue.issue.url,
  };
}

/**
 * Update the state of a GitHub Issue (OPEN or CLOSED).
 */
export async function updateGitHubIssueState(
  installationId: string,
  issueNodeId: string,
  state: 'OPEN' | 'CLOSED'
): Promise<void> {
  const token = await getInstallationToken(installationId);
  try {
    await githubRequest<UpdateIssueResponse>(
      token,
      `mutation($input: UpdateIssueInput!) {
        updateIssue(input: $input) { issue { id state } }
      }`,
      { input: { id: issueNodeId, state } }
    );
  } catch (error) {
    logApiError('updateGitHubIssueState', error, { issueNodeId, state });
    throw error;
  }
}

/**
 * Fetch the current state and labels of a GitHub Issue.
 */
export async function getGitHubIssue(
  installationId: string,
  issueNodeId: string
): Promise<{ state: string; title: string; labels: string[] }> {
  const token = await getInstallationToken(installationId);
  const result = await githubRequest<GetIssueResponse>(
    token,
    `query($id: ID!) {
      node(id: $id) {
        ... on Issue {
          state title
          labels(first: 20) { nodes { name } }
        }
      }
    }`,
    { id: issueNodeId }
  );
  return {
    state: result.node.state,
    title: result.node.title,
    labels: result.node.labels.nodes.map((l) => l.name),
  };
}
