// Core model interfaces shared between API and web.
// These match GraphQL response shapes (not raw Prisma models).

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

export interface Org {
  orgId: string;
  name: string;
  createdAt: string;
  hasApiKey: boolean;
  apiKeyHint?: string | null;
  monthlyBudgetCentsUSD?: number | null;
  budgetAlertThreshold?: number;
  promptLoggingEnabled?: boolean;
  plan?: string;
  licenseFeatures?: string[];
}

export interface OrgUser {
  userId: string;
  email: string;
  displayName: string | null;
  role: string | null;
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
  status: string;
  taskType: string;
  projectId: string;
  parentTaskId?: string | null;
  createdAt: string;
  sprintId?: string | null;
  sprintColumn?: string | null;
  assigneeId?: string | null;
  archived?: boolean;
  autoComplete?: boolean;
  position?: number | null;
  dueDate?: string | null;
  labels?: Label[];
  githubIssueNumber?: number | null;
  githubIssueUrl?: string | null;
  pullRequests?: TaskPullRequest[];
  commits?: TaskCommit[];
  children?: Task[];
  progress?: { total: number; completed: number; percentage: number };
  recurrenceRule?: string | null;
  recurrenceParentId?: string | null;
  attachments?: Attachment[];
  assignees?: TaskAssignee[];
  watchers?: TaskWatcher[];
  dependencies?: TaskDependency[];
  dependents?: TaskDependency[];
}

export interface Label {
  labelId: string;
  name: string;
  color: string;
}

export interface Attachment {
  attachmentId: string;
  taskId: string;
  fileName: string;
  fileKey: string;
  mimeType: string;
  sizeBytes: number;
  uploadedById: string;
  createdAt: string;
}

export interface TaskAssignee {
  id: string;
  user: { userId: string; email: string };
  assignedAt: string;
}

export interface TaskWatcher {
  id: string;
  user: { userId: string; email: string };
  watchedAt: string;
}

export interface TaskDependency {
  taskDependencyId: string;
  sourceTaskId: string;
  targetTaskId: string;
  linkType: 'blocks' | 'is_blocked_by' | 'relates_to' | 'duplicates' | 'informs';
  sourceTask?: Task;
  targetTask?: Task;
  createdAt: string;
}

export interface TaskPullRequest {
  id: string;
  prNumber: number;
  prUrl: string;
  prTitle: string;
  state: string;
}

export interface TaskCommit {
  id: string;
  sha: string;
  message: string;
  author: string;
  url: string;
  createdAt: string;
}

export interface Release {
  releaseId: string;
  projectId: string;
  name: string;
  description?: string | null;
  version: string;
  status: string;
  releaseDate?: string | null;
  releaseNotes?: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  tasks?: Task[];
}

export interface ReleaseTask {
  releaseId: string;
  taskId: string;
  addedAt: string;
}

export interface Sprint {
  sprintId: string;
  projectId: string;
  name: string;
  goal?: string | null;
  isActive: boolean;
  columns: string;
  wipLimits?: string | null;
  startDate: string | null;
  endDate: string | null;
  createdAt: string;
  closedAt: string | null;
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

export interface Notification {
  notificationId: string;
  type: string;
  title: string;
  body?: string | null;
  linkUrl?: string | null;
  isRead: boolean;
  createdAt: string;
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

export interface TeamSprintProgress {
  totalSprints: number;
  activeSprints: number;
  avgCompletionPercent: number;
}

export interface PortfolioRollup {
  totalProjects: number;
  totalTasks: number;
  totalVelocity: number;
  avgCycleTimeHours: number | null;
  teamSprintProgress: TeamSprintProgress;
  aggregateStatusDistribution: Array<{ label: string; count: number }>;
}

export interface TaskConnection {
  tasks: Task[];
  hasMore: boolean;
  total: number;
}

export interface CloseSprintResult {
  sprint: Sprint;
  nextSprint: Sprint | null;
}

export interface SprintPlanItem {
  name: string;
  taskIds: string[];
  totalHours: number;
}

export interface SavedFilter {
  savedFilterId: string;
  projectId: string;
  name: string;
  filters: string;
  viewType?: string | null;
  sortBy?: string | null;
  sortOrder?: string | null;
  groupBy?: string | null;
  visibleColumns?: string | null;
  isShared: boolean;
  isDefault: boolean;
  createdAt: string;
}

export interface TimeEntry {
  timeEntryId: string;
  taskId: string;
  userId: string;
  userEmail: string;
  userDisplayName: string | null;
  durationMinutes: number;
  description: string | null;
  loggedDate: string;
  billable: boolean;
  autoTracked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TaskTimeSummary {
  taskId: string;
  totalMinutes: number;
  estimatedHours: number | null;
  entries: TimeEntry[];
}

export interface UserTimeSummary {
  userId: string;
  userEmail: string;
  totalMinutes: number;
}

export interface SprintTimeSummary {
  sprintId: string;
  totalMinutes: number;
  byUser: UserTimeSummary[];
}

export interface KnowledgeEntry {
  knowledgeEntryId: string;
  projectId: string;
  title: string;
  content: string;
  source: string;
  category: string;
  createdAt: string;
  updatedAt: string;
}

export interface FilterCondition {
  field: string;
  operator: string;
  value?: string | null;
}

export interface FilterGroup {
  operator: 'AND' | 'OR';
  conditions?: FilterCondition[];
  groups?: FilterGroup[];
}

export interface UserCapacity {
  userCapacityId: string;
  userId: string;
  userEmail: string;
  hoursPerWeek: number;
  createdAt: string;
}

export interface UserTimeOff {
  userTimeOffId: string;
  userId: string;
  userEmail: string;
  startDate: string;
  endDate: string;
  description: string | null;
  createdAt: string;
}

export interface MemberCapacity {
  userId: string;
  userEmail: string;
  hoursPerWeek: number;
  timeOff: UserTimeOff[];
  availableHours: number;
}

export interface TeamCapacitySummary {
  members: MemberCapacity[];
  totalHoursPerWeek: number;
  availableHoursInRange: number;
}

export interface Report {
  reportId: string;
  projectId: string;
  type: string;
  data: Record<string, unknown>;
  createdAt: string;
}
