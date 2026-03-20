export const taskTypeDefs = /* GraphQL */ `
  type Task {
    taskId: ID!
    title: String!
    description: String
    instructions: String
    acceptanceCriteria: String
    suggestedTools: String
    estimatedHours: Float
    storyPoints: Int
    priority: String!
    status: String!
    taskType: String!
    projectId: ID!
    parentTaskId: ID
    createdAt: String!
    sprintId: ID
    sprintColumn: String
    assigneeId: ID
    archived: Boolean!
    autoComplete: Boolean!
    position: Float
    dueDate: String
    labels: [Label!]!
    githubIssueNumber: Int
    githubIssueUrl: String
    pullRequests: [TaskPullRequest!]!
    commits: [TaskCommit!]!
    children: [Task!]!
    progress: TaskProgress
    customFieldValues: [CustomFieldValue!]!
    recurrenceRule: String
    recurrenceParentId: ID
    attachments: [Attachment!]!
    assignees: [TaskAssignee!]!
    watchers: [TaskWatcher!]!
    dependencies: [TaskDependency!]!
    dependents: [TaskDependency!]!
  }

  enum DependencyLinkType {
    blocks
    is_blocked_by
    relates_to
    duplicates
    informs
  }

  type TaskDependency {
    taskDependencyId: ID!
    sourceTaskId: ID!
    targetTaskId: ID!
    linkType: DependencyLinkType!
    sourceTask: Task
    targetTask: Task
    createdAt: String!
  }

  type Attachment {
    attachmentId: ID!
    taskId: ID!
    fileName: String!
    fileKey: String!
    mimeType: String!
    sizeBytes: Int!
    uploadedById: ID!
    createdAt: String!
  }

  type TaskAssignee {
    id: ID!
    user: User!
    assignedAt: String!
  }

  type TaskWatcher {
    id: ID!
    user: User!
    watchedAt: String!
  }

  type TaskCycleMetrics {
    taskId: ID!
    title: String!
    status: String!
    leadTimeHours: Float
    cycleTimeHours: Float
    startedAt: String
    completedAt: String
  }

  type ProjectCycleMetrics {
    tasks: [TaskCycleMetrics!]!
    avgLeadTimeHours: Float!
    avgCycleTimeHours: Float!
    p50LeadTimeHours: Float!
    p85LeadTimeHours: Float!
    p50CycleTimeHours: Float!
    p85CycleTimeHours: Float!
    totalCompleted: Int!
  }

  type CustomField {
    customFieldId: ID!
    name: String!
    fieldType: String!
    options: String
    required: Boolean!
    position: Int!
  }

  type CustomFieldValue {
    customFieldValueId: ID!
    field: CustomField!
    value: String!
  }

  type TaskProgress {
    total: Int!
    completed: Int!
    percentage: Float!
  }

  type UpdateTaskResult {
    task: Task!
    warnings: [String!]!
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

  type ChildTaskPreview {
    title: String!
    description: String!
    instructions: String
    estimatedHours: Float
    priority: String
    acceptanceCriteria: String
    suggestedTools: String
  }

  type TaskPlanPreview {
    title: String!
    description: String!
    instructions: String!
    suggestedTools: String!
    estimatedHours: Float
    priority: String!
    dependsOn: [String!]!
    tasks: [ChildTaskPreview!]!
    acceptanceCriteria: String
  }

  type ExtractedTask {
    title: String!
    description: String
    assigneeName: String
    priority: String
    status: String
  }

  input ChildTaskInput {
    title: String!
    description: String!
    instructions: String
    estimatedHours: Float
    priority: String
    acceptanceCriteria: String
    suggestedTools: String
  }

  input CommitTaskInput {
    title: String!
    description: String!
    instructions: String!
    suggestedTools: String!
    estimatedHours: Float
    priority: String
    dependsOn: [String!]!
    tasks: [ChildTaskInput!]!
    acceptanceCriteria: String
  }

  type DependencyRef {
    title: String!
    linkType: String!
  }

  type HierarchicalSubtaskPreview {
    title: String!
    description: String!
    estimatedHours: Float
    priority: String
    acceptanceCriteria: String
  }

  type HierarchicalTaskPreview {
    title: String!
    description: String!
    instructions: String
    estimatedHours: Float
    priority: String
    acceptanceCriteria: String
    autoComplete: Boolean
    dependsOn: [DependencyRef!]
    subtasks: [HierarchicalSubtaskPreview!]
  }

  type HierarchicalEpicPreview {
    title: String!
    description: String!
    instructions: String
    estimatedHours: Float
    priority: String
    acceptanceCriteria: String
    autoComplete: Boolean
    dependsOn: [DependencyRef!]
    tasks: [HierarchicalTaskPreview!]
  }

  type HierarchicalPlanPreview {
    epics: [HierarchicalEpicPreview!]!
  }

  input DependencyRefInput {
    title: String!
    linkType: String!
  }

  input CommitHierarchicalSubtaskInput {
    title: String!
    description: String!
    estimatedHours: Float
    priority: String
    acceptanceCriteria: String
  }

  input CommitHierarchicalTaskInput {
    title: String!
    description: String!
    instructions: String
    estimatedHours: Float
    priority: String
    acceptanceCriteria: String
    autoComplete: Boolean
    dependsOn: [DependencyRefInput!]
    subtasks: [CommitHierarchicalSubtaskInput!]
  }

  input CommitHierarchicalEpicInput {
    title: String!
    description: String!
    instructions: String
    estimatedHours: Float
    priority: String
    acceptanceCriteria: String
    autoComplete: Boolean
    dependsOn: [DependencyRefInput!]
    tasks: [CommitHierarchicalTaskInput!]
  }
`;

