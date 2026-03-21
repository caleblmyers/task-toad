export const fieldPermissionTypeDefs = /* GraphQL */ `
  type FieldPermission {
    id: ID!
    projectId: ID!
    fieldName: String!
    allowedRoles: [String!]!
    createdAt: String!
  }
`;

export const fieldPermissionQueryFields = /* GraphQL */ `
  """List field-level edit restrictions for a project."""
  fieldPermissions(projectId: ID!): [FieldPermission!]!
`;

export const fieldPermissionMutationFields = /* GraphQL */ `
  """Set which roles can edit a specific task field in a project."""
  setFieldPermission(projectId: ID!, fieldName: String!, allowedRoles: [String!]!): FieldPermission!
  """Remove a field-level edit restriction."""
  deleteFieldPermission(projectId: ID!, fieldName: String!): Boolean!
`;
