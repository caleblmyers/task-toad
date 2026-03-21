export const workflowTypeDefs = /* GraphQL */ `
  type WorkflowTransition {
    transitionId: ID!
    projectId: ID!
    fromStatus: String!
    toStatus: String!
    allowedRoles: [String!]
    createdAt: String!
  }
`;

export const workflowQueryFields = /* GraphQL */ `
  """List workflow transitions configured for a project."""
  workflowTransitions(projectId: ID!): [WorkflowTransition!]!
`;

export const workflowMutationFields = /* GraphQL */ `
  """Create a workflow transition rule for a project."""
  createWorkflowTransition(projectId: ID!, fromStatus: String!, toStatus: String!, allowedRoles: [String!]): WorkflowTransition!
  """Update a workflow transition rule (e.g. allowedRoles)."""
  updateWorkflowTransition(transitionId: ID!, allowedRoles: [String!]): WorkflowTransition!
  """Delete a workflow transition rule."""
  deleteWorkflowTransition(transitionId: ID!): Boolean!
`;
