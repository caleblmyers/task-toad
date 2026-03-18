// Re-export shared types for cross-package type consistency (API ↔ Web).
// These match the GraphQL response shapes consumed by the web client.
export type { Task as SharedTask } from '@tasktoad/shared-types';

// Barrel re-export — task resolvers have been decomposed into
// resolvers/task/ (queries, mutations, fields).
export { taskQueries, taskMutations, taskFieldResolvers } from './task/index.js';
