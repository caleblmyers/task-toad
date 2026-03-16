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
  githubInstallations: [GitHubInstallation!]!
  githubInstallationRepos(installationId: ID!): [GitHubRepo!]!
  githubProjectRepo(projectId: ID!): GitHubRepoLink
  fetchRepoFileContent(projectId: ID!, filePath: String!): String
`;

export const githubMutationFields = /* GraphQL */ `
  linkGitHubInstallation(installationId: ID!): GitHubInstallation!
  connectGitHubRepo(projectId: ID!, installationId: ID!, owner: String!, name: String!): GitHubRepoLink!
  disconnectGitHubRepo(projectId: ID!): Boolean!
  createGitHubRepo(projectId: ID!, installationId: ID!, ownerLogin: String!): GitHubRepoLink!
  createPullRequestFromTask(projectId: ID!, taskId: ID!, files: [GitHubFileInput!]!): GitHubPullRequest!
  syncTaskToGitHub(taskId: ID!): Task!
  decomposeGitHubIssue(projectId: ID!, issueNumber: Int!): [Task!]!
  generateFixFromReview(taskId: ID!, prNumber: Int!): CodeGeneration!
`;
