export const templateTypeDefs = /* GraphQL */ `
  type TaskTemplate {
    taskTemplateId: ID!
    orgId: ID!
    projectId: ID
    name: String!
    description: String
    instructions: String
    acceptanceCriteria: String
    priority: String!
    taskType: String!
    estimatedHours: Float
    storyPoints: Int
    createdAt: String!
  }
`;

export const templateQueryFields = /* GraphQL */ `
  taskTemplates(projectId: ID): [TaskTemplate!]!
`;

export const templateMutationFields = /* GraphQL */ `
  createTaskTemplate(
    projectId: ID
    name: String!
    description: String
    instructions: String
    acceptanceCriteria: String
    priority: String
    taskType: String
    estimatedHours: Float
    storyPoints: Int
  ): TaskTemplate!
  updateTaskTemplate(
    taskTemplateId: ID!
    name: String
    description: String
    instructions: String
    acceptanceCriteria: String
    priority: String
    taskType: String
    estimatedHours: Float
    storyPoints: Int
  ): TaskTemplate!
  deleteTaskTemplate(taskTemplateId: ID!): Boolean!
  createTaskFromTemplate(templateId: ID!, projectId: ID!, title: String!): Task!
`;
