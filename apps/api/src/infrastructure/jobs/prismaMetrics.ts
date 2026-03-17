import type { PrismaClient } from '@prisma/client';
import { prismaPoolActive, prismaPoolIdle, prismaPoolWait } from '../../utils/metrics.js';
import { createChildLogger } from '../../utils/logger.js';

const log = createChildLogger('prisma-metrics');

export function createHandler(prisma: PrismaClient) {
  return async () => {
    try {
      const metrics = await prisma.$metrics.json();
      for (const gauge of metrics.gauges) {
        if (gauge.key === 'prisma_pool_connections_busy') prismaPoolActive.set(gauge.value);
        else if (gauge.key === 'prisma_pool_connections_idle') prismaPoolIdle.set(gauge.value);
        else if (gauge.key === 'prisma_client_queries_wait') prismaPoolWait.set(gauge.value);
      }
    } catch (err) {
      log.error({ err }, 'Failed to collect Prisma pool metrics');
    }
  };
}
