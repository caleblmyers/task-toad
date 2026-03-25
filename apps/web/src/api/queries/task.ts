import { TASK_FIELDS } from '../../utils/taskHelpers';

// ── Task Queries ──

export const TASKS_QUERY = `query Tasks($projectId: ID!, $filter: TaskFilterInput, $tql: String) {
  tasks(projectId: $projectId, filter: $filter, tql: $tql) { tasks { ${TASK_FIELDS} } hasMore total }
}`;

export const TASKS_PAGINATED_QUERY = `query Tasks($projectId: ID!, $filter: TaskFilterInput, $limit: Int, $offset: Int, $tql: String) {
  tasks(projectId: $projectId, filter: $filter, limit: $limit, offset: $offset, tql: $tql) { tasks { ${TASK_FIELDS} } hasMore total }
}`;

export const SUBTASKS_QUERY = `query Subtasks($projectId: ID!, $parentTaskId: ID) {
  tasks(projectId: $projectId, parentTaskId: $parentTaskId) { tasks { ${TASK_FIELDS} } }
}`;

export const EPICS_QUERY = `query Epics($projectId: ID!) {
  epics(projectId: $projectId) {
    ${TASK_FIELDS}
    progress { total completed percentage }
    children {
      ${TASK_FIELDS}
      progress { total completed percentage }
    }
  }
}`;

export const TASK_ANCESTORS_QUERY = `query TaskAncestors($taskId: ID!) {
  taskAncestors(taskId: $taskId) {
    taskId title status taskType
  }
}`;

// ── Task Mutations ──

export const CREATE_TASK_MUTATION = `mutation CreateTask($projectId: ID!, $title: String!) {
  createTask(projectId: $projectId, title: $title) { taskId }
}`;

export const CREATE_TASK_WITH_STATUS_MUTATION = `mutation CreateTask($projectId: ID!, $title: String!, $status: String) {
  createTask(projectId: $projectId, title: $title, status: $status) { taskId }
}`;

export const CREATE_SUBTASK_MUTATION = `mutation CreateSubtask($parentTaskId: ID!, $title: String!) {
  createSubtask(parentTaskId: $parentTaskId, title: $title) { ${TASK_FIELDS} }
}`;

export const BULK_UPDATE_TASKS_MUTATION = `mutation BulkUpdateTasks($taskIds: [ID!]!, $status: String, $assigneeId: ID, $sprintId: ID, $archived: Boolean) {
  bulkUpdateTasks(taskIds: $taskIds, status: $status, assigneeId: $assigneeId, sprintId: $sprintId, archived: $archived) { ${TASK_FIELDS} }
}`;

// ── Task Field Update Mutations ──

function buildUpdateTaskMutation(fields: string): string {
  const argsList = fields.replace(/\$(\w+):[^,]+/g, (_: string, name: string) => name + ': $' + name).trim();
  return `mutation UpdateTask($taskId: ID!, ${fields}) { updateTask(taskId: $taskId, ${argsList}) { task { taskId } warnings } }`;
}

export const UPDATE_TASK_STATUS_MUTATION = buildUpdateTaskMutation('$status: String!');
export const UPDATE_TASK_ASSIGNEE_MUTATION = buildUpdateTaskMutation('$assigneeId: ID');
export const UPDATE_TASK_DUEDATE_MUTATION = buildUpdateTaskMutation('$dueDate: String');
export const UPDATE_TASK_TITLE_MUTATION = buildUpdateTaskMutation('$title: String!');
export const UPDATE_TASK_ARCHIVED_MUTATION = buildUpdateTaskMutation('$archived: Boolean');

export const UPDATE_TASK_SPRINT_MUTATION = `mutation UpdateTask($taskId: ID!, $sprintId: ID, $sprintColumn: String) {
  updateTask(taskId: $taskId, sprintId: $sprintId, sprintColumn: $sprintColumn) { task { taskId } warnings }
}`;

export const UPDATE_TASK_POSITION_MUTATION = `mutation UpdateTask($taskId: ID!, $position: Float, $sprintId: ID, $sprintColumn: String) {
  updateTask(taskId: $taskId, position: $position, sprintId: $sprintId, sprintColumn: $sprintColumn) { task { taskId } warnings }
}`;