export const taskFilterInputDef = /* GraphQL */ `
  input FilterConditionInput {
    field: String!
    operator: String!
    value: String
  }

  input FilterGroupInput {
    operator: String!
    conditions: [FilterConditionInput!]
    groups: [FilterGroupInput!]
  }

  input TaskFilterInput {
    status: [String!]
    priority: [String!]
    assigneeId: [ID!]
    labelIds: [ID!]
    search: String
    showArchived: Boolean
    epicId: ID
    sprintId: ID
    dueDateFrom: String
    dueDateTo: String
    sortBy: String
    sortOrder: String
    filterGroup: FilterGroupInput
  }
`;

export const taskQueryFields = /* GraphQL */ `
  """List tasks for a project with optional pagination, parent filter, and server-side filtering."""
  tasks(projectId: ID!, filter: TaskFilterInput, parentTaskId: ID, limit: Int, offset: Int): TaskConnection!
  """List epic-type tasks for a project."""
  epics(projectId: ID!): [Task!]!
  """List all labels in the organization."""
  labels: [Label!]!
  """List custom fields defined for a project."""
  customFields(projectId: ID!): [CustomField!]!
  """List all watchers for a task."""
  taskWatchers(taskId: ID!): [TaskWatcher!]!
  """Get the chain of ancestor tasks from a task up to the root."""
  taskAncestors(taskId: ID!): [Task!]!
`;

export const taskMutationFields = /* GraphQL */ `
  """Create a new task in a project. Defaults to 'todo' status."""
  createTask(projectId: ID!, title: String!, status: String, taskType: String): Task!
  """Update one or more fields on an existing task."""
  updateTask(taskId: ID!, title: String, status: String, description: String, instructions: String, acceptanceCriteria: String, sprintId: ID, sprintColumn: String, assigneeId: ID, dueDate: String, position: Float, archived: Boolean, autoComplete: Boolean, storyPoints: Int, taskType: String, recurrenceRule: String, force: Boolean): UpdateTaskResult!
  """Create a subtask under a parent task."""
  createSubtask(parentTaskId: ID!, title: String!, taskType: String): Task!
  """Update multiple tasks at once (status, assignee, sprint, or archive)."""
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
  commitHierarchicalPlan(projectId: ID!, epics: [CommitHierarchicalEpicInput!]!, clearExisting: Boolean): [Task!]!

  createCustomField(projectId: ID!, name: String!, fieldType: String!, options: String, required: Boolean): CustomField!
  updateCustomField(customFieldId: ID!, name: String, options: String, required: Boolean, position: Int): CustomField!
  deleteCustomField(customFieldId: ID!): Boolean!
  setCustomFieldValue(taskId: ID!, customFieldId: ID!, value: String!): CustomFieldValue!

  reorderTask(taskId: ID!, position: Float!): Task!

  addTaskAssignee(taskId: ID!, userId: ID!): TaskAssignee!
  removeTaskAssignee(taskId: ID!, userId: ID!): Boolean!

  addTaskWatcher(taskId: ID!, userId: ID!): TaskWatcher!
  removeTaskWatcher(taskId: ID!, userId: ID!): Boolean!

  deleteAttachment(attachmentId: ID!): Boolean!

  addTaskDependency(sourceTaskId: ID!, targetTaskId: ID!, linkType: DependencyLinkType!): TaskDependency!
  removeTaskDependency(taskDependencyId: ID!): Boolean!
`;
