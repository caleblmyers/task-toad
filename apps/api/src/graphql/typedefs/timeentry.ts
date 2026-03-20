export const timeEntryTypeDefs = /* GraphQL */ `
  type TimeEntry {
    timeEntryId: ID!
    taskId: ID!
    userId: ID!
    userEmail: String!
    durationMinutes: Int!
    description: String
    loggedDate: String!
    billable: Boolean!
    createdAt: String!
    updatedAt: String!
  }

  type TimeEntryConnection {
    entries: [TimeEntry!]!
    totalMinutes: Int!
  }

  type TaskTimeSummary {
    taskId: ID!
    totalMinutes: Int!
    estimatedHours: Float
    entries: [TimeEntry!]!
  }

  type UserTimeSummary {
    userId: ID!
    userEmail: String!
    totalMinutes: Int!
  }

  type SprintTimeSummary {
    sprintId: ID!
    totalMinutes: Int!
    byUser: [UserTimeSummary!]!
  }
`;

export const timeEntryQueryFields = /* GraphQL */ `
  """Get paginated time entries for a task."""
  timeEntries(taskId: ID!, limit: Int, cursor: String): TimeEntryConnection!
  """Get time summary for a task (total logged vs estimated)."""
  taskTimeSummary(taskId: ID!): TaskTimeSummary!
  """Get time summary for a sprint grouped by user."""
  sprintTimeSummary(sprintId: ID!): SprintTimeSummary!
`;

export const timeEntryMutationFields = /* GraphQL */ `
  """Log time against a task."""
  logTime(taskId: ID!, durationMinutes: Int!, loggedDate: String!, description: String, billable: Boolean): TimeEntry!
  """Update an existing time entry (own entries only)."""
  updateTimeEntry(timeEntryId: ID!, durationMinutes: Int, description: String, billable: Boolean): TimeEntry!
  """Delete a time entry (own entries only)."""
  deleteTimeEntry(timeEntryId: ID!): Boolean!
`;
