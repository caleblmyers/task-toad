export const knowledgeBaseTypeDefs = /* GraphQL */ `
  type KnowledgeEntry {
    knowledgeEntryId: ID!
    projectId: ID!
    title: String!
    content: String!
    source: String!
    category: String!
    createdAt: String!
    updatedAt: String!
  }
`;

export const knowledgeBaseQueryFields = /* GraphQL */ `
  """List knowledge entries for a project."""
  knowledgeEntries(projectId: ID!): [KnowledgeEntry!]!
`;

export const knowledgeBaseMutationFields = /* GraphQL */ `
  """Create a knowledge entry for a project."""
  createKnowledgeEntry(projectId: ID!, title: String!, content: String!, source: String, category: String): KnowledgeEntry!
  """Update a knowledge entry."""
  updateKnowledgeEntry(knowledgeEntryId: ID!, title: String, content: String, category: String): KnowledgeEntry!
  """Delete a knowledge entry."""
  deleteKnowledgeEntry(knowledgeEntryId: ID!): Boolean!
`;
