import { authQueries, authMutations, authFieldResolvers } from './auth.js';
import { orgQueries, orgMutations, orgFieldResolvers } from './org.js';
import { projectQueries, projectMutations, projectFieldResolvers } from './project.js';
import { taskQueries, taskMutations, taskFieldResolvers } from './task.js';
import { sprintQueries, sprintMutations, sprintFieldResolvers } from './sprint.js';
import { aiMutations, aiQueries } from './ai.js';
import { githubQueries, githubMutations, githubFieldResolvers } from './github.js';
import { notificationQueries, notificationMutations, notificationFieldResolvers } from './notification.js';
import { searchQueries, searchMutations } from './search.js';
import { projectRoleQueries, projectRoleMutations } from './projectrole.js';
import { webhookQueries, webhookMutations } from './webhook.js';
import { slackQueries, slackMutations, slackFieldResolvers } from './slack.js';
import { templateQueries, templateMutations } from './template.js';
import { taskActionQueries, taskActionMutations, taskActionFieldResolvers } from './taskaction.js';
import { workflowQueries, workflowMutations } from './workflow.js';
import { releaseQueries, releaseMutations, releaseFieldResolvers } from './release.js';
import { timeEntryQueries, timeEntryMutations } from './timeentry.js';
import { capacityQueries, capacityMutations } from './capacity.js';

export const resolvers = {
  Query: {
    ...authQueries,
    ...orgQueries,
    ...projectQueries,
    ...taskQueries,
    ...sprintQueries,
    ...githubQueries,
    ...notificationQueries,
    ...searchQueries,
    ...aiQueries,
    ...projectRoleQueries,
    ...webhookQueries,
    ...slackQueries,
    ...templateQueries,
    ...taskActionQueries,
    ...workflowQueries,
    ...releaseQueries,
    ...timeEntryQueries,
    ...capacityQueries,
  },
  Mutation: {
    ...authMutations,
    ...orgMutations,
    ...projectMutations,
    ...taskMutations,
    ...sprintMutations,
    ...aiMutations,
    ...githubMutations,
    ...notificationMutations,
    ...searchMutations,
    ...projectRoleMutations,
    ...webhookMutations,
    ...slackMutations,
    ...templateMutations,
    ...taskActionMutations,
    ...workflowMutations,
    ...releaseMutations,
    ...timeEntryMutations,
    ...capacityMutations,
  },
  // Field resolvers
  User: { ...authFieldResolvers.User },
  OrgInvite: { ...authFieldResolvers.OrgInvite },
  Org: { ...orgFieldResolvers.Org },
  Project: { ...projectFieldResolvers.Project },
  Task: { ...taskFieldResolvers.Task },
  CustomFieldValue: { ...taskFieldResolvers.CustomFieldValue },
  GitHubInstallation: { ...githubFieldResolvers.GitHubInstallation },
  Sprint: { ...sprintFieldResolvers.Sprint },
  Notification: { ...notificationFieldResolvers.Notification },
  SlackIntegration: { ...slackFieldResolvers.SlackIntegration },
  SlackUserMapping: { ...slackFieldResolvers.SlackUserMapping },
  Report: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
  TaskTemplate: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
  },
  TaskActionPlan: { ...taskActionFieldResolvers.TaskActionPlan },
  TaskAction: { ...taskActionFieldResolvers.TaskAction },
  Release: { ...releaseFieldResolvers.Release },
};
