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
  TaskWatcher,
  TaskDependency,
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
  Release,
} from '@tasktoad/shared-types';

export interface Epic {
  taskId: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  position: number | null;
  createdAt: string;
  progress: { total: number; completed: number; percentage: number } | null;
}

export interface ChildTaskPreview {
  title: string;
  description: string;
  instructions?: string | null;
  estimatedHours?: number | null;
  priority?: string | null;
  acceptanceCriteria?: string | null;
  suggestedTools?: string | null;
}

export interface TaskPlanPreview {
  title: string;
  description: string;
  instructions: string;
  suggestedTools: string;
  estimatedHours: number | null;
  priority: string;
  dependsOn: string[];
  tasks: ChildTaskPreview[];
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
  budgetEnforcement: string;
  dailyAverageCostUSD: number | null;
  projectedMonthlyCostUSD: number | null;
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

export interface ActionPlanPreviewItem {
  actionType: string;
  label: string;
  config: string;
  requiresApproval: boolean;
  reasoning: string;
}

export interface ActionPlanPreview {
  actions: ActionPlanPreviewItem[];
  summary: string;
}

export interface TaskActionType {
  id: string;
  planId: string;
  actionType: string;
  label: string;
  config: string;
  position: number;
  status: string;
  requiresApproval: boolean;
  result: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
}

export interface TaskActionPlan {
  id: string;
  taskId: string;
  orgId: string;
  status: string;
  summary: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  actions: TaskActionType[];
}
