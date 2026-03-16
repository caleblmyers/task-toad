export const notificationTypeDefs = /* GraphQL */ `
  type Notification {
    notificationId: ID!
    type: String!
    title: String!
    body: String
    linkUrl: String
    isRead: Boolean!
    createdAt: String!
  }
`;

export const notificationQueryFields = /* GraphQL */ `
  notifications(unreadOnly: Boolean, limit: Int): [Notification!]!
  unreadNotificationCount: Int!
`;

export const notificationMutationFields = /* GraphQL */ `
  markNotificationRead(notificationId: ID!): Notification!
  markAllNotificationsRead: Boolean!
`;
