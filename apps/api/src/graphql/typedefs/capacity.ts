export const capacityTypeDefs = /* GraphQL */ `
  type UserCapacity {
    userCapacityId: ID!
    userId: ID!
    userEmail: String!
    hoursPerWeek: Int!
    createdAt: String!
  }

  type UserTimeOff {
    userTimeOffId: ID!
    userId: ID!
    userEmail: String!
    startDate: String!
    endDate: String!
    description: String
    createdAt: String!
  }

  type TeamCapacitySummary {
    members: [MemberCapacity!]!
    totalHoursPerWeek: Int!
    availableHoursInRange: Float!
  }

  type MemberCapacity {
    userId: ID!
    userEmail: String!
    hoursPerWeek: Int!
    timeOff: [UserTimeOff!]!
    availableHours: Float!
  }
`;

export const capacityQueryFields = /* GraphQL */ `
  teamCapacity(projectId: ID!): [UserCapacity!]!
  teamCapacitySummary(projectId: ID!, startDate: String!, endDate: String!): TeamCapacitySummary!
  userTimeOffs(userId: ID): [UserTimeOff!]!
`;

export const capacityMutationFields = /* GraphQL */ `
  setUserCapacity(userId: ID!, hoursPerWeek: Int!): UserCapacity!
  addTimeOff(userId: ID!, startDate: String!, endDate: String!, description: String): UserTimeOff!
  removeTimeOff(userTimeOffId: ID!): Boolean!
`;
