// Re-export shared types (core models used by both API and web)
export type {
  MeResponse,
  OrgInvite,
  Org,
  OrgUser,
  Project,
  Task,
  Label,
  Attachment,
  TaskAssignee,
  TaskPullRequest,
  TaskCommit,
  Sprint,
  Comment,
  Activity,
  Notification,
  GitHubInstallation,
  GitHubRepoLink,
  GitHubRepo,
} from '@tasktoad/shared-types';

// Import shared types needed by web-only interfaces below
import type { Task, Sprint } from '@tasktoad/shared-types';

// Web-only types (query-specific aggregates, not shared with API)

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

export interface TaskConnection {
  tasks: Task[];
  hasMore: boolean;
  total: number;
}

export interface CloseSprintResult {
  sprint: Sprint;
  nextSprint: Sprint | null;
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
  name: string;
  taskIds: string[];
  totalHours: number;
}

export interface CodeReviewComment {
  file: string;
  line: number | null;
  severity: string;
  comment: string;
}

export interface CodeReview {
  summary: string;
  approved: boolean;
  comments: CodeReviewComment[];
  suggestions: string[];
}
