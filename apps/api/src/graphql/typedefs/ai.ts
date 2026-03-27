export const aiTypeDefs = /* GraphQL */ `
  type CodeReviewComment {
    file: String!
    line: Int
    severity: String!
    comment: String!
  }

  type CodeReview {
    summary: String!
    approved: Boolean!
    comments: [CodeReviewComment!]!
    suggestions: [String!]!
  }

  type GeneratedFile {
    path: String!
    content: String!
    language: String!
    description: String!
  }

  type CodeGeneration {
    files: [GeneratedFile!]!
    summary: String!
    estimatedTokensUsed: Int!
    delegationHint: String
  }

  type AIUsageLog {
    id: ID!
    feature: String!
    model: String!
    inputTokens: Int!
    outputTokens: Int!
    costUSD: Float!
    latencyMs: Int!
    cached: Boolean!
    createdAt: String!
  }

  type BudgetWarning {
    message: String!
    usedPercent: Float!
  }

  type AIUsageSummary {
    totalCostUSD: Float!
    totalInputTokens: Int!
    totalOutputTokens: Int!
    totalCalls: Int!
    byFeature: [AIFeatureUsage!]!
    budgetUsedPercent: Float
    budgetLimitCentsUSD: Int
    budgetEnforcement: String!
    dailyAverageCostUSD: Float
    projectedMonthlyCostUSD: Float
  }

  type AIFeatureUsage {
    feature: String!
    calls: Int!
    costUSD: Float!
    avgLatencyMs: Int!
  }

  type PRDTask {
    title: String!
    description: String!
    priority: String!
    estimatedHours: Float
    acceptanceCriteria: String
  }

  type PRDEpic {
    title: String!
    description: String!
    tasks: [PRDTask!]!
  }

  type PRDBreakdown {
    epics: [PRDEpic!]!
  }

  type TransitionTask {
    taskId: ID!
    reason: String!
  }

  type SprintTransitionAnalysis {
    summary: String!
    carryOver: [TransitionTask!]!
    deprioritize: [TransitionTask!]!
    recommendations: [String!]!
  }

  type ChatReference {
    type: String!
    id: ID!
    title: String!
  }

  type ChatAction {
    type: String!
    label: String!
    data: String!
  }

  type ProjectChatResponse {
    answer: String!
    references: [ChatReference!]!
    suggestedActions: [ChatAction!]!
  }

  input ChatActionInput {
    type: String!
    data: String!
  }

  type ApplyChatActionResult {
    success: Boolean!
    message: String!
    taskId: ID
  }

  type WhatNextSuggestion {
    title: String!
    reason: String!
    priority: String!
    action: ChatAction!
  }

  type WhatNextResponse {
    summary: String!
    suggestions: [WhatNextSuggestion!]!
  }

  type DriftOutdatedTask {
    taskId: ID!
    title: String!
    reason: String!
  }

  type DriftUntrackedWork {
    description: String!
    suggestedTaskTitle: String!
  }

  type DriftCompletedButOpen {
    taskId: ID!
    title: String!
    evidence: String!
  }

  type DriftAnalysis {
    summary: String!
    outdatedTasks: [DriftOutdatedTask!]!
    untrackedWork: [DriftUntrackedWork!]!
    completedButOpen: [DriftCompletedButOpen!]!
  }

  type AIPromptLog {
    id: String!
    feature: String!
    taskId: String
    projectId: String
    input: String!
    output: String!
    inputTokens: Int!
    outputTokens: Int!
    costUSD: Float!
    latencyMs: Int!
    model: String!
    cached: Boolean!
    createdAt: String!
  }

  type TrendAnalysis {
    period: String!
    completionTrend: String!
    velocityTrend: String!
    healthTrend: String!
    insights: [String!]!
    recommendations: [String!]!
  }

  type StackConfig {
    framework: String!
    language: String!
    packages: [String!]!
    projectType: String!
  }

  type StackOption {
    label: String!
    description: String!
    rationale: String!
    config: StackConfig!
  }

  type StackRecommendation {
    recommended: StackOption!
    alternatives: [StackOption!]!
  }

  type SessionConfig {
    autonomyLevel: String!
    budgetCapCents: Int
    failurePolicy: String!
    maxRetries: Int
    scopeLimit: Int
    timeLimitMinutes: Int
  }

  type SessionProgress {
    tasksCompleted: Int!
    tasksFailed: Int!
    tasksSkipped: Int!
    tokensUsed: Int!
    estimatedCostCents: Int!
  }

  type Session {
    id: ID!
    projectId: ID!
    status: String!
    config: SessionConfig!
    taskIds: [ID!]!
    progress: SessionProgress
    startedAt: String
    pausedAt: String
    completedAt: String
    createdAt: String!
  }

  input SessionConfigInput {
    autonomyLevel: String!
    budgetCapCents: Int
    failurePolicy: String!
    maxRetries: Int
    scopeLimit: Int
    timeLimitMinutes: Int
  }
`;

