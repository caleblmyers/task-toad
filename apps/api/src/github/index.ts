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
export { createBranch, commitFiles, getDefaultBranchOid, commitFilesToEmptyRepo } from './githubCommitService.js';

// Pull requests
export { createPullRequest, getPullRequestDiff, getPullRequestComments, getPullRequestFiles } from './githubPullRequestService.js';

// Issues
export { createGitHubIssue, updateGitHubIssueState, getGitHubIssue, getGitHubIssueByNumber } from './githubIssueService.js';

// Task linking
export { extractTaskIds, linkCommitsToTasks } from './githubTaskLinker.js';

// Orchestration
export { createPullRequestFromTask } from './githubService.js';

// File tree
export { fetchProjectFileTree, fetchFileContent, fetchFileContentCached } from './githubFileService.js';
export type { ProjectFile } from './githubFileService.js';

// Repo context
export { resolveCodeGenContext, resolveReviewContext } from './repoContextService.js';
export type { RepoContext, RelevantFile } from './repoContextService.js';

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
