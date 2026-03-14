/**
 * GitHub App integration module — public API.
 */

// Auth
export { generateAppJWT, getInstallationToken, clearInstallationToken } from './githubAppAuth.js';

// GraphQL client
export { githubRequest } from './githubAppClient.js';

// Webhook handling
export { handleGitHubWebhook } from './githubWebhookHandler.js';

// Repository management
export { getProjectRepo, connectRepoToProject, disconnectRepo, createRepoForProject, listInstallationRepos } from './githubRepositoryService.js';

// Git operations
export { createBranch, commitFiles } from './githubCommitService.js';

// Pull requests
export { createPullRequest } from './githubPullRequestService.js';

// Issues
export { createGitHubIssue, updateGitHubIssueState, getGitHubIssue } from './githubIssueService.js';

// Task linking
export { extractTaskIds, linkCommitsToTasks } from './githubTaskLinker.js';

// Orchestration
export { createPullRequestFromTask } from './githubService.js';

// File tree
export { fetchProjectFileTree } from './githubFileService.js';
export type { ProjectFile } from './githubFileService.js';

// Types
export type {
  GitHubInstallation,
  GitHubRepoLink,
  GitHubRepo,
  FileChange,
  FileDeletion,
  CommitInput,
  CreatePullRequestInput,
  PullRequestResult,
  CreatePullRequestFromTaskInput,
} from './githubTypes.js';
