export const projectRoleTypeDefs = /* GraphQL */ `
  type ProjectMember {
    id: ID!
    userId: ID!
    email: String!
    role: String!
    createdAt: String!
  }

  """
  An automation rule that fires actions when trigger conditions are met.

  The \`trigger\` field is a JSON string: \`{"event": "<event_type>", "condition": ...}\`
  Conditions can be simple \`{"status": "done"}\` or compound:
  \`{"operator": "AND"|"OR", "conditions": [{"field": "status", "op": "eq"|"not_eq", "value": "done"}, ...]}\`

  The \`action\` field is a JSON string — either a single action object or an array of actions.
  Supported action types:
  - notify_assignee: Notify the task assignee
  - move_to_column: Move task to sprint column (params: column)
  - set_status: Set task status (params: status)
  - assign_to: Assign task to user (params: userId)
  - send_webhook: POST task data to URL (params: url)
  - add_label: Add a label to the task (params: labelId)
  - add_comment: Add a comment to the task (params: content)
  - set_due_date: Set due date relative to now (params: daysFromNow)
  """
  type AutomationRule {
    id: ID!
    name: String!
    trigger: String!
    action: String!
    enabled: Boolean!
    createdAt: String!
  }
`;

export const projectRoleQueryFields = /* GraphQL */ `
  """List all members and their roles for a project."""
  projectMembers(projectId: ID!): [ProjectMember!]!
  """List automation rules configured for a project."""
  automationRules(projectId: ID!): [AutomationRule!]!
`;

export const projectRoleMutationFields = /* GraphQL */ `
  """Add a user as a member of a project with an optional role."""
  addProjectMember(projectId: ID!, userId: ID!, role: String): ProjectMember!
  """Remove a user from a project."""
  removeProjectMember(projectId: ID!, userId: ID!): Boolean!
  """Update a project member's role."""
  updateProjectMemberRole(projectId: ID!, userId: ID!, role: String!): ProjectMember!
  """Create a new automation rule for a project."""
  createAutomationRule(projectId: ID!, name: String!, trigger: String!, action: String!): AutomationRule!
  """Update an existing automation rule's properties."""
  updateAutomationRule(ruleId: ID!, name: String, trigger: String, action: String, enabled: Boolean): AutomationRule!
  """Delete an automation rule."""
  deleteAutomationRule(ruleId: ID!): Boolean!
`;
