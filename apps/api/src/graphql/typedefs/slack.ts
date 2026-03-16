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
`;

export const slackQueryFields = /* GraphQL */ `
  slackIntegrations: [SlackIntegration!]!
`;

export const slackMutationFields = /* GraphQL */ `
  connectSlack(webhookUrl: String!, teamId: String!, teamName: String!, channelId: String!, channelName: String!, events: [String!]!): SlackIntegration!
  updateSlackIntegration(id: ID!, events: [String!], enabled: Boolean): SlackIntegration!
  disconnectSlack(id: ID!): Boolean!
  testSlackIntegration(id: ID!): Boolean!
`;
