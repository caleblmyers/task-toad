/**
 * Repository management: create repos, connect/disconnect from projects.
 */

import { githubRequest } from './githubAppClient.js';
import { getInstallationToken } from './githubAppAuth.js';
import type { GitHubRepoLink, GitHubRepo } from './githubTypes.js';
import { logRepoCreation, logApiError } from './githubLogger.js';
import { getCached, setCache } from './githubCache.js';
import { prisma } from '../graphql/context.js';

// -- GraphQL queries and mutations --

const GET_REPOSITORY = `
  query GetRepository($owner: String!, $name: String!) {
    repository(owner: $owner, name: $name) {
      id
      name
      owner { login }
      defaultBranchRef { name }
    }
  }
`;

const CREATE_REPOSITORY = `
  mutation CreateRepository($name: String!, $visibility: RepositoryVisibility!, $ownerId: ID!) {
    createRepository(input: { name: $name, visibility: $visibility, ownerId: $ownerId }) {
      repository {
        id
        name
        owner { login }
        defaultBranchRef { name }
      }
    }
  }
`;

const CREATE_REPOSITORY_NO_OWNER = `
  mutation CreateRepository($name: String!, $visibility: RepositoryVisibility!) {
    createRepository(input: { name: $name, visibility: $visibility }) {
      repository {
        id
        name
        owner { login }
        defaultBranchRef { name }
      }
    }
  }
`;

const GET_OWNER_ID = `
  query GetOwnerId($login: String!) {
    repositoryOwner(login: $login) {
      id
    }
  }
`;

// -- Types for GraphQL responses --

interface RepoNode {
  id: string;
  name: string;
  owner: { login: string };
  defaultBranchRef: { name: string } | null;
}

interface GetRepoResponse {
  repository: RepoNode | null;
}

interface CreateRepoResponse {
  createRepository: {
    repository: RepoNode;
  };
}

interface GetOwnerIdResponse {
  repositoryOwner: { id: string } | null;
}

/**
 * Get the GitHub repository linked to a project.
 */
export async function getProjectRepo(projectId: string): Promise<GitHubRepoLink | null> {
  const project = await prisma.project.findUnique({
    where: { projectId },
    select: {
      githubRepositoryId: true,
      githubRepositoryName: true,
      githubRepositoryOwner: true,
      githubInstallationId: true,
      githubDefaultBranch: true,
    },
  });

  if (!project?.githubRepositoryId) return null;

  return {
    repositoryId: project.githubRepositoryId,
    repositoryName: project.githubRepositoryName!,
    repositoryOwner: project.githubRepositoryOwner!,
    installationId: project.githubInstallationId!,
    defaultBranch: project.githubDefaultBranch!,
  };
}

/**
 * Connect an existing GitHub repository to a project.
 */
export async function connectRepoToProject(
  projectId: string,
  installationId: string,
  owner: string,
  name: string
): Promise<GitHubRepoLink> {
  const token = await getInstallationToken(installationId);

  const data = await githubRequest<GetRepoResponse>(token, GET_REPOSITORY, { owner, name }, installationId);
  if (!data.repository) {
    throw new Error(`Repository ${owner}/${name} not found or not accessible`);
  }

  const repo = data.repository;
  const defaultBranch = repo.defaultBranchRef?.name ?? 'main';

  await prisma.project.update({
    where: { projectId },
    data: {
      githubRepositoryId: repo.id,
      githubRepositoryName: repo.name,
      githubRepositoryOwner: repo.owner.login,
      githubInstallationId: installationId,
      githubDefaultBranch: defaultBranch,
    },
  });

  return {
    repositoryId: repo.id,
    repositoryName: repo.name,
    repositoryOwner: repo.owner.login,
    installationId,
    defaultBranch,
  };
}

/**
 * Disconnect a GitHub repository from a project.
 */
export async function disconnectRepo(projectId: string): Promise<void> {
  await prisma.project.update({
    where: { projectId },
    data: {
      githubRepositoryId: null,
      githubRepositoryName: null,
      githubRepositoryOwner: null,
      githubInstallationId: null,
      githubDefaultBranch: null,
    },
  });
}

