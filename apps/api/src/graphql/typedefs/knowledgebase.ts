export const knowledgeBaseTypeDefs = /* GraphQL */ `
  type KnowledgeEntry {
    knowledgeEntryId: ID!
    projectId: ID
    title: String!
    content: String!
    source: String!
    category: String!
    createdAt: String!
    updatedAt: String!
  }
`;

export const knowledgeBaseQueryFields = /* GraphQL */ `
  """List knowledge entries for a project, or org-level entries if orgOnly is true."""
  knowledgeEntries(projectId: ID, orgOnly: Boolean): [KnowledgeEntry!]!
`;

export const knowledgeBaseMutationFields = /* GraphQL */ `
  """Create a knowledge entry for a project (or org-level if projectId omitted)."""
  createKnowledgeEntry(projectId: ID, title: String!, content: String!, source: String, category: String): KnowledgeEntry!
  """Update a knowledge entry."""
  updateKnowledgeEntry(knowledgeEntryId: ID!, title: String, content: String, category: String): KnowledgeEntry!
  """Delete a knowledge entry."""
  deleteKnowledgeEntry(knowledgeEntryId: ID!): Boolean!
`;
