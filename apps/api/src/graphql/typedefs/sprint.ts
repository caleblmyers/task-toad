export const sprintTypeDefs = /* GraphQL */ `
  type Sprint {
    sprintId:  ID!
    projectId: ID!
    name:      String!
    goal:      String
    isActive:  Boolean!
    columns:   String!
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
`;

export const sprintQueryFields = /* GraphQL */ `
  sprints(projectId: ID!): [Sprint!]!
  sprintVelocity(projectId: ID!): [SprintVelocityPoint!]!
  sprintBurndown(sprintId: ID!): SprintBurndownData!
`;

export const sprintMutationFields = /* GraphQL */ `
  createSprint(projectId: ID!, name: String!, goal: String, columns: String, startDate: String, endDate: String): Sprint!
  updateSprint(sprintId: ID!, name: String, goal: String, columns: String, isActive: Boolean, startDate: String, endDate: String): Sprint!
  deleteSprint(sprintId: ID!): Boolean!
  closeSprint(sprintId: ID!, incompleteTaskActions: [IncompleteTaskAction!]!): CloseSprintResult!

  previewSprintPlan(projectId: ID!, sprintLengthWeeks: Int!, teamSize: Int!): [SprintPlanItem!]!
  commitSprintPlan(projectId: ID!, sprints: [SprintPlanInput!]!): [Sprint!]!
`;
