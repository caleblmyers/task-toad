import { generationMutations } from './generation.js';
import { analysisQueries } from './analysis.js';
import { reportQueries } from './reports.js';
import { helperMutations } from './helpers.js';

export const aiMutations = {
  ...generationMutations,
  ...helperMutations,
};

export const aiQueries = {
  ...analysisQueries,
  ...reportQueries,
};
