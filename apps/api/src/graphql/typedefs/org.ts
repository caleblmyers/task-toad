export const orgTypeDefs = /* GraphQL */ `
  type Org {
    orgId: ID!
    name: String!
    createdAt: String!
    hasApiKey: Boolean!
    apiKeyHint: String
    monthlyBudgetCentsUSD: Int
    budgetAlertThreshold: Int!
    budgetEnforcement: String!
    promptLoggingEnabled: Boolean!
  }

  type OrgUser {
    userId: ID!
    email:  String!
    role:   String
  }
`;

export const orgQueryFields = /* GraphQL */ `
  org: Org
  orgUsers: [OrgUser!]!
`;

export const orgMutationFields = /* GraphQL */ `
  createOrg(name: String!, apiKey: String): Org!
  setOrgApiKey(apiKey: String!): Org!
  setAIBudget(monthlyBudgetCentsUSD: Int, alertThreshold: Int, budgetEnforcement: String, promptLoggingEnabled: Boolean): Org!
`;
