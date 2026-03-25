// ── Comments ──

export const COMMENTS_QUERY = `query Comments($taskId: ID!) {
  comments(taskId: $taskId) {
    commentId taskId userId userEmail parentCommentId content createdAt updatedAt
    replies { commentId taskId userId userEmail parentCommentId content createdAt updatedAt replies { commentId } }
  }
}`;

export const ACTIVITIES_QUERY = `query Activities($taskId: ID!) {
  activities(taskId: $taskId, limit: 30) { activities { activityId projectId taskId sprintId userId userEmail action field oldValue newValue createdAt } hasMore }
}`;

export const CREATE_COMMENT_MUTATION = `mutation CreateComment($taskId: ID!, $content: String!, $parentCommentId: ID) {
  createComment(taskId: $taskId, content: $content, parentCommentId: $parentCommentId) {
    commentId taskId userId userEmail parentCommentId content createdAt updatedAt replies { commentId }
  }
}`;

export const UPDATE_COMMENT_MUTATION = `mutation UpdateComment($commentId: ID!, $content: String!) {
  updateComment(commentId: $commentId, content: $content) { commentId content updatedAt }
}`;

export const DELETE_COMMENT_MUTATION = `mutation DeleteComment($commentId: ID!) { deleteComment(commentId: $commentId) }`;

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

// ── Webhooks ──

export const WEBHOOK_ENDPOINTS_QUERY = `query { webhookEndpoints { id url events enabled description lastError lastFiredAt createdAt } }`;

export const WEBHOOK_DELIVERIES_QUERY = `query WebhookDeliveries($endpointId: ID!, $limit: Int) {
  webhookDeliveries(endpointId: $endpointId, limit: $limit) {
    id endpointId event status statusCode attemptCount nextRetryAt createdAt completedAt
  }
}`;

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

export const REPLAY_WEBHOOK_DELIVERY_MUTATION = `mutation ReplayWebhookDelivery($deliveryId: ID!) {
  replayWebhookDelivery(deliveryId: $deliveryId) {
    id endpointId event status statusCode attemptCount nextRetryAt createdAt completedAt
  }
}`;

// ── Releases ──

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

export const RELEASE_BURNDOWN_QUERY = `query ReleaseBurndown($releaseId: ID!) {
  releaseBurndown(releaseId: $releaseId) {
    date totalTasks completedTasks remainingTasks
  }
}`;

export const GENERATE_RELEASE_NOTES_MUTATION = `mutation GenerateReleaseNotes($releaseId: ID!) {
  generateReleaseNotes(releaseId: $releaseId) {
    releaseId name version status description releaseDate releaseNotes createdAt updatedAt tasks { taskId title status }
  }
}`;

// ── Time Tracking ──

export const TIME_ENTRIES_QUERY = `query TimeEntries($taskId: ID!, $limit: Int, $cursor: String) {
  timeEntries(taskId: $taskId, limit: $limit, cursor: $cursor) {
    entries { timeEntryId taskId userId userEmail userDisplayName durationMinutes description loggedDate billable autoTracked createdAt updatedAt }
    totalMinutes
  }
}`;

export const TASK_TIME_SUMMARY_QUERY = `query TaskTimeSummary($taskId: ID!) {
  taskTimeSummary(taskId: $taskId) {
    taskId totalMinutes estimatedHours
    entries { timeEntryId taskId userId userEmail userDisplayName durationMinutes description loggedDate billable autoTracked createdAt updatedAt }
  }
}`;

export const LOG_TIME_MUTATION = `mutation LogTime($taskId: ID!, $durationMinutes: Int!, $loggedDate: String!, $description: String, $billable: Boolean) {
  logTime(taskId: $taskId, durationMinutes: $durationMinutes, loggedDate: $loggedDate, description: $description, billable: $billable) {
    timeEntryId taskId userId userEmail userDisplayName durationMinutes description loggedDate billable autoTracked createdAt updatedAt
  }
}`;

