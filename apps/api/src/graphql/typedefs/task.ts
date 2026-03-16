export const taskTypeDefs = /* GraphQL */ `
  type Task {
    taskId: ID!
    title: String!
    description: String
    instructions: String
    suggestedTools: String
    estimatedHours: Float
    storyPoints: Int
    priority: String!
    dependsOn: String
    status: String!
    taskType: String!
    projectId: ID!
    parentTaskId: ID
    createdAt: String!
    sprintId: ID
    sprintColumn: String
    assigneeId: ID
    archived: Boolean!
    position: Float
    dueDate: String
    labels: [Label!]!
    githubIssueNumber: Int
    githubIssueUrl: String
    pullRequests: [TaskPullRequest!]!
    commits: [TaskCommit!]!
    children: [Task!]!
    progress: TaskProgress
  }

  type TaskProgress {
    total: Int!
    completed: Int!
    percentage: Float!
  }

  type TaskConnection {
    tasks:   [Task!]!
    hasMore: Boolean!
    total:   Int!
  }

  type Label {
    labelId: ID!
    name: String!
    color: String!
  }

  type SubtaskPreview {
    title: String!
    description: String!
  }

  type TaskPlanPreview {
    title: String!
    description: String!
    instructions: String!
    suggestedTools: String!
    estimatedHours: Float
    priority: String!
    dependsOn: [String!]!
    subtasks: [SubtaskPreview!]!
  }

  type ExtractedTask {
    title: String!
    description: String
    assigneeName: String
    priority: String
    status: String
  }

  input SubtaskInput {
    title: String!
    description: String!
  }

  input CommitTaskInput {
    title: String!
    description: String!
    instructions: String!
    suggestedTools: String!
    estimatedHours: Float
    priority: String
    dependsOn: [String!]!
    subtasks: [SubtaskInput!]!
  }
`;

export const taskQueryFields = /* GraphQL */ `
  tasks(projectId: ID!, parentTaskId: ID, limit: Int, offset: Int): TaskConnection!
  epics(projectId: ID!): [Task!]!
  labels: [Label!]!
`;

export const taskMutationFields = /* GraphQL */ `
  createTask(projectId: ID!, title: String!, status: String, taskType: String): Task!
  updateTask(taskId: ID!, title: String, status: String, description: String, instructions: String, dependsOn: String, sprintId: ID, sprintColumn: String, assigneeId: ID, dueDate: String, position: Float, archived: Boolean, storyPoints: Int, taskType: String): Task!
  createSubtask(parentTaskId: ID!, title: String!, taskType: String): Task!
  bulkUpdateTasks(taskIds: [ID!]!, status: String, assigneeId: ID, sprintId: ID, archived: Boolean): [Task!]!

  createLabel(name: String!, color: String): Label!
  deleteLabel(labelId: ID!): Boolean!
  addTaskLabel(taskId: ID!, labelId: ID!): Task!
  removeTaskLabel(taskId: ID!, labelId: ID!): Task!

  generateTaskPlan(projectId: ID!, context: String): [Task!]!
  previewTaskPlan(projectId: ID!, context: String, appendToTitles: [String!]): [TaskPlanPreview!]!
  commitTaskPlan(projectId: ID!, tasks: [CommitTaskInput!]!, clearExisting: Boolean): [Task!]!
  expandTask(taskId: ID!, context: String): [Task!]!
  generateTaskInstructions(taskId: ID!): Task!
`;
