export const githubTypeDefs = /* GraphQL */ `
  type GitHubInstallation {
    installationId: ID!
    accountLogin: String!
    accountType: String!
    orgId: ID
    createdAt: String!
  }

  type GitHubRepoLink {
    repositoryId: String!
    repositoryName: String!
    repositoryOwner: String!
    installationId: String!
    defaultBranch: String!
  }

  type TaskCommit {
    id: ID!
    sha: String!
    message: String!
    author: String!
    url: String!
    createdAt: String!
  }

  type TaskPullRequest {
    id: ID!
    prNumber: Int!
    prUrl: String!
    prTitle: String!
    state: String!
  }

  type GitHubPullRequest {
    pullRequestId: ID!
    number: Int!
    url: String!
    title: String!
  }

  type GitHubRepo {
    id: ID!
    name: String!
    owner: String!
    fullName: String!
    isPrivate: Boolean!
    defaultBranch: String!
  }

  input GitHubFileInput {
    path: String!
    content: String!
  }
`;

export const githubQueryFields = /* GraphQL */ `
  """List all GitHub App installations linked to the current organization."""
  githubInstallations: [GitHubInstallation!]!
  """List repositories accessible through a specific GitHub App installation."""
  githubInstallationRepos(installationId: ID!): [GitHubRepo!]!
  """Get the linked GitHub repository for a project, if any."""
  githubProjectRepo(projectId: ID!): GitHubRepoLink
  """Fetch the content of a single file from the project's linked repository."""
  fetchRepoFileContent(projectId: ID!, filePath: String!): String
`;

export const githubMutationFields = /* GraphQL */ `
  """Link a GitHub App installation to the current organization."""
  linkGitHubInstallation(installationId: ID!): GitHubInstallation!
  """Connect an existing GitHub repository to a project."""
  connectGitHubRepo(projectId: ID!, installationId: ID!, owner: String!, name: String!): GitHubRepoLink!
  """Disconnect the linked GitHub repository from a project."""
  disconnectGitHubRepo(projectId: ID!): Boolean!
  """Create a new GitHub repository and link it to a project."""
  createGitHubRepo(projectId: ID!, installationId: ID!, ownerLogin: String!): GitHubRepoLink!
  """Create a pull request from generated task code files."""
  createPullRequestFromTask(projectId: ID!, taskId: ID!, files: [GitHubFileInput!]!): GitHubPullRequest!
  """Sync a task's status and metadata to its linked GitHub issue."""
  syncTaskToGitHub(taskId: ID!): Task!
  """Decompose a GitHub issue into multiple subtasks using AI."""
  decomposeGitHubIssue(projectId: ID!, issueNumber: Int!): [Task!]!
  """Generate a code fix from a pull request review using AI."""
  generateFixFromReview(taskId: ID!, prNumber: Int!): CodeGeneration!
`;
