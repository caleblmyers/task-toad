export const slackTypeDefs = /* GraphQL */ `
  type SlackIntegration {
    id: ID!
    teamId: String!
    teamName: String!
    channelId: String!
    channelName: String!
    events: [String!]!
    enabled: Boolean!
    createdAt: String!
  }

  type SlackUserMapping {
    id: ID!
    slackUserId: String!
    slackTeamId: String!
    userId: String!
    orgId: String!
    createdAt: String!
    user: User
  }
`;

export const slackQueryFields = /* GraphQL */ `
  """List all Slack integrations configured for the organization."""
  slackIntegrations: [SlackIntegration!]!
  """List Slack-to-TaskToad user mappings for a specific integration."""
  slackUserMappings(integrationId: ID!): [SlackUserMapping!]!
`;

export const slackMutationFields = /* GraphQL */ `
  """Connect a Slack workspace channel to receive event notifications."""
  connectSlack(webhookUrl: String!, teamId: String!, teamName: String!, channelId: String!, channelName: String!, events: [String!]!): SlackIntegration!
  """Update event subscriptions or enabled state of a Slack integration."""
  updateSlackIntegration(id: ID!, events: [String!], enabled: Boolean): SlackIntegration!
  """Disconnect and remove a Slack integration."""
  disconnectSlack(id: ID!): Boolean!
  """Send a test notification to verify a Slack integration is working."""
  testSlackIntegration(id: ID!): Boolean!
  """Map a Slack user to a TaskToad user for mention routing."""
  mapSlackUser(slackUserId: String!, slackTeamId: String!, userId: ID!): SlackUserMapping!
  """Remove a Slack-to-TaskToad user mapping."""
  unmapSlackUser(mappingId: ID!): Boolean!
`;
