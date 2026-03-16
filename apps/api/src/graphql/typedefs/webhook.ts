export const webhookTypeDefs = /* GraphQL */ `
  type WebhookEndpoint {
    id: ID!
    url: String!
    events: String!
    enabled: Boolean!
    description: String
    lastError: String
    lastFiredAt: String
    createdAt: String!
  }
`;

export const webhookQueryFields = /* GraphQL */ `
  webhookEndpoints: [WebhookEndpoint!]!
`;

export const webhookMutationFields = /* GraphQL */ `
  createWebhookEndpoint(url: String!, events: [String!]!, description: String): WebhookEndpoint!
  updateWebhookEndpoint(id: ID!, url: String, events: [String!], enabled: Boolean, description: String): WebhookEndpoint!
  deleteWebhookEndpoint(id: ID!): Boolean!
  testWebhookEndpoint(id: ID!): Boolean!
`;
