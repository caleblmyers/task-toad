export const taskActionTypeDefs = /* GraphQL */ `
  type TaskActionPlan {
    id: ID!
    taskId: ID!
    orgId: ID!
    status: String!
    summary: String
    createdById: ID!
    createdAt: String!
    updatedAt: String!
    actions: [TaskAction!]!
  }

  type TaskAction {
    id: ID!
    planId: ID!
    actionType: String!
    label: String!
    config: String!
    position: Int!
    status: String!
    requiresApproval: Boolean!
    result: String
    errorMessage: String
    startedAt: String
    completedAt: String
    createdAt: String!
  }

  type ActionPlanPreviewItem {
    actionType: String!
    label: String!
    config: String!
    requiresApproval: Boolean!
    reasoning: String!
  }

  type ActionPlanPreview {
    actions: [ActionPlanPreviewItem!]!
    summary: String!
  }

  input ActionInput {
    actionType: String!
    label: String!
    config: String!
    requiresApproval: Boolean!
  }
`;

export const taskActionQueryFields = /* GraphQL */ `
  taskActionPlan(taskId: ID!): TaskActionPlan
  taskActionHistory(taskId: ID!): [TaskActionPlan!]!
`;

export const taskActionMutationFields = /* GraphQL */ `
  previewActionPlan(taskId: ID!): ActionPlanPreview!
  commitActionPlan(taskId: ID!, actions: [ActionInput!]!): TaskActionPlan!
  executeActionPlan(planId: ID!): TaskActionPlan!
  completeManualAction(actionId: ID!): TaskAction!
  skipAction(actionId: ID!): TaskAction!
  retryAction(actionId: ID!): TaskAction!
  cancelActionPlan(planId: ID!): TaskActionPlan!
`;
