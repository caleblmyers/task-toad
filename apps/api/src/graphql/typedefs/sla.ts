export const slaTypeDefs = /* GraphQL */ `
  type SLAPolicy {
    slaPolicyId: ID!
    projectId: ID!
    orgId: ID!
    name: String!
    responseTimeHours: Int!
    resolutionTimeHours: Int!
    priority: String
    enabled: Boolean!
    createdAt: String!
  }

  type SLATimer {
    slaTimerId: ID!
    taskId: ID!
    policyId: ID!
    orgId: ID!
    startedAt: String!
    respondedAt: String
    resolvedAt: String
    responseBreached: Boolean!
    resolutionBreached: Boolean!
    policy: SLAPolicy!
    timeToResponseHours: Float
    timeToResolutionHours: Float
  }
`;

export const slaQueryFields = /* GraphQL */ `
  """List SLA policies for a project."""
  slaPolicies(projectId: ID!): [SLAPolicy!]!
  """Get SLA timer status for a task."""
  taskSLAStatus(taskId: ID!): [SLATimer!]!
`;

export const slaMutationFields = /* GraphQL */ `
  """Create an SLA policy for a project."""
  createSLAPolicy(projectId: ID!, name: String!, responseTimeHours: Int!, resolutionTimeHours: Int!, priority: String): SLAPolicy!
  """Update an SLA policy."""
  updateSLAPolicy(slaPolicyId: ID!, name: String, responseTimeHours: Int, resolutionTimeHours: Int, priority: String, enabled: Boolean): SLAPolicy!
  """Delete an SLA policy."""
  deleteSLAPolicy(slaPolicyId: ID!): Boolean!
`;
