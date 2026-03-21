import { TASK_FIELDS } from '../utils/taskHelpers';

// ── Auth Queries ──

export const MY_PERMISSIONS_QUERY = `query MyPermissions($projectId: ID!) {
  myPermissions(projectId: $projectId)
}`;

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

export const GENERATE_MANUAL_TASK_SPEC_MUTATION = `mutation GenerateManualTaskSpec($taskId: ID!) {
  generateManualTaskSpec(taskId: $taskId) {
    filesToChange { path action description }
    approach
    codeSnippets { file language code explanation }
    testingNotes
    dependencies
  }
}`;

export const AUTO_START_PROJECT_MUTATION = `mutation AutoStartProject($projectId: ID!) {
  autoStartProject(projectId: $projectId) { projectId name }
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

export const PREVIEW_HIERARCHICAL_PLAN_QUERY = `query PreviewHierarchicalPlan($projectId: ID!, $prompt: String!) {
  previewHierarchicalPlan(projectId: $projectId, prompt: $prompt) {
    epics {
      title description instructions estimatedHours priority acceptanceCriteria autoComplete
      dependsOn { title linkType }
      tasks {
        title description instructions estimatedHours priority acceptanceCriteria autoComplete
        dependsOn { title linkType }
        subtasks { title description estimatedHours priority acceptanceCriteria }
      }
    }
  }
}`;

export const COMMIT_HIERARCHICAL_PLAN_MUTATION = `mutation CommitHierarchicalPlan($projectId: ID!, $epics: [CommitHierarchicalEpicInput!]!, $clearExisting: Boolean) {
  commitHierarchicalPlan(projectId: $projectId, epics: $epics, clearExisting: $clearExisting) { ${TASK_FIELDS} }
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
    taskId title description status priority taskType position createdAt
    progress { total completed percentage }
    children {
      taskId title description status priority taskType position createdAt
      progress { total completed percentage }
    }
  }
}`;

export const TASK_ANCESTORS_QUERY = `query TaskAncestors($taskId: ID!) {
  taskAncestors(taskId: $taskId) {
    taskId title status taskType
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

export const PROJECT_ACTION_PLANS_QUERY = `query ProjectActionPlans($projectId: ID!, $status: String) {
  projectActionPlans(projectId: $projectId, status: $status) {
    id taskId status summary createdAt updatedAt
    actions { id planId actionType label config position status requiresApproval result errorMessage startedAt completedAt createdAt }
    task { taskId title status taskType autoComplete parentTaskTitle }
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

// ── Capacity Queries & Mutations ──

export const TEAM_CAPACITY_QUERY = `query TeamCapacity($projectId: ID!) {
  teamCapacity(projectId: $projectId) {
    userCapacityId userId userEmail hoursPerWeek createdAt
  }
}`;

export const TEAM_CAPACITY_SUMMARY_QUERY = `query TeamCapacitySummary($projectId: ID!, $startDate: String!, $endDate: String!) {
  teamCapacitySummary(projectId: $projectId, startDate: $startDate, endDate: $endDate) {
    members { userId userEmail hoursPerWeek timeOff { userTimeOffId userId userEmail startDate endDate description createdAt } availableHours }
    totalHoursPerWeek
    availableHoursInRange
  }
}`;

export const USER_TIME_OFFS_QUERY = `query UserTimeOffs($userId: ID) {
  userTimeOffs(userId: $userId) {
    userTimeOffId userId userEmail startDate endDate description createdAt
  }
}`;

export const SET_USER_CAPACITY_MUTATION = `mutation SetUserCapacity($userId: ID!, $hoursPerWeek: Int!) {
  setUserCapacity(userId: $userId, hoursPerWeek: $hoursPerWeek) {
    userCapacityId userId userEmail hoursPerWeek createdAt
  }
}`;

export const ADD_TIME_OFF_MUTATION = `mutation AddTimeOff($userId: ID!, $startDate: String!, $endDate: String!, $description: String) {
  addTimeOff(userId: $userId, startDate: $startDate, endDate: $endDate, description: $description) {
    userTimeOffId userId userEmail startDate endDate description createdAt
  }
}`;

export const REMOVE_TIME_OFF_MUTATION = `mutation RemoveTimeOff($userTimeOffId: ID!) {
  removeTimeOff(userTimeOffId: $userTimeOffId)
}`;

// ── Automation Rules ──

export const AUTOMATION_RULES_QUERY = `query AutomationRules($projectId: ID!) { automationRules(projectId: $projectId) { id name trigger action enabled createdAt } }`;

export const CREATE_AUTOMATION_RULE_MUTATION = `mutation CreateRule($projectId: ID!, $name: String!, $trigger: String!, $action: String!) {
  createAutomationRule(projectId: $projectId, name: $name, trigger: $trigger, action: $action) { id name trigger action enabled createdAt }
}`;

export const UPDATE_AUTOMATION_RULE_MUTATION = `mutation ToggleRule($ruleId: ID!, $enabled: Boolean) {
  updateAutomationRule(ruleId: $ruleId, enabled: $enabled) { id name trigger action enabled createdAt }
}`;

export const DELETE_AUTOMATION_RULE_MUTATION = `mutation DeleteRule($ruleId: ID!) { deleteAutomationRule(ruleId: $ruleId) }`;

// ── Custom Fields ──

export const CUSTOM_FIELDS_QUERY = `query CustomFields($projectId: ID!) { customFields(projectId: $projectId) { customFieldId name fieldType options required position } }`;

export const CREATE_CUSTOM_FIELD_MUTATION = `mutation CreateCF($projectId: ID!, $name: String!, $fieldType: String!, $options: String, $required: Boolean) {
  createCustomField(projectId: $projectId, name: $name, fieldType: $fieldType, options: $options, required: $required) { customFieldId name fieldType options required position }
}`;

export const DELETE_CUSTOM_FIELD_MUTATION = `mutation DeleteCF($customFieldId: ID!) { deleteCustomField(customFieldId: $customFieldId) }`;

export const UPDATE_CUSTOM_FIELD_MUTATION = `mutation ReorderCF($customFieldId: ID!, $position: Int) { updateCustomField(customFieldId: $customFieldId, position: $position) { customFieldId name fieldType options required position } }`;

// ── Project Members ──

export const PROJECT_MEMBERS_QUERY = `query ProjectMembers($projectId: ID!) { projectMembers(projectId: $projectId) { id userId email role createdAt } }`;

export const ADD_PROJECT_MEMBER_MUTATION = `mutation AddMember($projectId: ID!, $userId: ID!, $role: String) {
  addProjectMember(projectId: $projectId, userId: $userId, role: $role) { id userId email role createdAt }
}`;

export const REMOVE_PROJECT_MEMBER_MUTATION = `mutation RemoveMember($projectId: ID!, $userId: ID!) { removeProjectMember(projectId: $projectId, userId: $userId) }`;

export const UPDATE_PROJECT_MEMBER_ROLE_MUTATION = `mutation UpdateRole($projectId: ID!, $userId: ID!, $role: String!) {
  updateProjectMemberRole(projectId: $projectId, userId: $userId, role: $role) { id userId email role createdAt }
}`;

// ── Task Templates ──

export const TASK_TEMPLATES_QUERY = `query TaskTemplates($projectId: ID) { taskTemplates(projectId: $projectId) { taskTemplateId name description instructions acceptanceCriteria priority taskType estimatedHours storyPoints projectId createdAt } }`;

export const CREATE_TASK_TEMPLATE_MUTATION = `mutation CreateTemplate($projectId: ID, $name: String!, $description: String, $instructions: String, $acceptanceCriteria: String, $estimatedHours: Float, $storyPoints: Int, $priority: String, $taskType: String) {
  createTaskTemplate(projectId: $projectId, name: $name, description: $description, instructions: $instructions, acceptanceCriteria: $acceptanceCriteria, estimatedHours: $estimatedHours, storyPoints: $storyPoints, priority: $priority, taskType: $taskType) { taskTemplateId name description instructions acceptanceCriteria priority taskType estimatedHours storyPoints projectId createdAt }
}`;

export const UPDATE_TASK_TEMPLATE_MUTATION = `mutation UpdateTemplate($taskTemplateId: ID!, $name: String, $description: String, $instructions: String, $acceptanceCriteria: String, $estimatedHours: Float, $storyPoints: Int, $priority: String, $taskType: String) {
  updateTaskTemplate(taskTemplateId: $taskTemplateId, name: $name, description: $description, instructions: $instructions, acceptanceCriteria: $acceptanceCriteria, estimatedHours: $estimatedHours, storyPoints: $storyPoints, priority: $priority, taskType: $taskType) { taskTemplateId name description instructions acceptanceCriteria priority taskType estimatedHours storyPoints projectId createdAt }
}`;

export const DELETE_TASK_TEMPLATE_MUTATION = `mutation DeleteTemplate($taskTemplateId: ID!) { deleteTaskTemplate(taskTemplateId: $taskTemplateId) }`;

// ── Workflow Transitions ──

export const WORKFLOW_TRANSITIONS_QUERY = `query WorkflowTransitions($projectId: ID!) {
  workflowTransitions(projectId: $projectId) {
    transitionId projectId fromStatus toStatus allowedRoles createdAt
  }
}`;

export const WORKFLOW_PROJECT_STATUSES_QUERY = `query Project($projectId: ID!) {
  project(projectId: $projectId) { statuses }
}`;

export const CREATE_WORKFLOW_TRANSITION_MUTATION = `mutation CreateTransition($projectId: ID!, $fromStatus: String!, $toStatus: String!) {
  createWorkflowTransition(projectId: $projectId, fromStatus: $fromStatus, toStatus: $toStatus) {
    transitionId projectId fromStatus toStatus allowedRoles createdAt
  }
}`;

export const DELETE_WORKFLOW_TRANSITION_MUTATION = `mutation DeleteTransition($transitionId: ID!) {
  deleteWorkflowTransition(transitionId: $transitionId)
}`;

// ── Slack ──

export const SLACK_INTEGRATIONS_QUERY = `query { slackIntegrations { id teamId teamName channelId channelName events enabled createdAt } }`;

export const CONNECT_SLACK_MUTATION = `mutation ConnectSlack($webhookUrl: String!, $teamId: String!, $teamName: String!, $channelId: String!, $channelName: String!, $events: [String!]!) {
  connectSlack(webhookUrl: $webhookUrl, teamId: $teamId, teamName: $teamName, channelId: $channelId, channelName: $channelName, events: $events) {
    id teamId teamName channelId channelName events enabled createdAt
  }
}`;

export const SLACK_ORG_USERS_QUERY = `query { orgUsers { userId email displayName } }`;

export const SLACK_USER_MAPPINGS_QUERY = `query ($integrationId: ID!) { slackUserMappings(integrationId: $integrationId) { id slackUserId slackTeamId userId orgId createdAt user { userId email displayName } } }`;

export const MAP_SLACK_USER_MUTATION = `mutation MapSlack($slackUserId: String!, $slackTeamId: String!, $userId: ID!) {
  mapSlackUser(slackUserId: $slackUserId, slackTeamId: $slackTeamId, userId: $userId) {
    id slackUserId slackTeamId userId orgId createdAt user { userId email displayName }
  }
}`;

export const UNMAP_SLACK_USER_MUTATION = `mutation UnmapSlack($mappingId: ID!) { unmapSlackUser(mappingId: $mappingId) }`;

export const UPDATE_SLACK_INTEGRATION_MUTATION = `mutation UpdateSlack($id: ID!, $enabled: Boolean) {
  updateSlackIntegration(id: $id, enabled: $enabled) { id enabled }
}`;

export const TEST_SLACK_INTEGRATION_MUTATION = `mutation TestSlack($id: ID!) { testSlackIntegration(id: $id) }`;

export const DISCONNECT_SLACK_MUTATION = `mutation DisconnectSlack($id: ID!) { disconnectSlack(id: $id) }`;

// ── Webhooks ──

export const WEBHOOK_ENDPOINTS_QUERY = `query { webhookEndpoints { id url events enabled description lastError lastFiredAt createdAt } }`;

export const CREATE_WEBHOOK_ENDPOINT_MUTATION = `mutation CreateWebhook($url: String!, $events: [String!]!, $description: String) {
  createWebhookEndpoint(url: $url, events: $events, description: $description) {
    id url events enabled description lastError lastFiredAt createdAt
  }
}`;

export const UPDATE_WEBHOOK_ENDPOINT_MUTATION = `mutation UpdateWebhook($id: ID!, $enabled: Boolean) {
  updateWebhookEndpoint(id: $id, enabled: $enabled) { id enabled }
}`;

export const TEST_WEBHOOK_ENDPOINT_MUTATION = `mutation TestWebhook($id: ID!) { testWebhookEndpoint(id: $id) }`;

export const DELETE_WEBHOOK_ENDPOINT_MUTATION = `mutation DeleteWebhook($id: ID!) { deleteWebhookEndpoint(id: $id) }`;

// ── GitHub ──

export const GITHUB_INSTALLATION_REPOS_QUERY = `query GitHubRepos($installationId: ID!) { githubInstallationRepos(installationId: $installationId) { id name owner fullName isPrivate defaultBranch } }`;

export const CONNECT_GITHUB_REPO_MUTATION = `mutation ConnectRepo($projectId: ID!, $installationId: ID!, $owner: String!, $name: String!) {
  connectGitHubRepo(projectId: $projectId, installationId: $installationId, owner: $owner, name: $name) {
    repositoryId repositoryName repositoryOwner installationId defaultBranch
  }
}`;

export const DISCONNECT_GITHUB_REPO_MUTATION = `mutation DisconnectRepo($projectId: ID!) { disconnectGitHubRepo(projectId: $projectId) }`;

// ── Notifications ──

export const NOTIFICATIONS_QUERY = `query Notifications { notifications(limit: 30) { notificationId type title body linkUrl isRead createdAt } }`;

export const MARK_NOTIFICATION_READ_MUTATION = `mutation MarkRead($notificationId: ID!) { markNotificationRead(notificationId: $notificationId) { notificationId isRead } }`;

export const MARK_ALL_NOTIFICATIONS_READ_MUTATION = `mutation MarkAllRead { markAllNotificationsRead }`;

export const NOTIFICATION_PREFERENCES_QUERY = `query NotificationPrefs { notificationPreferences { id notificationType inApp email } }`;

export const UPDATE_NOTIFICATION_PREFERENCE_MUTATION = `mutation UpdatePref($type: String!, $inApp: Boolean, $email: Boolean) {
  updateNotificationPreference(notificationType: $type, inApp: $inApp, email: $email) {
    id notificationType inApp email
  }
}`;

// ── AI Usage ──

export const AI_USAGE_QUERY = `query AIUsage($days: Int) {
  aiUsage(days: $days) {
    totalCostUSD totalInputTokens totalOutputTokens totalCalls
    byFeature { feature calls costUSD avgLatencyMs }
    budgetUsedPercent budgetLimitCentsUSD budgetEnforcement
    dailyAverageCostUSD projectedMonthlyCostUSD
  }
}`;

export const SET_AI_BUDGET_MUTATION = `mutation SetAIBudget($monthlyBudgetCentsUSD: Int, $alertThreshold: Int, $budgetEnforcement: String) {
  setAIBudget(monthlyBudgetCentsUSD: $monthlyBudgetCentsUSD, alertThreshold: $alertThreshold, budgetEnforcement: $budgetEnforcement) {
    orgId monthlyBudgetCentsUSD budgetAlertThreshold budgetEnforcement
  }
}`;

// ── Meeting Notes ──

export const EXTRACT_TASKS_FROM_NOTES_QUERY = `query ExtractTasks($projectId: ID!, $notes: String!) {
  extractTasksFromNotes(projectId: $projectId, notes: $notes) {
    tasks { title description assigneeName priority status }
    summary
  }
}`;

// ── Saved Filters / Views ──

export const SAVE_FILTER_MUTATION = `mutation SaveFilter($projectId: ID!, $name: String!, $filters: String!) {
  saveFilter(projectId: $projectId, name: $name, filters: $filters) { savedFilterId name filters viewType sortBy sortOrder groupBy visibleColumns isShared isDefault createdAt }
}`;

export const DELETE_FILTER_MUTATION = `mutation DeleteFilter($savedFilterId: ID!) { deleteFilter(savedFilterId: $savedFilterId) }`;

const SAVED_FILTER_FIELDS = 'savedFilterId name filters viewType sortBy sortOrder groupBy visibleColumns isShared isDefault createdAt';

export const SHARED_VIEWS_QUERY = `query SharedViews($projectId: ID!) { sharedViews(projectId: $projectId) { ${SAVED_FILTER_FIELDS} } }`;

export const SAVE_VIEW_MUTATION = `mutation SaveView($projectId: ID!, $name: String!, $filters: String!, $viewType: String, $sortBy: String, $sortOrder: String, $groupBy: String, $isShared: Boolean) {
  saveFilter(projectId: $projectId, name: $name, filters: $filters, viewType: $viewType, sortBy: $sortBy, sortOrder: $sortOrder, groupBy: $groupBy, isShared: $isShared) { ${SAVED_FILTER_FIELDS} }
}`;

// ── Org Settings ──

export const ORG_QUERY = `query GetOrg { org { orgId name hasApiKey apiKeyHint promptLoggingEnabled } }`;

export const ORG_INVITES_QUERY = `query { orgInvites { inviteId email role expiresAt createdAt } }`;

export const GITHUB_INSTALLATIONS_QUERY = `query { githubInstallations { installationId accountLogin accountType orgId createdAt } }`;

export const SET_ORG_API_KEY_MUTATION = `mutation SetOrgApiKey($apiKey: String!, $confirmPassword: String!) { setOrgApiKey(apiKey: $apiKey, confirmPassword: $confirmPassword) { orgId name hasApiKey apiKeyHint } }`;

export const INVITE_ORG_MEMBER_MUTATION = `mutation InviteOrgMember($email: String!, $role: String) {
  inviteOrgMember(email: $email, role: $role)
}`;

export const LINK_GITHUB_INSTALLATION_MUTATION = `mutation LinkInstallation($installationId: ID!) { linkGitHubInstallation(installationId: $installationId) { installationId accountLogin accountType orgId createdAt } }`;

export const REVOKE_INVITE_MUTATION = `mutation RevokeInvite($inviteId: ID!) { revokeInvite(inviteId: $inviteId) }`;

export const SET_PROMPT_LOGGING_MUTATION = `mutation SetAIBudget($promptLoggingEnabled: Boolean) { setAIBudget(promptLoggingEnabled: $promptLoggingEnabled) { orgId name hasApiKey apiKeyHint promptLoggingEnabled } }`;

// ── Task Field Updates (simple, non-dynamic) ──

export const UPDATE_TASK_STATUS_MUTATION = `mutation UpdateTask($taskId: ID!, $status: String!) { updateTask(taskId: $taskId, status: $status) { task { taskId } warnings } }`;

export const UPDATE_TASK_SPRINT_MUTATION = `mutation UpdateTask($taskId: ID!, $sprintId: ID, $sprintColumn: String) {
  updateTask(taskId: $taskId, sprintId: $sprintId, sprintColumn: $sprintColumn) { task { taskId } warnings }
}`;

export const UPDATE_TASK_ASSIGNEE_MUTATION = `mutation UpdateTask($taskId: ID!, $assigneeId: ID) { updateTask(taskId: $taskId, assigneeId: $assigneeId) { task { taskId } warnings } }`;

export const UPDATE_TASK_DUEDATE_MUTATION = `mutation UpdateTask($taskId: ID!, $dueDate: String) { updateTask(taskId: $taskId, dueDate: $dueDate) { task { taskId } warnings } }`;

export const UPDATE_TASK_TITLE_MUTATION = `mutation UpdateTask($taskId: ID!, $title: String!) { updateTask(taskId: $taskId, title: $title) { task { taskId } warnings } }`;

export const UPDATE_TASK_ARCHIVED_MUTATION = `mutation UpdateTask($taskId: ID!, $archived: Boolean) { updateTask(taskId: $taskId, archived: $archived) { task { taskId } warnings } }`;

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

export function buildUpdateTaskFieldsMutation(fields: { description?: boolean; instructions?: boolean; acceptanceCriteria?: boolean; storyPoints?: boolean }): string {
  const vars = ['$taskId: ID!'];
  const args = ['taskId: $taskId'];
  if (fields.description) { vars.push('$description: String'); args.push('description: $description'); }
  if (fields.instructions) { vars.push('$instructions: String'); args.push('instructions: $instructions'); }
  if (fields.acceptanceCriteria) { vars.push('$acceptanceCriteria: String'); args.push('acceptanceCriteria: $acceptanceCriteria'); }
  if (fields.storyPoints) { vars.push('$storyPoints: Int'); args.push('storyPoints: $storyPoints'); }
  return `mutation UpdateTask(${vars.join(', ')}) { updateTask(${args.join(', ')}) { task { taskId } warnings } }`;
}

// ── Task Dependencies ──

export const ADD_TASK_DEPENDENCY_MUTATION = `mutation AddDep($sourceTaskId: ID!, $targetTaskId: ID!, $linkType: DependencyLinkType!) {
  addTaskDependency(sourceTaskId: $sourceTaskId, targetTaskId: $targetTaskId, linkType: $linkType) {
    taskDependencyId sourceTaskId targetTaskId linkType createdAt targetTask { taskId title status }
  }
}`;

export const REMOVE_TASK_DEPENDENCY_MUTATION = `mutation RemoveDep($taskDependencyId: ID!) { removeTaskDependency(taskDependencyId: $taskDependencyId) }`;

// ── Auth ──

export const ME_QUERY = `query { me { userId email orgId role emailVerifiedAt } }`;

export const LOGIN_MUTATION = `mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) { token }
}`;

export const SIGNUP_MUTATION = `mutation Signup($email: String!, $password: String!) {
  signup(email: $email, password: $password)
}`;

export const LOGOUT_MUTATION = `mutation Logout { logout }`;

// ── Portfolio ──

export const PORTFOLIO_OVERVIEW_QUERY = `query PortfolioOverview {
  portfolioOverview {
    projectId name totalTasks completedTasks overdueTasks
    completionPercent activeSprint healthScore
    statusDistribution { label count }
  }
  portfolioRollup {
    totalProjects totalTasks totalVelocity avgCycleTimeHours
    teamSprintProgress { totalSprints activeSprints avgCompletionPercent }
    aggregateStatusDistribution { label count }
  }
}`;

// ── Profile ──

export const ME_PROFILE_QUERY = `query MeProfile {
  me { userId email displayName avatarUrl timezone }
}`;

export const UPDATE_PROFILE_MUTATION = `mutation UpdateProfile($displayName: String, $avatarUrl: String, $timezone: String) {
  updateProfile(displayName: $displayName, avatarUrl: $avatarUrl, timezone: $timezone) {
    email displayName avatarUrl timezone
  }
}`;

// ── Charts & Reports ──

export const SPRINT_BURNDOWN_QUERY = `query Burndown($sprintId: ID!) {
  sprintBurndown(sprintId: $sprintId) {
    days { date remaining completed added }
    totalScope sprintName startDate endDate
  }
}`;

export const CUMULATIVE_FLOW_QUERY = `query CumulativeFlow($projectId: ID!, $sprintId: ID, $fromDate: String, $toDate: String) {
  cumulativeFlow(projectId: $projectId, sprintId: $sprintId, fromDate: $fromDate, toDate: $toDate) {
    days { date statusCounts { status count } }
    statuses
  }
}`;

export const SPRINT_VELOCITY_QUERY = `query Velocity($projectId: ID!) { sprintVelocity(projectId: $projectId) { sprintId sprintName completedTasks completedHours totalTasks totalHours } }`;

export const GENERATE_SPRINT_REPORT_QUERY = `query GenerateSprintReport($projectId: ID!, $sprintId: ID!) {
  generateSprintReport(projectId: $projectId, sprintId: $sprintId) {
    summary completionRate highlights concerns recommendations
  }
}`;

export const GENERATE_STANDUP_REPORT_QUERY = `query GenerateStandup($projectId: ID!) {
  generateStandupReport(projectId: $projectId) {
    completed inProgress blockers summary
  }
}`;

export const ANALYZE_PROJECT_HEALTH_QUERY = `query AnalyzeHealth($projectId: ID!) {
  analyzeProjectHealth(projectId: $projectId) {
    healthScore status
    issues { title severity description }
    strengths actionItems
  }
}`;

export const ANALYZE_TRENDS_QUERY = `query AnalyzeTrends($projectId: ID!, $period: String) {
  analyzeTrends(projectId: $projectId, period: $period) {
    period completionTrend velocityTrend healthTrend insights recommendations
  }
}`;

// ── ProjectDetail ──

export const GITHUB_PROJECT_REPO_QUERY = `query GitHubRepo($projectId: ID!) { githubProjectRepo(projectId: $projectId) { repositoryId repositoryName repositoryOwner installationId defaultBranch } }`;

export const PROJECT_ACTIVITIES_QUERY = `query Activities($projectId: ID!) { activities(projectId: $projectId, limit: 50) { activityId projectId taskId sprintId userId userEmail action field oldValue newValue createdAt } }`;

export const SAVE_AS_TEMPLATE_MUTATION = `mutation SaveAsTemplate($projectId: ID, $name: String!, $description: String, $instructions: String, $acceptanceCriteria: String, $priority: String, $taskType: String) {
  createTaskTemplate(projectId: $projectId, name: $name, description: $description, instructions: $instructions, acceptanceCriteria: $acceptanceCriteria, priority: $priority, taskType: $taskType) { taskTemplateId }
}`;

// ── Sprint Modals ──

export const UPDATE_SPRINT_MUTATION = `mutation UpdateSprint($sprintId: ID!, $name: String, $goal: String, $columns: String, $startDate: String, $endDate: String, $wipLimits: String) {
  updateSprint(sprintId: $sprintId, name: $name, goal: $goal, columns: $columns, startDate: $startDate, endDate: $endDate, wipLimits: $wipLimits) {
    sprintId projectId name goal isActive columns wipLimits startDate endDate createdAt closedAt
  }
}`;

export const CREATE_SPRINT_MUTATION = `mutation CreateSprint($projectId: ID!, $name: String!, $goal: String, $columns: String, $startDate: String, $endDate: String, $wipLimits: String) {
  createSprint(projectId: $projectId, name: $name, goal: $goal, columns: $columns, startDate: $startDate, endDate: $endDate, wipLimits: $wipLimits) {
    sprintId projectId name goal isActive columns wipLimits startDate endDate createdAt closedAt
  }
}`;

export const PREVIEW_SPRINT_PLAN_MUTATION = `mutation PreviewSprintPlan($projectId: ID!, $sprintLengthWeeks: Int!, $teamSize: Int!) {
  previewSprintPlan(projectId: $projectId, sprintLengthWeeks: $sprintLengthWeeks, teamSize: $teamSize) {
    name taskIds totalHours
  }
}`;

export const COMMIT_SPRINT_PLAN_MUTATION = `mutation CommitSprintPlan($projectId: ID!, $sprints: [SprintPlanInput!]!) {
  commitSprintPlan(projectId: $projectId, sprints: $sprints) {
    sprintId projectId name isActive columns startDate endDate createdAt
  }
}`;

export const CLOSE_SPRINT_MUTATION = `mutation CloseSprint($sprintId: ID!, $incompleteTaskActions: [IncompleteTaskAction!]!) {
  closeSprint(sprintId: $sprintId, incompleteTaskActions: $incompleteTaskActions) {
    sprint {
      sprintId projectId name isActive columns startDate endDate createdAt closedAt
    }
    nextSprint {
      sprintId projectId name isActive columns startDate endDate createdAt closedAt
    }
  }
}`;

// ── Task Insights ──

export const TASK_INSIGHTS_QUERY = `query TaskInsights($projectId: ID!, $taskId: ID) {
  taskInsights(projectId: $projectId, taskId: $taskId) {
    taskInsightId sourceTaskId targetTaskId type content autoApplied createdAt
    sourceTask { taskId title }
    targetTask { taskId title }
  }
}`;

export const DISMISS_INSIGHT_MUTATION = `mutation DismissInsight($taskInsightId: ID!) {
  dismissInsight(taskInsightId: $taskInsightId)
}`;

// ── AI Review ──

export const REVIEW_PR_MUTATION = `mutation ReviewPR($taskId: ID!, $prNumber: Int!) {
  reviewPullRequest(taskId: $taskId, prNumber: $prNumber) {
    summary approved
    comments { file line severity comment }
    suggestions
  }
}`;
