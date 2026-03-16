import { prisma } from '../graphql/context.js';

// Re-export the singleton PrismaClient for use in REST routes.
export function getPrisma() {
  return prisma;
}
