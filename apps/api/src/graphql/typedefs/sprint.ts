export const sprintTypeDefs = /* GraphQL */ `
  type Sprint {
    sprintId:  ID!
    projectId: ID!
    name:      String!
    goal:      String
    isActive:  Boolean!
    columns:   String!
    wipLimits: String
    startDate: String
    endDate:   String
    createdAt: String!
    closedAt:  String
  }

  type SprintPlanItem {
    name:       String!
    taskIds:    [ID!]!
    totalHours: Float!
  }

  input IncompleteTaskAction {
    taskId:         ID!
    action:         String!
    targetSprintId: ID
  }

  type CloseSprintResult {
    sprint:     Sprint!
    nextSprint: Sprint
  }

  input SprintPlanInput {
    name:    String!
    taskIds: [ID!]!
  }

  type SprintVelocityPoint {
    sprintId: ID!
    sprintName: String!
    completedTasks: Int!
    completedHours: Float!
    totalTasks: Int!
    totalHours: Float!
    pointsCompleted: Int!
    pointsTotal: Int!
  }

  type BurndownDay {
    date: String!
    remaining: Int!
    completed: Int!
    added: Int!
  }

  type SprintBurndownData {
    days: [BurndownDay!]!
    totalScope: Int!
    sprintName: String!
    startDate: String!
    endDate: String!
  }

  type WipStatus {
    column: String!
    taskCount: Int!
    limit: Int
    exceeded: Boolean!
  }

  type StatusCount {
    status: String!
    count: Int!
  }

  type CumulativeFlowDay {
    date: String!
    statusCounts: [StatusCount!]!
  }

  type CumulativeFlowData {
    days: [CumulativeFlowDay!]!
    statuses: [String!]!
  }
`;

export const sprintQueryFields = /* GraphQL */ `
  """List all sprints for a project, ordered by creation date."""
  sprints(projectId: ID!): [Sprint!]!
  """Get velocity data across completed sprints for a project."""
  sprintVelocity(projectId: ID!): [SprintVelocityPoint!]!
  """Get daily burndown data for a specific sprint."""
  sprintBurndown(sprintId: ID!): SprintBurndownData!
  """Get cycle time and lead time metrics for completed tasks in a project."""
  cycleTimeMetrics(projectId: ID!, sprintId: ID, fromDate: String, toDate: String): ProjectCycleMetrics!
  """Get WIP status for each column in a sprint."""
  sprintWipStatus(sprintId: ID!): [WipStatus!]!
  """Get cumulative flow diagram data for a project."""
  cumulativeFlow(projectId: ID!, sprintId: ID, fromDate: String, toDate: String): CumulativeFlowData!
`;

export const sprintMutationFields = /* GraphQL */ `
  """Create a new sprint in a project."""
  createSprint(projectId: ID!, name: String!, goal: String, columns: String, startDate: String, endDate: String, wipLimits: String): Sprint!
  updateSprint(sprintId: ID!, name: String, goal: String, columns: String, isActive: Boolean, startDate: String, endDate: String, wipLimits: String): Sprint!
  deleteSprint(sprintId: ID!): Boolean!
  closeSprint(sprintId: ID!, incompleteTaskActions: [IncompleteTaskAction!]!): CloseSprintResult!

  previewSprintPlan(projectId: ID!, sprintLengthWeeks: Int!, teamSize: Int!): [SprintPlanItem!]!
  commitSprintPlan(projectId: ID!, sprints: [SprintPlanInput!]!): [Sprint!]!
`;
