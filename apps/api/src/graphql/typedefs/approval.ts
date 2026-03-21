export const approvalTypeDefs = /* GraphQL */ `
  type Approval {
    approvalId: ID!
    taskId: ID!
    orgId: ID!
    requestedById: ID!
    approverId: ID
    fromStatus: String!
    toStatus: String!
    status: String!
    comment: String
    decidedAt: String
    createdAt: String!
    task: Task
    requestedBy: ApprovalUser
    approver: ApprovalUser
  }

  type ApprovalUser {
    userId: ID!
    email: String!
    displayName: String
  }
`;

export const approvalQueryFields = /* GraphQL */ `
  pendingApprovals(projectId: ID!): [Approval!]!
  taskApprovals(taskId: ID!): [Approval!]!
`;

export const approvalMutationFields = /* GraphQL */ `
  approveTransition(approvalId: ID!, comment: String): Approval!
  rejectTransition(approvalId: ID!, comment: String!): Approval!
`;
