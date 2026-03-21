import { createSchema } from 'graphql-yoga';
import { GraphQLError, Kind, type ValidationContext, type ASTVisitor, type SelectionSetNode, type FieldNode } from 'graphql';
import { logger } from '../utils/logger.js';
import type { Context } from './context.js';
import { resolvers } from './resolvers/index.js';
import { authTypeDefs, authQueryFields, authMutationFields } from './typedefs/auth.js';
import { orgTypeDefs, orgQueryFields, orgMutationFields } from './typedefs/org.js';
import { projectTypeDefs, projectQueryFields, projectMutationFields } from './typedefs/project.js';
import { taskTypeDefs, taskFilterInputDef, taskQueryFields, taskMutationFields } from './typedefs/task.js';
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
import { templateTypeDefs, templateQueryFields, templateMutationFields } from './typedefs/template.js';
import { taskActionTypeDefs, taskActionQueryFields, taskActionMutationFields } from './typedefs/taskaction.js';
import { workflowTypeDefs, workflowQueryFields, workflowMutationFields } from './typedefs/workflow.js';
import { releaseTypeDefs, releaseQueryFields, releaseMutationFields, releaseBurndownTypeDefs } from './typedefs/release.js';
import { timeEntryTypeDefs, timeEntryQueryFields, timeEntryMutationFields } from './typedefs/timeentry.js';
import { capacityTypeDefs, capacityQueryFields, capacityMutationFields } from './typedefs/capacity.js';
import { knowledgeBaseTypeDefs, knowledgeBaseQueryFields, knowledgeBaseMutationFields } from './typedefs/knowledgebase.js';
import { taskInsightTypeDefs, taskInsightQueryFields, taskInsightMutationFields } from './typedefs/taskinsight.js';
import { slaTypeDefs, slaQueryFields, slaMutationFields } from './typedefs/sla.js';
import { approvalTypeDefs, approvalQueryFields, approvalMutationFields } from './typedefs/approval.js';
import { initiativeTypeDefs, initiativeQueryFields, initiativeMutationFields } from './typedefs/initiative.js';
import { fieldPermissionTypeDefs, fieldPermissionQueryFields, fieldPermissionMutationFields } from './typedefs/fieldpermission.js';

