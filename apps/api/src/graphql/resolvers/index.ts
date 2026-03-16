import { authQueries, authMutations, authFieldResolvers } from './auth.js';
import { orgQueries, orgMutations, orgFieldResolvers } from './org.js';
import { projectQueries, projectMutations } from './project.js';
import { taskQueries, taskMutations, taskFieldResolvers } from './task.js';
import { sprintQueries, sprintMutations, sprintFieldResolvers } from './sprint.js';
import { aiMutations, aiQueries } from './ai.js';
import { githubQueries, githubMutations, githubFieldResolvers } from './github.js';
import { notificationQueries, notificationMutations, notificationFieldResolvers } from './notification.js';
import { searchQueries, searchMutations } from './search.js';
import { projectRoleQueries, projectRoleMutations } from './projectrole.js';

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
  },
  // Field resolvers
  User: { ...authFieldResolvers.User },
  OrgInvite: { ...authFieldResolvers.OrgInvite },
  Org: { ...orgFieldResolvers.Org },
  Task: { ...taskFieldResolvers.Task },
  GitHubInstallation: { ...githubFieldResolvers.GitHubInstallation },
  Sprint: { ...sprintFieldResolvers.Sprint },
  Notification: { ...notificationFieldResolvers.Notification },
};
