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
  ProjectStats,
  TaskConnection,
  CloseSprintResult,
  SprintPlanItem,
} from '@tasktoad/shared-types';

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
