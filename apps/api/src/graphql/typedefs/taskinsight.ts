export const taskInsightTypeDefs = /* GraphQL */ `
  type TaskInsight {
    taskInsightId: ID!
    sourceTaskId: ID!
    targetTaskId: ID
    projectId: ID!
    type: String!
    content: String!
    autoApplied: Boolean!
    createdAt: String!
    sourceTask: Task
    targetTask: Task
  }
`;

export const taskInsightQueryFields = /* GraphQL */ `
  """List task insights for a project, optionally filtered by task."""
  taskInsights(projectId: ID!, taskId: ID): [TaskInsight!]!
`;

export const taskInsightMutationFields = /* GraphQL */ `
  """Dismiss (delete) a task insight."""
  dismissInsight(taskInsightId: ID!): Boolean!
`;
