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
  """List notifications for the current user, optionally filtering to unread only."""
  notifications(unreadOnly: Boolean, limit: Int): [Notification!]!
  """Get the count of unread notifications for the current user."""
  unreadNotificationCount: Int!
  notificationPreferences: [NotificationPreference!]!
`;

export const notificationMutationFields = /* GraphQL */ `
  markNotificationRead(notificationId: ID!): Notification!
  markAllNotificationsRead: Int!
  updateNotificationPreference(notificationType: String!, inApp: Boolean, email: Boolean): NotificationPreference!
`;
