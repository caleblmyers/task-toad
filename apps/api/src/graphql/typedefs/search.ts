export const searchTypeDefs = /* GraphQL */ `
  type TaskSearchHit {
    task: Task!
    projectName: String!
  }

  type GlobalSearchResult {
    tasks: [TaskSearchHit!]!
    projects: [Project!]!
  }
`;

export const searchQueryFields = /* GraphQL */ `
  globalSearch(query: String!, limit: Int): GlobalSearchResult!
`;