/**
 * Create a new private GitHub repository for a project.
 * Repository naming: tasktoad-{slugified project name}
 *
 * For org accounts: uses the installation token with ownerId.
 * For user accounts: uses the user's OAuth token (required for creating repos on personal accounts).
 */
export async function createRepoForProject(
  projectId: string,
  installationId: string,
  ownerLogin: string,
  userOAuthToken?: string
): Promise<GitHubRepoLink> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { projectId },
    select: { name: true },
  });

  const slug = project.name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const repoName = `tasktoad-${slug}`;

  // Look up the installation to determine account type
  const installation = await prisma.gitHubInstallation.findUnique({
    where: { installationId },
    select: { accountType: true },
  });
  const isUserAccount = installation?.accountType === 'User';

  let repoNode: RepoNode;
  try {
    if (isUserAccount) {
      // User accounts: must use user's OAuth token (installation tokens can't create repos on personal accounts)
      if (!userOAuthToken) {
        throw new Error('GitHub account not connected. Please connect your GitHub account in the project setup wizard to create repositories on your personal account.');
      }
      const data = await githubRequest<CreateRepoResponse>(userOAuthToken, CREATE_REPOSITORY_NO_OWNER, {
        name: repoName,
        visibility: 'PRIVATE',
      });
      repoNode = data.createRepository.repository;
    } else {
      // Org accounts: use installation token with ownerId
      const token = await getInstallationToken(installationId);
      const ownerData = await githubRequest<GetOwnerIdResponse>(token, GET_OWNER_ID, {
        login: ownerLogin,
      }, installationId);
      if (!ownerData.repositoryOwner) {
        throw new Error(`GitHub owner "${ownerLogin}" not found`);
      }
      const data = await githubRequest<CreateRepoResponse>(token, CREATE_REPOSITORY, {
        name: repoName,
        visibility: 'PRIVATE',
        ownerId: ownerData.repositoryOwner.id,
      }, installationId);
      repoNode = data.createRepository.repository;
    }
    logRepoCreation(repoNode.owner.login, repoNode.name, repoNode.id);
  } catch (error) {
    logApiError('createRepository', error, { repoName, ownerLogin });
    throw error;
  }

  const defaultBranch = repoNode.defaultBranchRef?.name ?? 'main';

  await prisma.project.update({
    where: { projectId },
    data: {
      githubRepositoryId: repoNode.id,
      githubRepositoryName: repoNode.name,
      githubRepositoryOwner: repoNode.owner.login,
      githubInstallationId: installationId,
      githubDefaultBranch: defaultBranch,
    },
  });

  return {
    repositoryId: repoNode.id,
    repositoryName: repoNode.name,
    repositoryOwner: repoNode.owner.login,
    installationId,
    defaultBranch,
  };
}

/**
 * List repositories accessible to a GitHub App installation.
 * Uses the REST API (no GraphQL equivalent for this endpoint).
 */
export async function listInstallationRepos(installationId: string): Promise<GitHubRepo[]> {
  const cacheKey = `repos:${installationId}`;
  const cached = getCached<GitHubRepo[]>(cacheKey);
  if (cached) return cached;

  const token = await getInstallationToken(installationId);

  const response = await fetch('https://api.github.com/installation/repositories?per_page=100', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!response.ok) {
    const body = await response.text();
    logApiError('listInstallationRepos', new Error(`HTTP ${response.status}: ${body}`), {
      installationId,
    });
    throw new Error(`Failed to list installation repos: ${response.status}`);
  }

  const data = (await response.json()) as {
    repositories: Array<{
      id: number;
      name: string;
      owner: { login: string };
      full_name: string;
      private: boolean;
      default_branch: string;
    }>;
  };

  const repos = data.repositories.map((r) => ({
    id: String(r.id),
    name: r.name,
    owner: r.owner.login,
    fullName: r.full_name,
    isPrivate: r.private,
    defaultBranch: r.default_branch,
  }));

  setCache(cacheKey, repos, 3_600_000); // 1 hour TTL
  return repos;
}
