export const projectRoleTypeDefs = /* GraphQL */ `
  type ProjectMember {
    id: ID!
    userId: ID!
    email: String!
    role: String!
    createdAt: String!
  }

  type AutomationRule {
    id: ID!
    name: String!
    trigger: String!
    action: String!
    enabled: Boolean!
    createdAt: String!
  }
`;

export const projectRoleQueryFields = /* GraphQL */ `
  """List all members and their roles for a project."""
  projectMembers(projectId: ID!): [ProjectMember!]!
  """List automation rules configured for a project."""
  automationRules(projectId: ID!): [AutomationRule!]!
`;

export const projectRoleMutationFields = /* GraphQL */ `
  """Add a user as a member of a project with an optional role."""
  addProjectMember(projectId: ID!, userId: ID!, role: String): ProjectMember!
  """Remove a user from a project."""
  removeProjectMember(projectId: ID!, userId: ID!): Boolean!
  """Update a project member's role."""
  updateProjectMemberRole(projectId: ID!, userId: ID!, role: String!): ProjectMember!
  """Create a new automation rule for a project."""
  createAutomationRule(projectId: ID!, name: String!, trigger: String!, action: String!): AutomationRule!
  """Update an existing automation rule's properties."""
  updateAutomationRule(ruleId: ID!, name: String, trigger: String, action: String, enabled: Boolean): AutomationRule!
  """Delete an automation rule."""
  deleteAutomationRule(ruleId: ID!): Boolean!
`;
