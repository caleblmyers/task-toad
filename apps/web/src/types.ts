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
  statuses: string;
  createdAt: string;
  archived?: boolean;
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
  suggestedTools?: string | null;
  estimatedHours?: number | null;
  priority: string;
  dependsOn?: string | null;
  status: string;
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
}

export interface Org {
  orgId: string;
  name: string;
  createdAt: string;
  hasApiKey: boolean;
  apiKeyHint?: string | null;
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
