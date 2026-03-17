export const reportTypeDefs = /* GraphQL */ `
  type Report {
    id: ID!
    type: String!
    title: String!
    data: String!
    projectId: ID!
    sprintId: ID
    createdBy: ID!
    createdAt: String!
  }

  type StandupReport {
    completed: [String!]!
    inProgress: [String!]!
    blockers: [String!]!
    summary: String!
  }

  type SprintReportResult {
    summary: String!
    completionRate: Float!
    highlights: [String!]!
    concerns: [String!]!
    recommendations: [String!]!
  }

  type HealthIssue {
    title: String!
    severity: String!
    description: String!
  }

  type ProjectHealth {
    healthScore: Int!
    status: String!
    issues: [HealthIssue!]!
    strengths: [String!]!
    actionItems: [String!]!
  }

  type MeetingNotesResult {
    tasks: [ExtractedTask!]!
    summary: String!
  }

  type ReportConnection {
    reports: [Report!]!
    hasMore: Boolean!
    nextCursor: String
  }
`;

export const reportQueryFields = /* GraphQL */ `
  """List saved reports for a project with optional type filter and pagination."""
  reports(projectId: ID!, type: String, limit: Int, cursor: String): ReportConnection!
  """Generate a daily standup report summarizing recent task activity."""
  generateStandupReport(projectId: ID!): StandupReport!
  """Generate a sprint retrospective report with completion metrics and insights."""
  generateSprintReport(projectId: ID!, sprintId: ID!): SprintReportResult!
  """Analyze overall project health and return a score with actionable insights."""
  analyzeProjectHealth(projectId: ID!): ProjectHealth!
  """Extract actionable tasks from free-form meeting notes using AI."""
  extractTasksFromNotes(projectId: ID!, notes: String!): MeetingNotesResult!
`;

export const reportMutationFields = /* GraphQL */ `
  """Save a generated report for later reference."""
  saveReport(projectId: ID!, type: String!, title: String!, data: String!, sprintId: ID): Report!
  """Delete a previously saved report."""
  deleteReport(reportId: ID!): Boolean!
  """Generate a concise AI summary of a project's current state."""
  summarizeProject(projectId: ID!): String!
`;
