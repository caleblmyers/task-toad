export interface MeResponse {
  userId: string;
  email: string;
  orgId: string | null;
  role: 'org:admin' | 'org:member' | null;
  emailVerifiedAt: string | null;
}

export interface OrgInvite {
  inviteId: string;
  email: string;
  role: string;
  expiresAt: string;
  createdAt: string;
  acceptedAt: string | null;
}

export interface Project {
  projectId: string;
  name: string;
  description?: string | null;
  prompt?: string | null;
  knowledgeBase?: string | null;
  statuses: string;
  createdAt: string;
  archived?: boolean;
  githubRepositoryName?: string | null;
  githubRepositoryOwner?: string | null;
}

export interface GitHubInstallation {
  installationId: string;
  accountLogin: string;
  accountType: string;
  orgId: string | null;
  createdAt: string;
}

export interface GitHubRepoLink {
  repositoryId: string;
  repositoryName: string;
  repositoryOwner: string;
  installationId: string;
  defaultBranch: string;
}

export interface GitHubRepo {
  id: string;
  name: string;
  owner: string;
  fullName: string;
  isPrivate: boolean;
  defaultBranch: string;
}

export interface Comment {
  commentId: string;
  taskId: string;
  userId: string;
  userEmail: string;
  parentCommentId?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
  replies: Comment[];
}

export interface Activity {
  activityId: string;
  projectId?: string | null;
  taskId?: string | null;
  sprintId?: string | null;
  userId: string;
  userEmail: string;
  action: string;
  field?: string | null;
  oldValue?: string | null;
  newValue?: string | null;
  createdAt: string;
}

export interface ProjectStats {
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  completionPercent: number;
  tasksByStatus: Array<{ label: string; count: number }>;
  tasksByPriority: Array<{ label: string; count: number }>;
  tasksByAssignee: Array<{ userId: string; email: string; count: number }>;
  totalEstimatedHours: number;
  completedEstimatedHours: number;
}

export interface Task {
  taskId: string;
  title: string;
  description?: string | null;
  instructions?: string | null;
  acceptanceCriteria?: string | null;
  suggestedTools?: string | null;
  estimatedHours?: number | null;
  storyPoints?: number | null;
  priority: string;
  dependsOn?: string | null;
  status: string;
  taskType: string;
  projectId: string;
  parentTaskId?: string | null;
  createdAt: string;
  sprintId?:     string | null;
  sprintColumn?: string | null;
  assigneeId?:   string | null;
  archived?:     boolean;
  position?:     number | null;
  dueDate?:      string | null;
  labels?:       Label[];
  githubIssueNumber?: number | null;
  githubIssueUrl?:    string | null;
  pullRequests?:      TaskPullRequest[];
  commits?:           TaskCommit[];
  children?:          Task[];
  progress?:          { total: number; completed: number; percentage: number };
  assignees?:         TaskAssignee[];
}

export interface TaskAssignee {
  id: string;
  user: { userId: string; email: string };
  assignedAt: string;
}

export interface TaskCommit {
  id: string;
  sha: string;
  message: string;
  author: string;
  url: string;
  createdAt: string;
}

export interface TaskPullRequest {
  id: string;
  prNumber: number;
  prUrl: string;
  prTitle: string;
  state: string;
}

export interface TaskConnection {
  tasks:   Task[];
  hasMore: boolean;
  total:   number;
}

export interface Sprint {
  sprintId:  string;
  projectId: string;
  name:      string;
  goal?:     string | null;
  isActive:  boolean;
  columns:   string;
  startDate: string | null;
  endDate:   string | null;
  createdAt: string;
  closedAt:  string | null;
}

export interface CloseSprintResult {
  sprint:     Sprint;
  nextSprint: Sprint | null;
}

export interface OrgUser {
  userId: string;
  email:  string;
  role:   string | null;
}

export interface Label {
  labelId: string;
  name: string;
  color: string;
}

export interface SubtaskPreview {
  title: string;
  description: string;
}

export interface TaskPlanPreview {
  title: string;
  description: string;
  instructions: string;
  suggestedTools: string;
  estimatedHours: number | null;
  priority: string;
  dependsOn: string[];
  subtasks: SubtaskPreview[];
  acceptanceCriteria?: string | null;
}

export interface Org {
  orgId: string;
  name: string;
  createdAt: string;
  hasApiKey: boolean;
  apiKeyHint?: string | null;
  monthlyBudgetCentsUSD?: number | null;
  budgetAlertThreshold?: number;
}

export interface AIFeatureUsage {
  feature: string;
  calls: number;
  costUSD: number;
  avgLatencyMs: number;
}

export interface AIUsageSummary {
  totalCostUSD: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCalls: number;
  byFeature: AIFeatureUsage[];
  budgetUsedPercent: number | null;
  budgetLimitCentsUSD: number | null;
}

export interface ProjectOption {
  title: string;
  description: string;
}

export interface ToolSuggestion {
  name: string;
  category: string;
  reason: string;
}

export interface SprintPlanItem {
  name:       string;
  taskIds:    string[];
  totalHours: number;
}

export interface Notification {
  notificationId: string;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  isRead: boolean;
  createdAt: string;
}
