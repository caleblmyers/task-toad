/** Shared types for the GitHub App integration module. */

export interface GitHubInstallation {
  installationId: string;
  accountLogin: string;
  accountType: string;
  createdAt: Date;
}

export interface GitHubRepoLink {
  repositoryId: string;
  repositoryName: string;
  repositoryOwner: string;
  installationId: string;
  defaultBranch: string;
}

export interface FileChange {
  path: string;
  content: string;
}

export interface FileDeletion {
  path: string;
}

export interface CommitInput {
  branch: string;
  message: string;
  additions: FileChange[];
  deletions?: FileDeletion[];
}

export interface CreatePullRequestInput {
  repositoryId: string;
  baseRefName: string;
  headRefName: string;
  title: string;
  body: string;
}

export interface PullRequestResult {
  pullRequestId: string;
  number: number;
  url: string;
  title: string;
}

export interface CreatePullRequestFromTaskInput {
  projectId: string;
  taskId: string;
  files: FileChange[];
}

export interface GitHubWebhookEvent {
  action: string;
  installation?: {
    id: number;
    account: {
      login: string;
      type: string;
    };
  };
  repositories_added?: Array<{ full_name: string }>;
  repositories_removed?: Array<{ full_name: string }>;
  issue?: {
    node_id: string;
    number: number;
    title: string;
    state: string;
  };
  pull_request?: {
    node_id: string;
    number: number;
    title: string;
    state: string;
    merged: boolean;
    html_url: string;
  };
  review?: {
    state: string; // 'approved' | 'changes_requested' | 'commented' | 'dismissed'
  };
  ref?: string;
  repository?: {
    name: string;
    owner: { login?: string; name?: string };
  };
  commits?: Array<{
    id: string;
    message: string;
    url: string;
    author: { username?: string; name?: string };
  }>;
  sender?: { login: string };
}

export interface GitHubRepo {
  id: string;
  name: string;
  owner: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
}

export interface CachedToken {
  token: string;
  expiresAt: number;
}
