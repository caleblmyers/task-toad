import { generationMutations, generationQueries } from './generation.js';
import { analysisQueries, analysisMutations } from './analysis.js';
import { reportQueries } from './reports.js';
import { helperMutations } from './helpers.js';

export const aiMutations = {
  ...generationMutations,
  ...helperMutations,
  ...analysisMutations,
};

export const aiQueries = {
  ...analysisQueries,
  ...reportQueries,
  ...generationQueries,
};
