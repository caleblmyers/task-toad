import { createSchema } from 'graphql-yoga';
import type { Context } from './context.js';
import { resolvers } from './resolvers/index.js';

export const schema = createSchema<Context>({
  typeDefs: /* GraphQL */ `
    type User {
      userId: ID!
      email: String!
      orgId: ID
      role: String
      emailVerifiedAt: String
    }

    type OrgInvite {
      inviteId:   ID!
      email:      String!
      role:       String!
      expiresAt:  String!
      createdAt:  String!
      acceptedAt: String
    }

    type Org {
      orgId: ID!
      name: String!
      createdAt: String!
      hasApiKey: Boolean!
      apiKeyHint: String
    }

    type Project {
      projectId: ID!
      name: String!
      description: String
      prompt: String
      statuses: String!
      createdAt: String!
      orgId: ID!
      archived: Boolean!
      githubRepositoryName: String
      githubRepositoryOwner: String
    }

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

    type Sprint {
      sprintId:  ID!
      projectId: ID!
      name:      String!
      goal:      String
      isActive:  Boolean!
      columns:   String!
      startDate: String
      endDate:   String
      createdAt: String!
      closedAt:  String
    }

    type OrgUser {
      userId: ID!
      email:  String!
      role:   String
    }

    type ProjectOption {
      title: String!
      description: String!
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

    type SprintPlanItem {
      name:       String!
      taskIds:    [ID!]!
      totalHours: Float!
    }

    input IncompleteTaskAction {
      taskId:         ID!
      action:         String!
      targetSprintId: ID
    }

    type CloseSprintResult {
      sprint:     Sprint!
      nextSprint: Sprint
    }

    input SprintPlanInput {
      name:    String!
      taskIds: [ID!]!
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

    type Comment {
      commentId: ID!
      taskId: ID!
      userId: ID!
      userEmail: String!
      parentCommentId: ID
      content: String!
      createdAt: String!
      updatedAt: String!
      replies: [Comment!]!
    }

    type Activity {
      activityId: ID!
      projectId: ID
      taskId: ID
      sprintId: ID
      userId: ID!
      userEmail: String!
      action: String!
      field: String
      oldValue: String
      newValue: String
      createdAt: String!
    }

    type Label {
      labelId: ID!
      name: String!
      color: String!
    }

    type Notification {
      notificationId: ID!
      type: String!
      title: String!
      body: String
      linkUrl: String
      isRead: Boolean!
      createdAt: String!
    }

    type CountEntry {
      label: String!
      count: Int!
    }

    type AssigneeCount {
      userId: ID!
      email: String!
      count: Int!
    }

    type ProjectStats {
      totalTasks: Int!
      completedTasks: Int!
      overdueTasks: Int!
      completionPercent: Float!
      tasksByStatus: [CountEntry!]!
      tasksByPriority: [CountEntry!]!
      tasksByAssignee: [AssigneeCount!]!
      totalEstimatedHours: Float!
      completedEstimatedHours: Float!
    }

    type SprintVelocityPoint {
      sprintId: ID!
      sprintName: String!
      completedTasks: Int!
      completedHours: Float!
      totalTasks: Int!
      totalHours: Float!
      pointsCompleted: Int!
      pointsTotal: Int!
    }

    type BurndownDay {
      date: String!
      remaining: Int!
      completed: Int!
      added: Int!
    }

    type SprintBurndownData {
      days: [BurndownDay!]!
      totalScope: Int!
      sprintName: String!
      startDate: String!
      endDate: String!
    }

    type StandupReport {
      completed: [String!]!
      inProgress: [String!]!
      blockers: [String!]!
      summary: String!
    }

    type SprintReportResult {
      summary: String!
      completionRate: Float!
      highlights: [String!]!
      concerns: [String!]!
      recommendations: [String!]!
    }

    type HealthIssue {
      title: String!
      severity: String!
      description: String!
    }

    type ProjectHealth {
      healthScore: Int!
      status: String!
      issues: [HealthIssue!]!
      strengths: [String!]!
      actionItems: [String!]!
    }

    type ExtractedTask {
      title: String!
      description: String
      assigneeName: String
      priority: String
      status: String
    }

    type MeetingNotesResult {
      tasks: [ExtractedTask!]!
      summary: String!
    }

    type GeneratedFile {
      path: String!
      content: String!
      language: String!
      description: String!
    }

    type CodeGeneration {
      files: [GeneratedFile!]!
      summary: String!
      estimatedTokensUsed: Int!
    }

    type AuthPayload {
      token: String!
    }

    type TaskSearchHit {
      task: Task!
      projectName: String!
    }

    type GlobalSearchResult {
      tasks: [TaskSearchHit!]!
      projects: [Project!]!
    }

    type GitHubInstallation {
      installationId: ID!
      accountLogin: String!
      accountType: String!
      orgId: ID
      createdAt: String!
    }

    type GitHubRepoLink {
      repositoryId: String!
      repositoryName: String!
      repositoryOwner: String!
      installationId: String!
      defaultBranch: String!
    }

    type TaskCommit {
      id: ID!
      sha: String!
      message: String!
      author: String!
      url: String!
      createdAt: String!
    }

    type TaskPullRequest {
      id: ID!
      prNumber: Int!
      prUrl: String!
      prTitle: String!
      state: String!
    }

    type GitHubPullRequest {
      pullRequestId: ID!
      number: Int!
      url: String!
      title: String!
    }

    type GitHubRepo {
      id: ID!
      name: String!
      owner: String!
      fullName: String!
      isPrivate: Boolean!
      defaultBranch: String!
    }

    type Query {
      me: User
      org: Org
      projects(includeArchived: Boolean): [Project!]!
      project(projectId: ID!): Project
      tasks(projectId: ID!, parentTaskId: ID, limit: Int, offset: Int): TaskConnection!
      epics(projectId: ID!): [Task!]!
      sprints(projectId: ID!): [Sprint!]!
      orgUsers: [OrgUser!]!
      orgInvites: [OrgInvite!]!
      comments(taskId: ID!): [Comment!]!
      activities(projectId: ID, taskId: ID, limit: Int): [Activity!]!
      projectStats(projectId: ID!): ProjectStats!
      labels: [Label!]!
      notifications(unreadOnly: Boolean, limit: Int): [Notification!]!
      unreadNotificationCount: Int!
      sprintVelocity(projectId: ID!): [SprintVelocityPoint!]!
      sprintBurndown(sprintId: ID!): SprintBurndownData!
      globalSearch(query: String!, limit: Int): GlobalSearchResult!
      githubInstallations: [GitHubInstallation!]!
      githubInstallationRepos(installationId: ID!): [GitHubRepo!]!
      githubProjectRepo(projectId: ID!): GitHubRepoLink
      generateStandupReport(projectId: ID!): StandupReport!
      generateSprintReport(projectId: ID!, sprintId: ID!): SprintReportResult!
      analyzeProjectHealth(projectId: ID!): ProjectHealth!
      extractTasksFromNotes(projectId: ID!, notes: String!): MeetingNotesResult!
    }

    type Mutation {
      signup(email: String!, password: String!): Boolean!
      login(email: String!, password: String!): AuthPayload!

      sendVerificationEmail: Boolean!
      verifyEmail(token: String!): Boolean!

      requestPasswordReset(email: String!): Boolean!
      resetPassword(token: String!, newPassword: String!): Boolean!

      inviteOrgMember(email: String!, role: String): Boolean!
      acceptInvite(token: String!, password: String): AuthPayload!
      revokeInvite(inviteId: ID!): Boolean!
      createOrg(name: String!, apiKey: String): Org!
      setOrgApiKey(apiKey: String!): Org!
      createProject(name: String!): Project!
      updateProject(projectId: ID!, name: String, description: String, statuses: String): Project!
      archiveProject(projectId: ID!, archived: Boolean!): Project!
      createTask(projectId: ID!, title: String!, status: String, taskType: String): Task!
      updateTask(taskId: ID!, title: String, status: String, description: String, instructions: String, dependsOn: String, sprintId: ID, sprintColumn: String, assigneeId: ID, dueDate: String, position: Float, archived: Boolean, storyPoints: Int, taskType: String): Task!
      createSubtask(parentTaskId: ID!, title: String!, taskType: String): Task!
      bulkUpdateTasks(taskIds: [ID!]!, status: String, assigneeId: ID, sprintId: ID, archived: Boolean): [Task!]!

      createComment(taskId: ID!, content: String!, parentCommentId: ID): Comment!
      updateComment(commentId: ID!, content: String!): Comment!
      deleteComment(commentId: ID!): Boolean!

      createLabel(name: String!, color: String): Label!
      deleteLabel(labelId: ID!): Boolean!
      addTaskLabel(taskId: ID!, labelId: ID!): Task!
      removeTaskLabel(taskId: ID!, labelId: ID!): Task!

      createSprint(projectId: ID!, name: String!, goal: String, columns: String, startDate: String, endDate: String): Sprint!
      updateSprint(sprintId: ID!, name: String, goal: String, columns: String, isActive: Boolean, startDate: String, endDate: String): Sprint!
      deleteSprint(sprintId: ID!): Boolean!
      closeSprint(sprintId: ID!, incompleteTaskActions: [IncompleteTaskAction!]!): CloseSprintResult!

      previewSprintPlan(projectId: ID!, sprintLengthWeeks: Int!, teamSize: Int!): [SprintPlanItem!]!
      commitSprintPlan(projectId: ID!, sprints: [SprintPlanInput!]!): [Sprint!]!

      generateProjectOptions(prompt: String!): [ProjectOption!]!
      createProjectFromOption(prompt: String!, title: String!, description: String!): Project!
      generateTaskPlan(projectId: ID!, context: String): [Task!]!
      previewTaskPlan(projectId: ID!, context: String, appendToTitles: [String!]): [TaskPlanPreview!]!
      commitTaskPlan(projectId: ID!, tasks: [CommitTaskInput!]!, clearExisting: Boolean): [Task!]!
      expandTask(taskId: ID!, context: String): [Task!]!
      generateTaskInstructions(taskId: ID!): Task!
      generateCodeFromTask(taskId: ID!): CodeGeneration!
      regenerateCodeFile(taskId: ID!, filePath: String!, feedback: String): GeneratedFile!
      summarizeProject(projectId: ID!): String!

      markNotificationRead(notificationId: ID!): Notification!
      markAllNotificationsRead: Boolean!

      linkGitHubInstallation(installationId: ID!): GitHubInstallation!
      connectGitHubRepo(projectId: ID!, installationId: ID!, owner: String!, name: String!): GitHubRepoLink!
      disconnectGitHubRepo(projectId: ID!): Boolean!
      createGitHubRepo(projectId: ID!, installationId: ID!, ownerLogin: String!): GitHubRepoLink!
      createPullRequestFromTask(projectId: ID!, taskId: ID!, files: [GitHubFileInput!]!): GitHubPullRequest!
      syncTaskToGitHub(taskId: ID!): Task!
    }

    input GitHubFileInput {
      path: String!
      content: String!
    }
  `,
  resolvers,
});
