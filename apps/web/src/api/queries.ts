import { TASK_FIELDS } from '../utils/taskHelpers';

// ── Project Queries ──

export const PROJECT_QUERY = `query Project($projectId: ID!) {
  project(projectId: $projectId) { projectId name description prompt knowledgeBase statuses createdAt orgId archived githubRepositoryName githubRepositoryOwner }
}`;

export const TASKS_QUERY = `query Tasks($projectId: ID!, $filter: TaskFilterInput) {
  tasks(projectId: $projectId, filter: $filter) { tasks { ${TASK_FIELDS} } hasMore total }
}`;

export const TASKS_PAGINATED_QUERY = `query Tasks($projectId: ID!, $filter: TaskFilterInput, $limit: Int, $offset: Int) {
  tasks(projectId: $projectId, filter: $filter, limit: $limit, offset: $offset) { tasks { ${TASK_FIELDS} } hasMore total }
}`;

export const SUBTASKS_QUERY = `query Subtasks($projectId: ID!, $parentTaskId: ID) {
  tasks(projectId: $projectId, parentTaskId: $parentTaskId) { tasks { ${TASK_FIELDS} } }
}`;

export const SPRINTS_QUERY = `query Sprints($projectId: ID!) {
  sprints(projectId: $projectId) { sprintId projectId name goal isActive columns wipLimits startDate endDate createdAt closedAt }
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
  activities(taskId: $taskId, limit: 30) { activities { activityId projectId taskId sprintId userId userEmail action field oldValue newValue createdAt } hasMore }
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

// ── Assignee Mutations ──

export const ADD_TASK_ASSIGNEE_MUTATION = `mutation AddTaskAssignee($taskId: ID!, $userId: ID!) {
  addTaskAssignee(taskId: $taskId, userId: $userId) { id user { userId email } assignedAt }
}`;

export const REMOVE_TASK_ASSIGNEE_MUTATION = `mutation RemoveTaskAssignee($taskId: ID!, $userId: ID!) {
  removeTaskAssignee(taskId: $taskId, userId: $userId)
}`;

// ── Watcher Mutations ──

export const ADD_TASK_WATCHER_MUTATION = `mutation AddTaskWatcher($taskId: ID!, $userId: ID!) {
  addTaskWatcher(taskId: $taskId, userId: $userId) { id user { userId email } watchedAt }
}`;

export const REMOVE_TASK_WATCHER_MUTATION = `mutation RemoveTaskWatcher($taskId: ID!, $userId: ID!) {
  removeTaskWatcher(taskId: $taskId, userId: $userId)
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
    tasks { title description instructions estimatedHours priority acceptanceCriteria suggestedTools }
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

export const REFRESH_REPO_PROFILE_MUTATION = `mutation RefreshRepoProfile($projectId: ID!) {
  refreshRepoProfile(projectId: $projectId) {
    projectId name description prompt knowledgeBase statuses createdAt orgId archived
  }
}`;

// ── Webhook Queries ──

export const WEBHOOK_DELIVERIES_QUERY = `query WebhookDeliveries($endpointId: ID!, $limit: Int) {
  webhookDeliveries(endpointId: $endpointId, limit: $limit) {
    id endpointId event status statusCode attemptCount nextRetryAt createdAt completedAt
  }
}`;

export const CYCLE_TIME_METRICS_QUERY = `query CycleTimeMetrics($projectId: ID!, $sprintId: ID, $fromDate: String, $toDate: String) {
  cycleTimeMetrics(projectId: $projectId, sprintId: $sprintId, fromDate: $fromDate, toDate: $toDate) {
    tasks { taskId title status leadTimeHours cycleTimeHours startedAt completedAt }
    avgLeadTimeHours avgCycleTimeHours
    p50LeadTimeHours p85LeadTimeHours
    p50CycleTimeHours p85CycleTimeHours
    totalCompleted
  }
}`;

export const EPICS_QUERY = `query Epics($projectId: ID!) {
  epics(projectId: $projectId) {
    taskId title description status priority position createdAt
    progress { total completed percentage }
  }
}`;

// ── Action Plan Queries/Mutations ──

export const PREVIEW_ACTION_PLAN_MUTATION = `mutation PreviewActionPlan($taskId: ID!) {
  previewActionPlan(taskId: $taskId) {
    actions { actionType label config requiresApproval reasoning }
    summary
  }
}`;

export const COMMIT_ACTION_PLAN_MUTATION = `mutation CommitActionPlan($taskId: ID!, $actions: [ActionInput!]!) {
  commitActionPlan(taskId: $taskId, actions: $actions) {
    id taskId status summary createdAt
    actions { id planId actionType label config position status requiresApproval result errorMessage startedAt completedAt createdAt }
  }
}`;

export const EXECUTE_ACTION_PLAN_MUTATION = `mutation ExecuteActionPlan($planId: ID!) {
  executeActionPlan(planId: $planId) {
    id taskId status summary
    actions { id planId actionType label config position status requiresApproval result errorMessage startedAt completedAt createdAt }
  }
}`;

export const COMPLETE_MANUAL_ACTION_MUTATION = `mutation CompleteManualAction($actionId: ID!) {
  completeManualAction(actionId: $actionId) {
    id status completedAt
  }
}`;

export const SKIP_ACTION_MUTATION = `mutation SkipAction($actionId: ID!) {
  skipAction(actionId: $actionId) { id status }
}`;

export const RETRY_ACTION_MUTATION = `mutation RetryAction($actionId: ID!) {
  retryAction(actionId: $actionId) { id status }
}`;

export const CANCEL_ACTION_PLAN_MUTATION = `mutation CancelActionPlan($planId: ID!) {
  cancelActionPlan(planId: $planId) {
    id status
    actions { id status }
  }
}`;

export const TASK_ACTION_PLAN_QUERY = `query TaskActionPlan($taskId: ID!) {
  taskActionPlan(taskId: $taskId) {
    id taskId status summary createdAt updatedAt
    actions { id planId actionType label config position status requiresApproval result errorMessage startedAt completedAt createdAt }
  }
}`;

// ── Release Queries ──

export const RELEASES_QUERY = `query Releases($projectId: ID!, $status: String, $limit: Int, $cursor: String) {
  releases(projectId: $projectId, status: $status, limit: $limit, cursor: $cursor) {
    releases { releaseId name version status releaseDate releaseNotes createdAt updatedAt tasks { taskId title status } }
    hasMore nextCursor
  }
}`;

export const RELEASE_QUERY = `query Release($releaseId: ID!) {
  release(releaseId: $releaseId) {
    releaseId projectId name description version status releaseDate releaseNotes createdBy createdAt updatedAt
    tasks { taskId title status priority description }
  }
}`;

export const CREATE_RELEASE_MUTATION = `mutation CreateRelease($projectId: ID!, $name: String!, $version: String!, $description: String, $releaseDate: String) {
  createRelease(projectId: $projectId, name: $name, version: $version, description: $description, releaseDate: $releaseDate) {
    releaseId name version status releaseDate releaseNotes createdAt updatedAt tasks { taskId title status }
  }
}`;

export const UPDATE_RELEASE_MUTATION = `mutation UpdateRelease($releaseId: ID!, $name: String, $version: String, $description: String, $status: String, $releaseDate: String, $releaseNotes: String) {
  updateRelease(releaseId: $releaseId, name: $name, version: $version, description: $description, status: $status, releaseDate: $releaseDate, releaseNotes: $releaseNotes) {
    releaseId name version status description releaseDate releaseNotes createdAt updatedAt tasks { taskId title status }
  }
}`;

export const DELETE_RELEASE_MUTATION = `mutation DeleteRelease($releaseId: ID!) {
  deleteRelease(releaseId: $releaseId)
}`;

export const ADD_TASK_TO_RELEASE_MUTATION = `mutation AddTaskToRelease($releaseId: ID!, $taskId: ID!) {
  addTaskToRelease(releaseId: $releaseId, taskId: $taskId)
}`;

export const REMOVE_TASK_FROM_RELEASE_MUTATION = `mutation RemoveTaskFromRelease($releaseId: ID!, $taskId: ID!) {
  removeTaskFromRelease(releaseId: $releaseId, taskId: $taskId)
}`;

export const GENERATE_RELEASE_NOTES_MUTATION = `mutation GenerateReleaseNotes($releaseId: ID!) {
  generateReleaseNotes(releaseId: $releaseId) {
    releaseId name version status description releaseDate releaseNotes createdAt updatedAt tasks { taskId title status }
  }
}`;

export const REPLAY_WEBHOOK_DELIVERY_MUTATION = `mutation ReplayWebhookDelivery($deliveryId: ID!) {
  replayWebhookDelivery(deliveryId: $deliveryId) {
    id endpointId event status statusCode attemptCount nextRetryAt createdAt completedAt
  }
}`;

// ── Time Tracking Queries ──

export const TIME_ENTRIES_QUERY = `query TimeEntries($taskId: ID!, $limit: Int, $cursor: String) {
  timeEntries(taskId: $taskId, limit: $limit, cursor: $cursor) {
    entries { timeEntryId taskId userId userEmail durationMinutes description loggedDate billable createdAt updatedAt }
    totalMinutes
  }
}`;

export const TASK_TIME_SUMMARY_QUERY = `query TaskTimeSummary($taskId: ID!) {
  taskTimeSummary(taskId: $taskId) {
    taskId totalMinutes estimatedHours
    entries { timeEntryId taskId userId userEmail durationMinutes description loggedDate billable createdAt updatedAt }
  }
}`;

export const SPRINT_TIME_SUMMARY_QUERY = `query SprintTimeSummary($sprintId: ID!) {
  sprintTimeSummary(sprintId: $sprintId) {
    sprintId totalMinutes
    byUser { userId userEmail totalMinutes }
  }
}`;

// ── Time Tracking Mutations ──

export const LOG_TIME_MUTATION = `mutation LogTime($taskId: ID!, $durationMinutes: Int!, $loggedDate: String!, $description: String, $billable: Boolean) {
  logTime(taskId: $taskId, durationMinutes: $durationMinutes, loggedDate: $loggedDate, description: $description, billable: $billable) {
    timeEntryId taskId userId userEmail durationMinutes description loggedDate billable createdAt updatedAt
  }
}`;

export const UPDATE_TIME_ENTRY_MUTATION = `mutation UpdateTimeEntry($timeEntryId: ID!, $durationMinutes: Int, $description: String, $billable: Boolean) {
  updateTimeEntry(timeEntryId: $timeEntryId, durationMinutes: $durationMinutes, description: $description, billable: $billable) {
    timeEntryId taskId userId userEmail durationMinutes description loggedDate billable createdAt updatedAt
  }
}`;

export const DELETE_TIME_ENTRY_MUTATION = `mutation DeleteTimeEntry($timeEntryId: ID!) {
  deleteTimeEntry(timeEntryId: $timeEntryId)
}`;
