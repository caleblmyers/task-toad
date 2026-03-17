export const commentTypeDefs = /* GraphQL */ `
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

  type ActivityConnection {
    activities: [Activity!]!
    hasMore: Boolean!
    nextCursor: String
  }
`;

export const commentQueryFields = /* GraphQL */ `
  """List comments on a task, with nested replies."""
  comments(taskId: ID!): [Comment!]!
  """List activity log entries for a project or task."""
  activities(projectId: ID, taskId: ID, limit: Int, cursor: String): ActivityConnection!
`;

export const commentMutationFields = /* GraphQL */ `
  """Add a comment to a task. Optionally nest under a parent comment."""
  createComment(taskId: ID!, content: String!, parentCommentId: ID): Comment!
  updateComment(commentId: ID!, content: String!): Comment!
  deleteComment(commentId: ID!): Boolean!
`;
