import { createSchema } from 'graphql-yoga';
import { GraphQLError, Kind, type ValidationContext, type ASTVisitor, type SelectionSetNode } from 'graphql';
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
import { webhookTypeDefs, webhookQueryFields, webhookMutationFields } from './typedefs/webhook.js';
import { slackTypeDefs, slackQueryFields, slackMutationFields } from './typedefs/slack.js';

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
  ${webhookTypeDefs}
  ${slackTypeDefs}

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
    ${webhookQueryFields}
    ${slackQueryFields}
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
    ${webhookMutationFields}
    ${slackMutationFields}
  }
`;

export const schema = createSchema<Context>({
  typeDefs,
  resolvers,
});

// GraphQL depth limit validation rule — prevents nested query attacks
function measureDepth(selectionSet: SelectionSetNode, depth: number): number {
  let max = depth;
  for (const selection of selectionSet.selections) {
    if ('selectionSet' in selection && selection.selectionSet) {
      max = Math.max(max, measureDepth(selection.selectionSet, depth + 1));
    }
  }
  return max;
}

export function depthLimitRule(maxDepth: number) {
  return (context: ValidationContext): ASTVisitor => ({
    Document: {
      enter(node) {
        for (const definition of node.definitions) {
          if (
            (definition.kind === Kind.OPERATION_DEFINITION ||
              definition.kind === Kind.FRAGMENT_DEFINITION) &&
            definition.selectionSet
          ) {
            const depth = measureDepth(definition.selectionSet, 1);
            if (depth > maxDepth) {
              context.reportError(
                new GraphQLError(
                  `Query depth ${depth} exceeds maximum allowed depth of ${maxDepth}`
                )
              );
            }
          }
        }
      },
    },
  });
}