const typeDefs = /* GraphQL */ `
  ${authTypeDefs}
  ${orgTypeDefs}
  ${projectTypeDefs}
  ${taskTypeDefs}
  ${taskFilterInputDef}
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
  ${templateTypeDefs}
  ${taskActionTypeDefs}
  ${workflowTypeDefs}
  ${releaseTypeDefs}
  ${releaseBurndownTypeDefs}
  ${timeEntryTypeDefs}
  ${capacityTypeDefs}
  ${knowledgeBaseTypeDefs}
  ${taskInsightTypeDefs}
  ${slaTypeDefs}
  ${approvalTypeDefs}
  ${initiativeTypeDefs}
  ${fieldPermissionTypeDefs}

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
    ${templateQueryFields}
    ${taskActionQueryFields}
    ${workflowQueryFields}
    ${releaseQueryFields}
    ${timeEntryQueryFields}
    ${capacityQueryFields}
    ${knowledgeBaseQueryFields}
    ${taskInsightQueryFields}
    ${slaQueryFields}
    ${approvalQueryFields}
    ${initiativeQueryFields}
    ${fieldPermissionQueryFields}
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
    ${templateMutationFields}
    ${taskActionMutationFields}
    ${workflowMutationFields}
    ${releaseMutationFields}
    ${timeEntryMutationFields}
    ${capacityMutationFields}
    ${knowledgeBaseMutationFields}
    ${taskInsightMutationFields}
    ${slaMutationFields}
    ${approvalMutationFields}
    ${initiativeMutationFields}
    ${fieldPermissionMutationFields}
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

// ---------------------------------------------------------------------------
// Query complexity / cost analysis — prevents wide fan-out queries
// ---------------------------------------------------------------------------

/**
 * Estimated item counts for known list fields.
 * Connection wrappers (e.g. tasks query returning {tasks[], hasMore, total})
 * are in SINGLE_OBJECT_FIELDS — only the inner array field fans out.
 */
const COST_MAP: Record<string, number> = {
  // Top-level arrays (inside connection wrappers or standalone)
  projects: 20,
  tasks: 50,
  comments: 30,
  activities: 50,
  notifications: 30,
  sprints: 10,
  epics: 20,
  reports: 10,
  savedFilters: 10,
  webhookEndpoints: 10,
  webhookDeliveries: 50,
  // Per-item nested lists (small cardinality)
  labels: 5,
  assignees: 3,
  pullRequests: 2,
  commits: 5,
  customFieldValues: 5,
  replies: 5,
  children: 10,
  taskAssignees: 3,
  watchers: 5,
};

const DEFAULT_LIST_MULTIPLIER = 5;

/** Fields that return a single object (not a list) — traverse at 1x multiplier.
 *  Includes connection wrapper query fields whose inner array handles fan-out. */
const SINGLE_OBJECT_FIELDS = new Set([
  // Scalar object returns
  'user', 'project', 'org', 'sprint', 'task', 'field',
  'me', 'aiUsage', 'unreadNotificationCount',
  'projectStats', 'sprintVelocity', 'sprintBurndown', 'sprintForecast', 'cycleTimeMetrics', 'cumulativeFlow', 'portfolioRollup',
  // Connection wrappers (return {items[], hasMore, total}, not a list directly)
  'tasks',
]);

/** Introspection fields exempt from cost analysis */
const INTROSPECTION_FIELDS = new Set(['__schema', '__type']);

function computeSelectionCost(selectionSet: SelectionSetNode, multiplier: number): number {
  let cost = 0;
  for (const selection of selectionSet.selections) {
    if (selection.kind === Kind.FIELD) {
      const field = selection as FieldNode;
      const fieldName = field.name.value;

      // Introspection fields are free
      if (INTROSPECTION_FIELDS.has(fieldName)) continue;

      // Leaf field costs 1 × current multiplier
      if (!field.selectionSet) {
        cost += multiplier;
        continue;
      }

      // Single-object fields traverse at same multiplier (no fan-out)
      if (SINGLE_OBJECT_FIELDS.has(fieldName)) {
        cost += computeSelectionCost(field.selectionSet, multiplier);
        continue;
      }

      // List field — apply list multiplier (known or default)
      const listMultiplier = COST_MAP[fieldName] ?? DEFAULT_LIST_MULTIPLIER;
      cost += computeSelectionCost(field.selectionSet, multiplier * listMultiplier);
    }
    // InlineFragment / FragmentSpread — traverse their selection sets at the same multiplier
    if ('selectionSet' in selection && selection.selectionSet && selection.kind !== Kind.FIELD) {
      cost += computeSelectionCost(selection.selectionSet, multiplier);
    }
  }
  return cost;
}

export function costLimitRule(maxCost: number) {
  return (context: ValidationContext): ASTVisitor => ({
    Document: {
      enter(node) {
        for (const definition of node.definitions) {
          if (definition.kind !== Kind.OPERATION_DEFINITION) continue;

          // Exempt introspection-only queries
          const isIntrospectionOnly = definition.selectionSet.selections.every(
            (sel) => sel.kind === Kind.FIELD && INTROSPECTION_FIELDS.has(sel.name.value),
          );
          if (isIntrospectionOnly) continue;

          const cost = computeSelectionCost(definition.selectionSet, 1);

          // Warn at 50% threshold
          if (cost > maxCost * 0.5 && cost <= maxCost) {
            const opName = definition.name?.value ?? 'anonymous';
            logger.warn({ cost, maxCost, operationName: opName }, 'Query approaching complexity cost limit');
          }

          if (cost > maxCost) {
            context.reportError(
              new GraphQLError(
                `Query complexity cost (${cost}) exceeds maximum allowed (${maxCost}). Simplify your query by requesting fewer nested collections.`,
              ),
            );
          }
        }
      },
    },
  });
}
