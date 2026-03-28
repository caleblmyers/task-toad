// ── Sprint Queries ──

export const SPRINTS_QUERY = `query Sprints($projectId: ID!) {
  sprints(projectId: $projectId) { sprintId projectId name goal isActive columns wipLimits startDate endDate createdAt closedAt }
}`;

export const SPRINT_BURNDOWN_QUERY = `query Burndown($sprintId: ID!) {
  sprintBurndown(sprintId: $sprintId) {
    days { date remaining completed added }
    totalScope sprintName startDate endDate
  }
}`;

export const SPRINT_VELOCITY_QUERY = `query Velocity($projectId: ID!) { sprintVelocity(projectId: $projectId) { sprintId sprintName completedTasks completedHours totalTasks totalHours } }`;

export const CUMULATIVE_FLOW_QUERY = `query CumulativeFlow($projectId: ID!, $sprintId: ID, $fromDate: String, $toDate: String) {
  cumulativeFlow(projectId: $projectId, sprintId: $sprintId, fromDate: $fromDate, toDate: $toDate) {
    days { date statusCounts { status count } }
    statuses
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

export const SPRINT_TIME_SUMMARY_QUERY = `query SprintTimeSummary($sprintId: ID!) {
  sprintTimeSummary(sprintId: $sprintId) {
    sprintId totalMinutes
    byUser { userId userEmail totalMinutes }
  }
}`;

export const WORKLOAD_HEATMAP_QUERY = `query WorkloadHeatmap($projectId: ID!, $startDate: String!, $endDate: String!) {
  workloadHeatmap(projectId: $projectId, startDate: $startDate, endDate: $endDate) {
    userId userName week totalHours taskCount
  }
}`;

// ── Sprint Mutations ──

export const CREATE_SPRINT_MUTATION = `mutation CreateSprint($projectId: ID!, $name: String!, $goal: String, $columns: String, $startDate: String, $endDate: String, $wipLimits: String) {
  createSprint(projectId: $projectId, name: $name, goal: $goal, columns: $columns, startDate: $startDate, endDate: $endDate, wipLimits: $wipLimits) {
    sprintId projectId name goal isActive columns wipLimits startDate endDate createdAt closedAt
  }
}`;

export const UPDATE_SPRINT_MUTATION = `mutation UpdateSprint($sprintId: ID!, $name: String, $goal: String, $columns: String, $startDate: String, $endDate: String, $wipLimits: String) {
  updateSprint(sprintId: $sprintId, name: $name, goal: $goal, columns: $columns, startDate: $startDate, endDate: $endDate, wipLimits: $wipLimits) {
    sprintId projectId name goal isActive columns wipLimits startDate endDate createdAt closedAt
  }
}`;

export const ACTIVATE_SPRINT_MUTATION = `mutation UpdateSprint($sprintId: ID!, $isActive: Boolean) {
  updateSprint(sprintId: $sprintId, isActive: $isActive) { sprintId isActive }
}`;

export const DELETE_SPRINT_MUTATION = `mutation DeleteSprint($sprintId: ID!) { deleteSprint(sprintId: $sprintId) }`;

export const CLOSE_SPRINT_MUTATION = `mutation CloseSprint($sprintId: ID!, $incompleteTaskActions: [IncompleteTaskAction!]!) {
  closeSprint(sprintId: $sprintId, incompleteTaskActions: $incompleteTaskActions) {
    sprint {
      sprintId projectId name isActive columns startDate endDate createdAt closedAt
    }
    nextSprint {
      sprintId projectId name isActive columns startDate endDate createdAt closedAt
    }
    reconciliation {
      status
      failingChecks
      reconciliationTaskId
    }
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

// ── Reports (sprint-related) ──

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
