export const releaseTypeDefs = /* GraphQL */ `
  type Release {
    releaseId:    ID!
    projectId:    ID!
    name:         String!
    description:  String
    version:      String!
    status:       String!
    releaseDate:  String
    releaseNotes: String
    createdBy:    ID!
    createdAt:    String!
    updatedAt:    String!
    tasks:        [Task!]!
  }

  type ReleaseConnection {
    releases:   [Release!]!
    hasMore:    Boolean!
    nextCursor: String
  }
`;

export const releaseQueryFields = /* GraphQL */ `
  """List releases for a project, optionally filtered by status, with cursor pagination."""
  releases(projectId: ID!, status: String, limit: Int, cursor: String): ReleaseConnection!
  """Get a single release by ID."""
  release(releaseId: ID!): Release!
  """Get daily burndown data for a release showing task completion over time."""
  releaseBurndown(releaseId: ID!): [ReleaseBurndownPoint!]!
`;

export const releaseBurndownTypeDefs = /* GraphQL */ `
  type ReleaseBurndownPoint {
    date: String!
    totalTasks: Int!
    completedTasks: Int!
    remainingTasks: Int!
  }
`;

export const releaseMutationFields = /* GraphQL */ `
  """Create a new release in a project."""
  createRelease(projectId: ID!, name: String!, version: String!, description: String, releaseDate: String): Release!
  """Update an existing release."""
  updateRelease(releaseId: ID!, name: String, version: String, description: String, status: String, releaseDate: String, releaseNotes: String): Release!
  """Delete a release."""
  deleteRelease(releaseId: ID!): Boolean!
  """Add a task to a release."""
  addTaskToRelease(releaseId: ID!, taskId: ID!): Boolean!
  """Remove a task from a release."""
  removeTaskFromRelease(releaseId: ID!, taskId: ID!): Boolean!
  """Generate AI-powered release notes from associated tasks."""
  generateReleaseNotes(releaseId: ID!): Release!
`;
