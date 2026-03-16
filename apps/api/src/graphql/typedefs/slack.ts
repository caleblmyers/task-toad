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
  slackIntegrations: [SlackIntegration!]!
  slackUserMappings(integrationId: ID!): [SlackUserMapping!]!
`;

export const slackMutationFields = /* GraphQL */ `
  connectSlack(webhookUrl: String!, teamId: String!, teamName: String!, channelId: String!, channelName: String!, events: [String!]!): SlackIntegration!
  updateSlackIntegration(id: ID!, events: [String!], enabled: Boolean): SlackIntegration!
  disconnectSlack(id: ID!): Boolean!
  testSlackIntegration(id: ID!): Boolean!
  mapSlackUser(slackUserId: String!, slackTeamId: String!, userId: ID!): SlackUserMapping!
  unmapSlackUser(mappingId: ID!): Boolean!
`;