export const aiQueryFields = /* GraphQL */ `
  """Get AI usage statistics for the organization over the given number of days."""
  aiUsage(days: Int): AIUsageSummary!
  """View historical AI prompt inputs and outputs, filterable by task or project."""
  aiPromptHistory(taskId: String, projectId: String, limit: Int): [AIPromptLog!]!
  """Analyze completion, velocity, and health trends from saved reports."""
  analyzeTrends(projectId: ID!, period: String): TrendAnalysis!
  """Analyze incomplete sprint tasks and recommend carry-over vs. deprioritize."""
  analyzeSprintTransition(sprintId: ID!): SprintTransitionAnalysis!
  """Ask a natural-language question about a project and get an AI answer."""
  projectChat(projectId: ID!, question: String!): ProjectChatResponse!
  """Compare repo activity (commits, PRs) against task board to find drift."""
  analyzeRepoDrift(projectId: ID!): DriftAnalysis!
  """Preview a hierarchical plan (epics → tasks → subtasks) before committing."""
  previewHierarchicalPlan(projectId: ID!, prompt: String!): HierarchicalPlanPreview!
  """Recommend a tech stack for a project based on its description."""
  recommendStack(projectId: ID!): StackRecommendation!
  """Analyze project state and suggest the highest-priority next work."""
  whatNext(projectId: ID!): WhatNextResponse!
  """List sessions for a project."""
  sessions(projectId: ID!): [Session!]!
  """Get a single session by ID."""
  session(sessionId: ID!): Session
`;

export const aiMutationFields = /* GraphQL */ `
  """Run AI code review on a GitHub pull request linked to a task."""
  reviewPullRequest(taskId: ID!, prNumber: Int!): CodeReview!
  """Parse a bug report into a structured task with title, description, and priority."""
  parseBugReport(projectId: ID!, bugReport: String!): Task!
  """Break down a PRD document into epics and tasks for preview."""
  previewPRDBreakdown(projectId: ID!, prd: String!): PRDBreakdown!
  commitPRDBreakdown(projectId: ID!, epics: String!): [Task!]!
  """Analyze a linked GitHub repo and auto-generate tasks from its structure."""
  bootstrapProjectFromRepo(projectId: ID!): [Task!]!
  """Refresh the repo profile (knowledge base) from the linked GitHub repository."""
  refreshRepoProfile(projectId: ID!): Project!
  """Apply a suggested action from projectChat (create task, update status, etc.)."""
  applyChatAction(projectId: ID!, action: ChatActionInput!): ApplyChatActionResult!
  """Create a new execution session for a set of tasks."""
  createSession(projectId: ID!, taskIds: [ID!]!, config: SessionConfigInput!): Session!
  """Start a draft session — marks included tasks for auto-complete and triggers orchestration."""
  startSession(sessionId: ID!): Session!
  """Pause a running session."""
  pauseSession(sessionId: ID!): Session!
  """Cancel a session and stop any running action plans."""
  cancelSession(sessionId: ID!): Session!
`;
