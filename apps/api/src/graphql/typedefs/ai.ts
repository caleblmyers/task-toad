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

  type AIUsageSummary {
    totalCostUSD: Float!
    totalInputTokens: Int!
    totalOutputTokens: Int!
    totalCalls: Int!
    byFeature: [AIFeatureUsage!]!
    budgetUsedPercent: Float
    budgetLimitCentsUSD: Int
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

  type ProjectChatResponse {
    answer: String!
    references: [ChatReference!]!
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
`;

export const aiMutationFields = /* GraphQL */ `
  """Generate implementation code for a task. Requires task to have instructions."""
  generateCodeFromTask(taskId: ID!, styleGuide: String): CodeGeneration!
  """Generate code scoped to a single subtask using parent task context."""
  generateCodeFromSubtask(taskId: ID!, subtaskId: ID!, styleGuide: String): CodeGeneration!
  """Regenerate a single file with optional feedback for refinement."""
  regenerateCodeFile(taskId: ID!, filePath: String!, feedback: String): GeneratedFile!
  """Run AI code review on a GitHub pull request linked to a task."""
  reviewPullRequest(taskId: ID!, prNumber: Int!): CodeReview!
  """Parse a bug report into a structured task with title, description, and priority."""
  parseBugReport(projectId: ID!, bugReport: String!): Task!
  """Break down a PRD document into epics and tasks for preview."""
  previewPRDBreakdown(projectId: ID!, prd: String!): PRDBreakdown!
  commitPRDBreakdown(projectId: ID!, epics: String!): [Task!]!
  """Analyze a linked GitHub repo and auto-generate tasks from its structure."""
  bootstrapProjectFromRepo(projectId: ID!): [Task!]!
  """Generate code for multiple tasks at once (max 5)."""
  batchGenerateCode(projectId: ID!, taskIds: [ID!]!, styleGuide: String): CodeGeneration!
`;