export const UPDATE_TIME_ENTRY_MUTATION = `mutation UpdateTimeEntry($timeEntryId: ID!, $durationMinutes: Int, $description: String, $billable: Boolean) {
  updateTimeEntry(timeEntryId: $timeEntryId, durationMinutes: $durationMinutes, description: $description, billable: $billable) {
    timeEntryId taskId userId userEmail userDisplayName durationMinutes description loggedDate billable autoTracked createdAt updatedAt
  }
}`;

export const DELETE_TIME_ENTRY_MUTATION = `mutation DeleteTimeEntry($timeEntryId: ID!) {
  deleteTimeEntry(timeEntryId: $timeEntryId)
}`;

export const TIMESHEET_DATA_QUERY = `query TimesheetData($projectId: ID!, $userId: ID, $weekStart: String!) {
  timesheetData(projectId: $projectId, userId: $userId, weekStart: $weekStart) {
    rows {
      taskId taskTitle taskStatus
      entries { date minutes timeEntryId }
      weekTotal
    }
    dailyTotals
    weekTotal
  }
}`;

// ── Capacity ──

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

// ── SLA ──

export const SLA_POLICIES_QUERY = `query SLAPolicies($projectId: ID!) {
  slaPolicies(projectId: $projectId) {
    slaPolicyId projectId orgId name responseTimeHours resolutionTimeHours priority enabled createdAt
  }
}`;

export const TASK_SLA_STATUS_QUERY = `query TaskSLAStatus($taskId: ID!) {
  taskSLAStatus(taskId: $taskId) {
    slaTimerId taskId policyId startedAt respondedAt resolvedAt
    responseBreached resolutionBreached timeToResponseHours timeToResolutionHours
    policy { slaPolicyId name responseTimeHours resolutionTimeHours priority }
  }
}`;

export const CREATE_SLA_POLICY_MUTATION = `mutation CreateSLAPolicy($projectId: ID!, $name: String!, $responseTimeHours: Int!, $resolutionTimeHours: Int!, $priority: String) {
  createSLAPolicy(projectId: $projectId, name: $name, responseTimeHours: $responseTimeHours, resolutionTimeHours: $resolutionTimeHours, priority: $priority) {
    slaPolicyId projectId orgId name responseTimeHours resolutionTimeHours priority enabled createdAt
  }
}`;

export const UPDATE_SLA_POLICY_MUTATION = `mutation UpdateSLAPolicy($slaPolicyId: ID!, $name: String, $responseTimeHours: Int, $resolutionTimeHours: Int, $priority: String, $enabled: Boolean) {
  updateSLAPolicy(slaPolicyId: $slaPolicyId, name: $name, responseTimeHours: $responseTimeHours, resolutionTimeHours: $resolutionTimeHours, priority: $priority, enabled: $enabled) {
    slaPolicyId projectId orgId name responseTimeHours resolutionTimeHours priority enabled createdAt
  }
}`;

export const DELETE_SLA_POLICY_MUTATION = `mutation DeleteSLAPolicy($slaPolicyId: ID!) {
  deleteSLAPolicy(slaPolicyId: $slaPolicyId)
}`;

// ── Initiatives ──

export const INITIATIVES_QUERY = `query Initiatives {
  initiatives {
    initiativeId name description status targetDate
    projects { projectId name }
  }
}`;

export const INITIATIVE_SUMMARY_QUERY = `query InitiativeSummary($initiativeId: ID!) {
  initiativeSummary(initiativeId: $initiativeId) {
    initiativeId name status targetDate projectCount
    totalTasks completedTasks completionPercent healthScore
  }
}`;

export const CREATE_INITIATIVE_MUTATION = `mutation CreateInitiative($name: String!, $description: String, $targetDate: String) {
  createInitiative(name: $name, description: $description, targetDate: $targetDate) {
    initiativeId name description status targetDate
    projects { projectId name }
  }
}`;

export const UPDATE_INITIATIVE_MUTATION = `mutation UpdateInitiative($initiativeId: ID!, $name: String, $description: String, $status: String, $targetDate: String) {
  updateInitiative(initiativeId: $initiativeId, name: $name, description: $description, status: $status, targetDate: $targetDate) {
    initiativeId name description status targetDate
    projects { projectId name }
  }
}`;

export const DELETE_INITIATIVE_MUTATION = `mutation DeleteInitiative($initiativeId: ID!) {
  deleteInitiative(initiativeId: $initiativeId)
}`;

