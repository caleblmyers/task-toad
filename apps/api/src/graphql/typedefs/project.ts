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
    viewType: String
    sortBy: String
    sortOrder: String
    groupBy: String
    visibleColumns: String
    isShared: Boolean!
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

  type TeamSprintProgress {
    totalSprints: Int!
    activeSprints: Int!
    avgCompletionPercent: Float!
  }

  type PortfolioRollup {
    totalProjects: Int!
    totalTasks: Int!
    totalVelocity: Int!
    avgCycleTimeHours: Float
    teamSprintProgress: TeamSprintProgress!
    aggregateStatusDistribution: [CountEntry!]!
  }

  type ScaffoldResult {
    success: Boolean!
    filesCreated: Int!
    summary: String!
    commitUrl: String
  }

  input ScaffoldConfigInput {
    framework: String!
    language: String!
    packages: [String!]!
    projectType: String!
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
  sharedViews(projectId: ID!): [SavedFilter!]!
  """Get aggregate rollup metrics across all projects in the org."""
  portfolioRollup: PortfolioRollup!
`;

export const projectMutationFields = /* GraphQL */ `
  """Create a new project in the user's organization."""
  createProject(name: String!): Project!
  """Update project settings (name, description, prompt, statuses, etc.)."""
  updateProject(projectId: ID!, name: String, description: String, prompt: String, knowledgeBase: String, statuses: String): Project!
  archiveProject(projectId: ID!, archived: Boolean!): Project!
  generateProjectOptions(prompt: String!): [ProjectOption!]!
  createProjectFromOption(prompt: String!, title: String!, description: String!): Project!
  saveFilter(projectId: ID!, name: String!, filters: String!, viewType: String, sortBy: String, sortOrder: String, groupBy: String, visibleColumns: String, isShared: Boolean): SavedFilter!
  updateFilter(savedFilterId: ID!, name: String, filters: String, viewType: String, sortBy: String, sortOrder: String, groupBy: String, visibleColumns: String, isShared: Boolean): SavedFilter!
  deleteFilter(savedFilterId: ID!): Boolean!
  """Generate a project scaffold from a structured config and commit it to the GitHub repo."""
  scaffoldProject(projectId: ID!, config: ScaffoldConfigInput!, options: String): ScaffoldResult!
`;
