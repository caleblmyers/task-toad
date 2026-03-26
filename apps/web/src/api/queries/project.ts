// ── Project Queries ──

export const PROJECT_QUERY = `query Project($projectId: ID!) {
  project(projectId: $projectId) { projectId name description prompt knowledgeBase statuses createdAt orgId archived githubRepositoryName githubRepositoryOwner }
}`;

export const PROJECT_STATS_QUERY = `query ProjectStats($projectId: ID!) {
  projectStats(projectId: $projectId) {
    totalTasks completedTasks overdueTasks completionPercent
    tasksByStatus { label count } tasksByPriority { label count }
    tasksByAssignee { userId email count } totalEstimatedHours completedEstimatedHours
  }
}`;

// ── Project Mutations ──

export const UPDATE_PROJECT_MUTATION = `mutation UpdateProject($projectId: ID!, $name: String, $description: String, $prompt: String, $knowledgeBase: String, $statuses: String) {
  updateProject(projectId: $projectId, name: $name, description: $description, prompt: $prompt, knowledgeBase: $knowledgeBase, statuses: $statuses) {
    projectId name description prompt knowledgeBase statuses createdAt orgId archived
  }
}`;

// ── Saved Filters / Views ──

const SAVED_FILTER_FIELDS = 'savedFilterId name filters viewType sortBy sortOrder groupBy visibleColumns isShared isDefault createdAt';

export const SAVE_FILTER_MUTATION = `mutation SaveFilter($projectId: ID!, $name: String!, $filters: String!) {
  saveFilter(projectId: $projectId, name: $name, filters: $filters) { savedFilterId name filters viewType sortBy sortOrder groupBy visibleColumns isShared isDefault createdAt }
}`;

export const DELETE_FILTER_MUTATION = `mutation DeleteFilter($savedFilterId: ID!) { deleteFilter(savedFilterId: $savedFilterId) }`;

export const UPDATE_FILTER_MUTATION = `mutation UpdateFilter($savedFilterId: ID!, $name: String, $isShared: Boolean) {
  updateFilter(savedFilterId: $savedFilterId, name: $name, isShared: $isShared) { savedFilterId name filters viewType sortBy sortOrder groupBy visibleColumns isShared isDefault createdAt }
}`;

export const SHARED_VIEWS_QUERY = `query SharedViews($projectId: ID!) { sharedViews(projectId: $projectId) { ${SAVED_FILTER_FIELDS} } }`;

export const SAVE_VIEW_MUTATION = `mutation SaveView($projectId: ID!, $name: String!, $filters: String!, $viewType: String, $sortBy: String, $sortOrder: String, $groupBy: String, $isShared: Boolean) {
  saveFilter(projectId: $projectId, name: $name, filters: $filters, viewType: $viewType, sortBy: $sortBy, sortOrder: $sortOrder, groupBy: $groupBy, isShared: $isShared) { ${SAVED_FILTER_FIELDS} }
}`;

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

// ── Project Members ──

export const PROJECT_MEMBERS_QUERY = `query ProjectMembers($projectId: ID!) { projectMembers(projectId: $projectId) { id userId email role createdAt } }`;

export const ADD_PROJECT_MEMBER_MUTATION = `mutation AddMember($projectId: ID!, $userId: ID!, $role: String) {
  addProjectMember(projectId: $projectId, userId: $userId, role: $role) { id userId email role createdAt }
}`;

export const REMOVE_PROJECT_MEMBER_MUTATION = `mutation RemoveMember($projectId: ID!, $userId: ID!) { removeProjectMember(projectId: $projectId, userId: $userId) }`;

export const UPDATE_PROJECT_MEMBER_ROLE_MUTATION = `mutation UpdateRole($projectId: ID!, $userId: ID!, $role: String!) {
  updateProjectMemberRole(projectId: $projectId, userId: $userId, role: $role) { id userId email role createdAt }
}`;

// ── ProjectDetail ──

export const GITHUB_PROJECT_REPO_QUERY = `query GitHubRepo($projectId: ID!) { githubProjectRepo(projectId: $projectId) { repositoryId repositoryName repositoryOwner installationId defaultBranch } }`;

export const PROJECT_ACTIVITIES_QUERY = `query Activities($projectId: ID!) { activities(projectId: $projectId, limit: 50) { activityId projectId taskId sprintId userId userEmail action field oldValue newValue createdAt } }`;

// ── Project Setup ──

export const SCAFFOLD_PROJECT_MUTATION = `mutation ScaffoldProject($projectId: ID!, $config: ScaffoldConfigInput!, $options: String) {
  scaffoldProject(projectId: $projectId, config: $config, options: $options) {
    success filesCreated summary commitUrl
  }
}`;
