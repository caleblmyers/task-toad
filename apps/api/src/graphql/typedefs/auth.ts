export const authTypeDefs = /* GraphQL */ `
  type User {
    userId: ID!
    email: String!
    orgId: ID
    role: String
    emailVerifiedAt: String
    displayName: String
    avatarUrl: String
    timezone: String
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

  type VerifyEmailResult {
    success: Boolean!
    token: String
  }
`;

export const authQueryFields = /* GraphQL */ `
  """Return the currently authenticated user, or null if not logged in."""
  me: User
  """List pending organization invites sent by the current user's org."""
  orgInvites: [OrgInvite!]!
  """Return the current user's permissions for a specific project."""
  myPermissions(projectId: ID!): [String!]!
`;

export const authMutationFields = /* GraphQL */ `
  """Register a new account. Sends a verification email."""
  signup(email: String!, password: String!): Boolean!
  """Authenticate with email and password. Returns a JWT valid for 7 days."""
  login(email: String!, password: String!): AuthPayload!
  """Invalidate all existing sessions by incrementing the token version."""
  logout: Boolean!

  sendVerificationEmail: Boolean!
  verifyEmail(token: String!): VerifyEmailResult!

  requestPasswordReset(email: String!): Boolean!
  resetPassword(token: String!, newPassword: String!): Boolean!

  updateProfile(displayName: String, avatarUrl: String, timezone: String): User!

  inviteOrgMember(email: String!, role: String): Boolean!
  acceptInvite(token: String!, password: String): AuthPayload!
  revokeInvite(inviteId: ID!): Boolean!
`;
