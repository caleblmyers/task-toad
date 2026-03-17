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
    deadLetterAt: String
  }
`;

export const webhookQueryFields = /* GraphQL */ `
  """List all webhook endpoints configured for the organization."""
  webhookEndpoints: [WebhookEndpoint!]!
  """List recent delivery attempts for a specific webhook endpoint."""
  webhookDeliveries(endpointId: ID!, limit: Int): [WebhookDelivery!]!
  """List failed deliveries in the dead letter queue for a specific endpoint."""
  deadLetterDeliveries(endpointId: ID!): [WebhookDelivery!]!
`;

export const webhookMutationFields = /* GraphQL */ `
  """Register a new webhook endpoint to receive event notifications."""
  createWebhookEndpoint(url: String!, events: [String!]!, description: String): WebhookEndpoint!
  """Update a webhook endpoint's URL, events, enabled state, or description."""
  updateWebhookEndpoint(id: ID!, url: String, events: [String!], enabled: Boolean, description: String): WebhookEndpoint!
  """Delete a webhook endpoint and all its delivery history."""
  deleteWebhookEndpoint(id: ID!): Boolean!
  """Send a test event to verify a webhook endpoint is reachable."""
  testWebhookEndpoint(id: ID!): Boolean!
  """Replay a failed webhook delivery attempt."""
  replayWebhookDelivery(deliveryId: ID!): WebhookDelivery!
`;
