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
  reports(projectId: ID!, type: String, limit: Int, cursor: String): ReportConnection!
  generateStandupReport(projectId: ID!): StandupReport!
  generateSprintReport(projectId: ID!, sprintId: ID!): SprintReportResult!
  analyzeProjectHealth(projectId: ID!): ProjectHealth!
  extractTasksFromNotes(projectId: ID!, notes: String!): MeetingNotesResult!
`;

export const reportMutationFields = /* GraphQL */ `
  saveReport(projectId: ID!, type: String!, title: String!, data: String!, sprintId: ID): Report!
  deleteReport(reportId: ID!): Boolean!
  summarizeProject(projectId: ID!): String!
`;
