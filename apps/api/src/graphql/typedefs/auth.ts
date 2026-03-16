export const authTypeDefs = /* GraphQL */ `
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

  type AuthPayload {
    token: String!
  }
`;

export const authQueryFields = /* GraphQL */ `
  me: User
  orgInvites: [OrgInvite!]!
`;

export const authMutationFields = /* GraphQL */ `
  signup(email: String!, password: String!): Boolean!
  login(email: String!, password: String!): AuthPayload!

  sendVerificationEmail: Boolean!
  verifyEmail(token: String!): Boolean!

  requestPasswordReset(email: String!): Boolean!
  resetPassword(token: String!, newPassword: String!): Boolean!

  inviteOrgMember(email: String!, role: String): Boolean!
  acceptInvite(token: String!, password: String): AuthPayload!
  revokeInvite(inviteId: ID!): Boolean!
`;
