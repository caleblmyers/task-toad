export const initiativeTypeDefs = /* GraphQL */ `
  type Initiative {
    initiativeId: ID!
    orgId: ID!
    name: String!
    description: String
    status: String!
    targetDate: String
    createdAt: String!
    updatedAt: String!
    projects: [Project!]!
  }

  type InitiativeSummary {
    initiativeId: ID!
    name: String!
    status: String!
    targetDate: String
    projectCount: Int!
    totalTasks: Int!
    completedTasks: Int!
    completionPercent: Float!
    healthScore: Float
  }
`;

export const initiativeQueryFields = /* GraphQL */ `
  """List all initiatives for the current org."""
  initiatives: [Initiative!]!
  """Get a single initiative by ID."""
  initiative(initiativeId: ID!): Initiative
  """Get summary stats for an initiative (aggregate across its projects)."""
  initiativeSummary(initiativeId: ID!): InitiativeSummary!
`;

export const initiativeMutationFields = /* GraphQL */ `
  """Create a new initiative."""
  createInitiative(name: String!, description: String, targetDate: String): Initiative!
  """Update an initiative."""
  updateInitiative(initiativeId: ID!, name: String, description: String, status: String, targetDate: String): Initiative!
  """Delete an initiative."""
  deleteInitiative(initiativeId: ID!): Boolean!
  """Add a project to an initiative."""
  addProjectToInitiative(initiativeId: ID!, projectId: ID!): Initiative!
  """Remove a project from an initiative."""
  removeProjectFromInitiative(initiativeId: ID!, projectId: ID!): Initiative!
`;
