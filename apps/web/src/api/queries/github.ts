// ── GitHub ──

export const GITHUB_INSTALLATIONS_QUERY = `query { githubInstallations { installationId accountLogin accountType orgId createdAt } }`;

export const GITHUB_INSTALLATION_REPOS_QUERY = `query GitHubRepos($installationId: ID!) { githubInstallationRepos(installationId: $installationId) { id name owner fullName isPrivate defaultBranch } }`;

export const CONNECT_GITHUB_REPO_MUTATION = `mutation ConnectRepo($projectId: ID!, $installationId: ID!, $owner: String!, $name: String!) {
  connectGitHubRepo(projectId: $projectId, installationId: $installationId, owner: $owner, name: $name) {
    repositoryId repositoryName repositoryOwner installationId defaultBranch
  }
}`;

export const DISCONNECT_GITHUB_REPO_MUTATION = `mutation DisconnectRepo($projectId: ID!) { disconnectGitHubRepo(projectId: $projectId) }`;

export const LINK_GITHUB_INSTALLATION_MUTATION = `mutation LinkInstallation($installationId: ID!) { linkGitHubInstallation(installationId: $installationId) { installationId accountLogin accountType orgId createdAt } }`;

export const CREATE_GITHUB_REPO_MUTATION = `mutation CreateGitHubRepo($projectId: ID!, $installationId: ID!, $ownerLogin: String!) {
  createGitHubRepo(projectId: $projectId, installationId: $installationId, ownerLogin: $ownerLogin) {
    repositoryId repositoryName repositoryOwner installationId defaultBranch
  }
}`;
