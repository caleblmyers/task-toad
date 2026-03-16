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
  projects(includeArchived: Boolean): [Project!]!
  project(projectId: ID!): Project
  projectStats(projectId: ID!): ProjectStats!
  portfolioOverview: [ProjectSummary!]!
`;

export const projectMutationFields = /* GraphQL */ `
  createProject(name: String!): Project!
  updateProject(projectId: ID!, name: String, description: String, prompt: String, knowledgeBase: String, statuses: String): Project!
  archiveProject(projectId: ID!, archived: Boolean!): Project!
  generateProjectOptions(prompt: String!): [ProjectOption!]!
  createProjectFromOption(prompt: String!, title: String!, description: String!): Project!
`;