export const ADD_PROJECT_TO_INITIATIVE_MUTATION = `mutation AddProjectToInitiative($initiativeId: ID!, $projectId: ID!) {
  addProjectToInitiative(initiativeId: $initiativeId, projectId: $projectId) {
    initiativeId name projects { projectId name }
  }
}`;

export const REMOVE_PROJECT_FROM_INITIATIVE_MUTATION = `mutation RemoveProjectFromInitiative($initiativeId: ID!, $projectId: ID!) {
  removeProjectFromInitiative(initiativeId: $initiativeId, projectId: $projectId) {
    initiativeId name projects { projectId name }
  }
}`;

// ── Automation Rules ──

export const AUTOMATION_RULES_QUERY = `query AutomationRules($projectId: ID!) { automationRules(projectId: $projectId) { id name trigger action enabled cronExpression timezone nextRunAt lastRunAt createdAt } }`;

export const CREATE_AUTOMATION_RULE_MUTATION = `mutation CreateRule($projectId: ID!, $name: String!, $trigger: String!, $action: String!, $cronExpression: String, $timezone: String) {
  createAutomationRule(projectId: $projectId, name: $name, trigger: $trigger, action: $action, cronExpression: $cronExpression, timezone: $timezone) { id name trigger action enabled cronExpression timezone nextRunAt lastRunAt createdAt }
}`;

export const UPDATE_AUTOMATION_RULE_MUTATION = `mutation ToggleRule($ruleId: ID!, $enabled: Boolean) {
  updateAutomationRule(ruleId: $ruleId, enabled: $enabled) { id name trigger action enabled cronExpression timezone nextRunAt lastRunAt createdAt }
}`;

export const DELETE_AUTOMATION_RULE_MUTATION = `mutation DeleteRule($ruleId: ID!) { deleteAutomationRule(ruleId: $ruleId) }`;

// ── Workflow Transitions ──

export const WORKFLOW_TRANSITIONS_QUERY = `query WorkflowTransitions($projectId: ID!) {
  workflowTransitions(projectId: $projectId) {
    transitionId projectId fromStatus toStatus allowedRoles condition createdAt
  }
}`;

export const WORKFLOW_PROJECT_STATUSES_QUERY = `query Project($projectId: ID!) {
  project(projectId: $projectId) { statuses }
}`;

export const CREATE_WORKFLOW_TRANSITION_MUTATION = `mutation CreateTransition($projectId: ID!, $fromStatus: String!, $toStatus: String!) {
  createWorkflowTransition(projectId: $projectId, fromStatus: $fromStatus, toStatus: $toStatus) {
    transitionId projectId fromStatus toStatus allowedRoles condition createdAt
  }
}`;

export const UPDATE_WORKFLOW_TRANSITION_MUTATION = `mutation UpdateTransition($transitionId: ID!, $allowedRoles: [String!], $condition: String) {
  updateWorkflowTransition(transitionId: $transitionId, allowedRoles: $allowedRoles, condition: $condition) {
    transitionId projectId fromStatus toStatus allowedRoles condition createdAt
  }
}`;

export const DELETE_WORKFLOW_TRANSITION_MUTATION = `mutation DeleteTransition($transitionId: ID!) {
  deleteWorkflowTransition(transitionId: $transitionId)
}`;

// ── Field Permissions ──

export const FIELD_PERMISSIONS_QUERY = `query FieldPermissions($projectId: ID!) {
  fieldPermissions(projectId: $projectId) {
    id projectId fieldName allowedRoles createdAt
  }
}`;

export const SET_FIELD_PERMISSION_MUTATION = `mutation SetFieldPermission($projectId: ID!, $fieldName: String!, $allowedRoles: [String!]!) {
  setFieldPermission(projectId: $projectId, fieldName: $fieldName, allowedRoles: $allowedRoles) {
    id projectId fieldName allowedRoles createdAt
  }
}`;

export const DELETE_FIELD_PERMISSION_MUTATION = `mutation DeleteFieldPermission($projectId: ID!, $fieldName: String!) {
  deleteFieldPermission(projectId: $projectId, fieldName: $fieldName)
}`;