// ── Dynamic Task Update Builders ──

export function buildStatusChangeMutation(opts: { sprintColumn?: boolean; assigneeId?: boolean }): string {
  const vars = ['$taskId: ID!', '$status: String!'];
  const args = ['taskId: $taskId', 'status: $status'];
  if (opts.sprintColumn) { vars.push('$sprintColumn: String'); args.push('sprintColumn: $sprintColumn'); }
  if (opts.assigneeId) { vars.push('$assigneeId: ID'); args.push('assigneeId: $assigneeId'); }
  return `mutation UpdateTask(${vars.join(', ')}) { updateTask(${args.join(', ')}) { task { taskId } warnings } }`;
}

export function buildSprintColumnChangeMutation(opts: { status?: boolean; assigneeId?: boolean }): string {
  const vars = ['$taskId: ID!', '$sprintColumn: String'];
  const args = ['taskId: $taskId', 'sprintColumn: $sprintColumn'];
  if (opts.status) { vars.push('$status: String!'); args.push('status: $status'); }
  if (opts.assigneeId) { vars.push('$assigneeId: ID'); args.push('assigneeId: $assigneeId'); }
  return `mutation UpdateTask(${vars.join(', ')}) { updateTask(${args.join(', ')}) { task { taskId } warnings } }`;
}

export function buildUpdateTaskFieldsMutation(fields: { description?: boolean; instructions?: boolean; acceptanceCriteria?: boolean; storyPoints?: boolean; priority?: boolean }): string {
  const vars = ['$taskId: ID!'];
  const args = ['taskId: $taskId'];
  if (fields.description) { vars.push('$description: String'); args.push('description: $description'); }
  if (fields.instructions) { vars.push('$instructions: String'); args.push('instructions: $instructions'); }
  if (fields.acceptanceCriteria) { vars.push('$acceptanceCriteria: String'); args.push('acceptanceCriteria: $acceptanceCriteria'); }
  if (fields.storyPoints) { vars.push('$storyPoints: Int'); args.push('storyPoints: $storyPoints'); }
  if (fields.priority) { vars.push('$priority: String'); args.push('priority: $priority'); }
  return `mutation UpdateTask(${vars.join(', ')}) { updateTask(${args.join(', ')}) { task { taskId } warnings } }`;
}

// ── Labels ──

export const LABELS_QUERY = `query Labels { labels { labelId name color } }`;

export const CREATE_LABEL_MUTATION = `mutation CreateLabel($name: String!, $color: String) {
  createLabel(name: $name, color: $color) { labelId name color }
}`;

export const DELETE_LABEL_MUTATION = `mutation DeleteLabel($labelId: ID!) { deleteLabel(labelId: $labelId) }`;

export const ADD_TASK_LABEL_MUTATION = `mutation AddTaskLabel($taskId: ID!, $labelId: ID!) {
  addTaskLabel(taskId: $taskId, labelId: $labelId) { taskId }
}`;

export const REMOVE_TASK_LABEL_MUTATION = `mutation RemoveTaskLabel($taskId: ID!, $labelId: ID!) {
  removeTaskLabel(taskId: $taskId, labelId: $labelId) { taskId }
}`;

// ── Assignees ──

export const ADD_TASK_ASSIGNEE_MUTATION = `mutation AddTaskAssignee($taskId: ID!, $userId: ID!) {
  addTaskAssignee(taskId: $taskId, userId: $userId) { id user { userId email } assignedAt }
}`;

export const REMOVE_TASK_ASSIGNEE_MUTATION = `mutation RemoveTaskAssignee($taskId: ID!, $userId: ID!) {
  removeTaskAssignee(taskId: $taskId, userId: $userId)
}`;

// ── Watchers ──

export const ADD_TASK_WATCHER_MUTATION = `mutation AddTaskWatcher($taskId: ID!, $userId: ID!) {
  addTaskWatcher(taskId: $taskId, userId: $userId) { id user { userId email } watchedAt }
}`;

