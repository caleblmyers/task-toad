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
  aiUsage(days: Int): AIUsageSummary!
  aiPromptHistory(taskId: String, projectId: String, limit: Int): [AIPromptLog!]!
  analyzeTrends(projectId: ID!, period: String): TrendAnalysis!
  analyzeSprintTransition(sprintId: ID!): SprintTransitionAnalysis!
  projectChat(projectId: ID!, question: String!): ProjectChatResponse!
  analyzeRepoDrift(projectId: ID!): DriftAnalysis!
`;

export const aiMutationFields = /* GraphQL */ `
  generateCodeFromTask(taskId: ID!, styleGuide: String): CodeGeneration!
  regenerateCodeFile(taskId: ID!, filePath: String!, feedback: String): GeneratedFile!
  reviewPullRequest(taskId: ID!, prNumber: Int!): CodeReview!
  parseBugReport(projectId: ID!, bugReport: String!): Task!
  previewPRDBreakdown(projectId: ID!, prd: String!): PRDBreakdown!
  commitPRDBreakdown(projectId: ID!, epics: String!): [Task!]!
  bootstrapProjectFromRepo(projectId: ID!): [Task!]!
  batchGenerateCode(projectId: ID!, taskIds: [ID!]!, styleGuide: String): CodeGeneration!
`;
