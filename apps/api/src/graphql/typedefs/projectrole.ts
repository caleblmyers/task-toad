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
  projectMembers(projectId: ID!): [ProjectMember!]!
  automationRules(projectId: ID!): [AutomationRule!]!
`;

export const projectRoleMutationFields = /* GraphQL */ `
  addProjectMember(projectId: ID!, userId: ID!, role: String): ProjectMember!
  removeProjectMember(projectId: ID!, userId: ID!): Boolean!
  updateProjectMemberRole(projectId: ID!, userId: ID!, role: String!): ProjectMember!
  createAutomationRule(projectId: ID!, name: String!, trigger: String!, action: String!): AutomationRule!
  updateAutomationRule(ruleId: ID!, name: String, trigger: String, action: String, enabled: Boolean): AutomationRule!
  deleteAutomationRule(ruleId: ID!): Boolean!
`;
