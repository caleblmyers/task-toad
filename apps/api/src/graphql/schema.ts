import { createSchema } from 'graphql-yoga';
import type { Context } from './context.js';
import { resolvers } from './resolvers/index.js';
import { authTypeDefs, authQueryFields, authMutationFields } from './typedefs/auth.js';
import { orgTypeDefs, orgQueryFields, orgMutationFields } from './typedefs/org.js';
import { projectTypeDefs, projectQueryFields, projectMutationFields } from './typedefs/project.js';
import { taskTypeDefs, taskQueryFields, taskMutationFields } from './typedefs/task.js';
import { sprintTypeDefs, sprintQueryFields, sprintMutationFields } from './typedefs/sprint.js';
import { commentTypeDefs, commentQueryFields, commentMutationFields } from './typedefs/comment.js';
import { notificationTypeDefs, notificationQueryFields, notificationMutationFields } from './typedefs/notification.js';
import { reportTypeDefs, reportQueryFields, reportMutationFields } from './typedefs/report.js';
import { githubTypeDefs, githubQueryFields, githubMutationFields } from './typedefs/github.js';
import { aiTypeDefs, aiQueryFields, aiMutationFields } from './typedefs/ai.js';
import { searchTypeDefs, searchQueryFields } from './typedefs/search.js';
import { projectRoleTypeDefs, projectRoleQueryFields, projectRoleMutationFields } from './typedefs/projectrole.js';

const typeDefs = /* GraphQL */ `
  ${authTypeDefs}
  ${orgTypeDefs}
  ${projectTypeDefs}
  ${taskTypeDefs}
  ${sprintTypeDefs}
  ${commentTypeDefs}
  ${notificationTypeDefs}
  ${reportTypeDefs}
  ${githubTypeDefs}
  ${aiTypeDefs}
  ${searchTypeDefs}
  ${projectRoleTypeDefs}

  type Query {
    ${authQueryFields}
    ${orgQueryFields}
    ${projectQueryFields}
    ${taskQueryFields}
    ${sprintQueryFields}
    ${commentQueryFields}
    ${notificationQueryFields}
    ${reportQueryFields}
    ${githubQueryFields}
    ${aiQueryFields}
    ${searchQueryFields}
    ${projectRoleQueryFields}
  }

  type Mutation {
    ${authMutationFields}
    ${orgMutationFields}
    ${projectMutationFields}
    ${taskMutationFields}
    ${sprintMutationFields}
    ${commentMutationFields}
    ${notificationMutationFields}
    ${reportMutationFields}
    ${githubMutationFields}
    ${aiMutationFields}
    ${projectRoleMutationFields}
  }
`;

export const schema = createSchema<Context>({
  typeDefs,
  resolvers,
});
