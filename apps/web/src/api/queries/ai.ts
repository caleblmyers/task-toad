import { TASK_FIELDS } from '../../utils/taskHelpers';

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

// ── Task Planning ──

export const PREVIEW_TASK_PLAN_MUTATION = `mutation PreviewTaskPlan($projectId: ID!, $context: String, $appendToTitles: [String!]) {
  previewTaskPlan(projectId: $projectId, context: $context, appendToTitles: $appendToTitles) {
    title description instructions suggestedTools estimatedHours priority dependsOn
    tasks { title description instructions estimatedHours priority acceptanceCriteria suggestedTools }
  }
}`;

export const COMMIT_TASK_PLAN_MUTATION = `mutation CommitTaskPlan($projectId: ID!, $tasks: [CommitTaskInput!]!, $clearExisting: Boolean) {
  commitTaskPlan(projectId: $projectId, tasks: $tasks, clearExisting: $clearExisting) { ${TASK_FIELDS} }
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

export const SUMMARIZE_PROJECT_MUTATION = `mutation SummarizeProject($projectId: ID!) {
  summarizeProject(projectId: $projectId)
}`;

export const AUTO_START_PROJECT_MUTATION = `mutation AutoStartProject($projectId: ID!) {
  autoStartProject(projectId: $projectId) { projectId name }
}`;

export const PARSE_BUG_REPORT_MUTATION = `mutation ParseBugReport($projectId: ID!, $bugReport: String!) {
  parseBugReport(projectId: $projectId, bugReport: $bugReport) { ${TASK_FIELDS} }
}`;

// ── PRD ──

export const PREVIEW_PRD_MUTATION = `mutation PreviewPRD($projectId: ID!, $prd: String!) {
  previewPRDBreakdown(projectId: $projectId, prd: $prd) {
    epics { title description tasks { title description priority estimatedHours acceptanceCriteria } }
  }
}`;

export const COMMIT_PRD_MUTATION = `mutation CommitPRD($projectId: ID!, $epics: String!) {
  commitPRDBreakdown(projectId: $projectId, epics: $epics) { ${TASK_FIELDS} }
}`;

// ── Hierarchical Plan ──

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

// ── Stack Recommendation ──

export const RECOMMEND_STACK_QUERY = `query RecommendStack($projectId: ID!) {
  recommendStack(projectId: $projectId) {
    recommended {
      label description rationale
      config { framework language packages projectType }
    }
    alternatives {
      label description rationale
      config { framework language packages projectType }
    }
  }
}`;

// ── Bootstrap / Repo ──

export const BOOTSTRAP_REPO_MUTATION = `mutation BootstrapFromRepo($projectId: ID!) {
  bootstrapProjectFromRepo(projectId: $projectId) { ${TASK_FIELDS} }
}`;

export const REFRESH_REPO_PROFILE_MUTATION = `mutation RefreshRepoProfile($projectId: ID!) {
  refreshRepoProfile(projectId: $projectId) {
    projectId name description prompt knowledgeBase statuses createdAt orgId archived
  }
}`;

// ── Action Plans ──

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
    task { taskId title status taskType autoComplete parentTaskTitle blockedBy { taskId title linkType } }
  }
}`;

export const TASK_ACTION_PLAN_QUERY = `query TaskActionPlan($taskId: ID!) {
  taskActionPlan(taskId: $taskId) {
    id taskId status summary createdAt updatedAt
    actions { id planId actionType label config position status requiresApproval result errorMessage startedAt completedAt createdAt }
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

// ── Meeting Notes ──

export const EXTRACT_TASKS_FROM_NOTES_QUERY = `query ExtractTasks($projectId: ID!, $notes: String!) {
  extractTasksFromNotes(projectId: $projectId, notes: $notes) {
    tasks { title description assigneeName priority status }
    summary
  }
}`;

// ── Analytics ──

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
