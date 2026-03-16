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

  type NotificationPreference {
    id: ID!
    notificationType: String!
    inApp: Boolean!
    email: Boolean!
  }
`;

export const notificationQueryFields = /* GraphQL */ `
  notifications(unreadOnly: Boolean, limit: Int): [Notification!]!
  unreadNotificationCount: Int!
  notificationPreferences: [NotificationPreference!]!
`;

export const notificationMutationFields = /* GraphQL */ `
  markNotificationRead(notificationId: ID!): Notification!
  markAllNotificationsRead: Boolean!
  updateNotificationPreference(notificationType: String!, inApp: Boolean, email: Boolean): NotificationPreference!
`;