export const REMOVE_TASK_WATCHER_MUTATION = `mutation RemoveTaskWatcher($taskId: ID!, $userId: ID!) {
  removeTaskWatcher(taskId: $taskId, userId: $userId)
}`;

// ── Task Dependencies ──

export const ADD_TASK_DEPENDENCY_MUTATION = `mutation AddDep($sourceTaskId: ID!, $targetTaskId: ID!, $linkType: DependencyLinkType!) {
  addTaskDependency(sourceTaskId: $sourceTaskId, targetTaskId: $targetTaskId, linkType: $linkType) {
    taskDependencyId sourceTaskId targetTaskId linkType createdAt targetTask { taskId title status }
  }
}`;

export const REMOVE_TASK_DEPENDENCY_MUTATION = `mutation RemoveDep($taskDependencyId: ID!) { removeTaskDependency(taskDependencyId: $taskDependencyId) }`;

// ── Custom Fields ──

export const CUSTOM_FIELDS_QUERY = `query CustomFields($projectId: ID!) { customFields(projectId: $projectId) { customFieldId name fieldType options required position } }`;

export const CREATE_CUSTOM_FIELD_MUTATION = `mutation CreateCF($projectId: ID!, $name: String!, $fieldType: String!, $options: String, $required: Boolean) {
  createCustomField(projectId: $projectId, name: $name, fieldType: $fieldType, options: $options, required: $required) { customFieldId name fieldType options required position }
}`;

export const DELETE_CUSTOM_FIELD_MUTATION = `mutation DeleteCF($customFieldId: ID!) { deleteCustomField(customFieldId: $customFieldId) }`;

export const UPDATE_CUSTOM_FIELD_MUTATION = `mutation ReorderCF($customFieldId: ID!, $position: Int) { updateCustomField(customFieldId: $customFieldId, position: $position) { customFieldId name fieldType options required position } }`;

// ── Task Templates ──

export const TASK_TEMPLATES_QUERY = `query TaskTemplates($projectId: ID) { taskTemplates(projectId: $projectId) { taskTemplateId name description instructions acceptanceCriteria priority taskType estimatedHours storyPoints projectId createdAt } }`;

export const CREATE_TASK_TEMPLATE_MUTATION = `mutation CreateTemplate($projectId: ID, $name: String!, $description: String, $instructions: String, $acceptanceCriteria: String, $estimatedHours: Float, $storyPoints: Int, $priority: String, $taskType: String) {
  createTaskTemplate(projectId: $projectId, name: $name, description: $description, instructions: $instructions, acceptanceCriteria: $acceptanceCriteria, estimatedHours: $estimatedHours, storyPoints: $storyPoints, priority: $priority, taskType: $taskType) { taskTemplateId name description instructions acceptanceCriteria priority taskType estimatedHours storyPoints projectId createdAt }
}`;

export const UPDATE_TASK_TEMPLATE_MUTATION = `mutation UpdateTemplate($taskTemplateId: ID!, $name: String, $description: String, $instructions: String, $acceptanceCriteria: String, $estimatedHours: Float, $storyPoints: Int, $priority: String, $taskType: String) {
  updateTaskTemplate(taskTemplateId: $taskTemplateId, name: $name, description: $description, instructions: $instructions, acceptanceCriteria: $acceptanceCriteria, estimatedHours: $estimatedHours, storyPoints: $storyPoints, priority: $priority, taskType: $taskType) { taskTemplateId name description instructions acceptanceCriteria priority taskType estimatedHours storyPoints projectId createdAt }
}`;

export const DELETE_TASK_TEMPLATE_MUTATION = `mutation DeleteTemplate($taskTemplateId: ID!) { deleteTaskTemplate(taskTemplateId: $taskTemplateId) }`;

export const SAVE_AS_TEMPLATE_MUTATION = `mutation SaveAsTemplate($projectId: ID, $name: String!, $description: String, $instructions: String, $acceptanceCriteria: String, $priority: String, $taskType: String) {
  createTaskTemplate(projectId: $projectId, name: $name, description: $description, instructions: $instructions, acceptanceCriteria: $acceptanceCriteria, priority: $priority, taskType: $taskType) { taskTemplateId }
}`;
