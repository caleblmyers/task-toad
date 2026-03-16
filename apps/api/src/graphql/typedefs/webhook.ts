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

  type WebhookDelivery {
    id: ID!
    endpointId: ID!
    event: String!
    status: String!
    statusCode: Int
    attemptCount: Int!
    nextRetryAt: String
    createdAt: String!
    completedAt: String
  }
`;

export const webhookQueryFields = /* GraphQL */ `
  webhookEndpoints: [WebhookEndpoint!]!
  webhookDeliveries(endpointId: ID!, limit: Int): [WebhookDelivery!]!
`;

export const webhookMutationFields = /* GraphQL */ `
  createWebhookEndpoint(url: String!, events: [String!]!, description: String): WebhookEndpoint!
  updateWebhookEndpoint(id: ID!, url: String, events: [String!], enabled: Boolean, description: String): WebhookEndpoint!
  deleteWebhookEndpoint(id: ID!): Boolean!
  testWebhookEndpoint(id: ID!): Boolean!
  replayWebhookDelivery(deliveryId: ID!): WebhookDelivery!
`;
