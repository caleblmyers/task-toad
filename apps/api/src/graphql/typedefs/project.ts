export const projectTypeDefs = /* GraphQL */ `
  type Project {
    projectId: ID!
    name: String!
    description: String
    prompt: String
    knowledgeBase: String
    statuses: String!
    createdAt: String!
    orgId: ID!
    archived: Boolean!
    githubRepositoryName: String
    githubRepositoryOwner: String
  }

  type SavedFilter {
    savedFilterId: ID!
    projectId: ID!
    name: String!
    filters: String!
    isDefault: Boolean!
    createdAt: String!
  }

  type ProjectOption {
    title: String!
    description: String!
  }

  type CountEntry {
    label: String!
    count: Int!
  }

  type AssigneeCount {
    userId: ID!
    email: String!
    count: Int!
  }

  type ProjectStats {
    totalTasks: Int!
    completedTasks: Int!
    overdueTasks: Int!
    completionPercent: Float!
    tasksByStatus: [CountEntry!]!
    tasksByPriority: [CountEntry!]!
    tasksByAssignee: [AssigneeCount!]!
    totalEstimatedHours: Float!
    completedEstimatedHours: Float!
  }

  type ProjectSummary {
    projectId: String!
    name: String!
    totalTasks: Int!
    completedTasks: Int!
    overdueTasks: Int!
    completionPercent: Float!
    activeSprint: String
    healthScore: Int
    statusDistribution: [CountEntry!]!
  }
`;

export const projectQueryFields = /* GraphQL */ `
  """List all projects in the user's organization."""
  projects(includeArchived: Boolean): [Project!]!
  """Get a single project by ID."""
  project(projectId: ID!): Project
  """Get task statistics for a project (counts, completion, etc.)."""
  projectStats(projectId: ID!): ProjectStats!
  """Get a summary of all projects for the portfolio dashboard."""
  portfolioOverview: [ProjectSummary!]!
  savedFilters(projectId: ID!): [SavedFilter!]!
`;

export const projectMutationFields = /* GraphQL */ `
  """Create a new project in the user's organization."""
  createProject(name: String!): Project!
  """Update project settings (name, description, prompt, statuses, etc.)."""
  updateProject(projectId: ID!, name: String, description: String, prompt: String, knowledgeBase: String, statuses: String): Project!
  archiveProject(projectId: ID!, archived: Boolean!): Project!
  generateProjectOptions(prompt: String!): [ProjectOption!]!
  createProjectFromOption(prompt: String!, title: String!, description: String!): Project!
  saveFilter(projectId: ID!, name: String!, filters: String!): SavedFilter!
  updateFilter(savedFilterId: ID!, name: String, filters: String): SavedFilter!
  deleteFilter(savedFilterId: ID!): Boolean!
`;
