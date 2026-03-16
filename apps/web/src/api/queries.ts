import { TASK_FIELDS } from '../utils/taskHelpers';

// ── Project Queries ──

export const PROJECT_QUERY = `query Project($projectId: ID!) {
  project(projectId: $projectId) { projectId name description prompt knowledgeBase statuses createdAt orgId archived }
}`;

export const TASKS_QUERY = `query Tasks($projectId: ID!) {
  tasks(projectId: $projectId) { tasks { ${TASK_FIELDS} } hasMore total }
}`;

export const TASKS_PAGINATED_QUERY = `query Tasks($projectId: ID!, $limit: Int, $offset: Int) {
  tasks(projectId: $projectId, limit: $limit, offset: $offset) { tasks { ${TASK_FIELDS} } hasMore total }
}`;

export const SUBTASKS_QUERY = `query Subtasks($projectId: ID!, $parentTaskId: ID) {
  tasks(projectId: $projectId, parentTaskId: $parentTaskId) { tasks { ${TASK_FIELDS} } }
}`;

export const SPRINTS_QUERY = `query Sprints($projectId: ID!) {
  sprints(projectId: $projectId) { sprintId projectId name goal isActive columns startDate endDate createdAt closedAt }
}`;

export const ORG_USERS_QUERY = `query OrgUsers { orgUsers { userId email role } }`;

export const LABELS_QUERY = `query Labels { labels { labelId name color } }`;

export const COMMENTS_QUERY = `query Comments($taskId: ID!) {
  comments(taskId: $taskId) {
    commentId taskId userId userEmail parentCommentId content createdAt updatedAt
    replies { commentId taskId userId userEmail parentCommentId content createdAt updatedAt replies { commentId } }
  }
}`;

export const ACTIVITIES_QUERY = `query Activities($taskId: ID!) {
  activities(taskId: $taskId, limit: 30) { activityId projectId taskId sprintId userId userEmail action field oldValue newValue createdAt }
}`;

export const PROJECT_STATS_QUERY = `query ProjectStats($projectId: ID!) {
  projectStats(projectId: $projectId) {
    totalTasks completedTasks overdueTasks completionPercent
    tasksByStatus { label count } tasksByPriority { label count }
    tasksByAssignee { userId email count } totalEstimatedHours completedEstimatedHours
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

// ── Sprint Mutations ──

export const ACTIVATE_SPRINT_MUTATION = `mutation UpdateSprint($sprintId: ID!, $isActive: Boolean) {
  updateSprint(sprintId: $sprintId, isActive: $isActive) { sprintId isActive }
}`;

export const DELETE_SPRINT_MUTATION = `mutation DeleteSprint($sprintId: ID!) { deleteSprint(sprintId: $sprintId) }`;

// ── Project Mutations ──

export const UPDATE_PROJECT_MUTATION = `mutation UpdateProject($projectId: ID!, $name: String, $description: String, $prompt: String, $knowledgeBase: String, $statuses: String) {
  updateProject(projectId: $projectId, name: $name, description: $description, prompt: $prompt, knowledgeBase: $knowledgeBase, statuses: $statuses) {
    projectId name description prompt knowledgeBase statuses createdAt orgId archived
  }
}`;

// ── Label Mutations ──

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

// ── Comment Mutations ──

export const CREATE_COMMENT_MUTATION = `mutation CreateComment($taskId: ID!, $content: String!, $parentCommentId: ID) {
  createComment(taskId: $taskId, content: $content, parentCommentId: $parentCommentId) {
    commentId taskId userId userEmail parentCommentId content createdAt updatedAt replies { commentId }
  }
}`;

export const UPDATE_COMMENT_MUTATION = `mutation UpdateComment($commentId: ID!, $content: String!) {
  updateComment(commentId: $commentId, content: $content) { commentId content updatedAt }
}`;

export const DELETE_COMMENT_MUTATION = `mutation DeleteComment($commentId: ID!) { deleteComment(commentId: $commentId) }`;

// ── AI Mutations ──

export const PREVIEW_TASK_PLAN_MUTATION = `mutation PreviewTaskPlan($projectId: ID!, $context: String, $appendToTitles: [String!]) {
  previewTaskPlan(projectId: $projectId, context: $context, appendToTitles: $appendToTitles) {
    title description instructions suggestedTools estimatedHours priority dependsOn
    subtasks { title description }
  }
}`;

export const COMMIT_TASK_PLAN_MUTATION = `mutation CommitTaskPlan($projectId: ID!, $tasks: [CommitTaskInput!]!, $clearExisting: Boolean) {
  commitTaskPlan(projectId: $projectId, tasks: $tasks, clearExisting: $clearExisting) { ${TASK_FIELDS} }
}`;

export const SUMMARIZE_PROJECT_MUTATION = `mutation SummarizeProject($projectId: ID!) {
  summarizeProject(projectId: $projectId)
}`;

export const GENERATE_INSTRUCTIONS_MUTATION = `mutation GenerateTaskInstructions($taskId: ID!) {
  generateTaskInstructions(taskId: $taskId) { ${TASK_FIELDS} }
}`;

export const GENERATE_CODE_MUTATION = `mutation($taskId: ID!, $styleGuide: String) {
  generateCodeFromTask(taskId: $taskId, styleGuide: $styleGuide) {
    files { path content language description } summary estimatedTokensUsed delegationHint
  }
}`;

export const REGENERATE_FILE_MUTATION = `mutation($taskId: ID!, $filePath: String!, $feedback: String) {
  regenerateCodeFile(taskId: $taskId, filePath: $filePath, feedback: $feedback) { path content language description }
}`;

export const CREATE_PR_MUTATION = `mutation($projectId: ID!, $taskId: ID!, $files: [GitHubFileInput!]!) {
  createPullRequestFromTask(projectId: $projectId, taskId: $taskId, files: $files) { url number }
}`;

export const PARSE_BUG_REPORT_MUTATION = `mutation ParseBugReport($projectId: ID!, $bugReport: String!) {
  parseBugReport(projectId: $projectId, bugReport: $bugReport) { ${TASK_FIELDS} }
}`;

export const PREVIEW_PRD_MUTATION = `mutation PreviewPRD($projectId: ID!, $prd: String!) {
  previewPRDBreakdown(projectId: $projectId, prd: $prd) {
    epics { title description tasks { title description priority estimatedHours acceptanceCriteria } }
  }
}`;

export const COMMIT_PRD_MUTATION = `mutation CommitPRD($projectId: ID!, $epics: String!) {
  commitPRDBreakdown(projectId: $projectId, epics: $epics) { ${TASK_FIELDS} }
}`;

export const BOOTSTRAP_REPO_MUTATION = `mutation BootstrapFromRepo($projectId: ID!) {
  bootstrapProjectFromRepo(projectId: $projectId) { ${TASK_FIELDS} }
}`;
