import promClient from 'prom-client';

const register = promClient.Registry ? new promClient.Registry() : promClient.register;

// Collect default Node.js metrics (memory, CPU, event loop)
promClient.collectDefaultMetrics({ register });

export const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
  registers: [register],
});

export const httpRequestsTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code'] as const,
  registers: [register],
});

export const graphqlResolverDuration = new promClient.Histogram({
  name: 'graphql_resolver_duration_seconds',
  help: 'Duration of GraphQL resolver execution in seconds',
  labelNames: ['resolver_name'] as const,
  registers: [register],
});

export const prismaPoolActive = new promClient.Gauge({
  name: 'prisma_pool_active_connections',
  help: 'Number of active Prisma pool connections',
  registers: [register],
});

export const prismaPoolIdle = new promClient.Gauge({
  name: 'prisma_pool_idle_connections',
  help: 'Number of idle Prisma pool connections',
  registers: [register],
});

export const prismaPoolWait = new promClient.Gauge({
  name: 'prisma_pool_wait_count',
  help: 'Number of requests waiting for a Prisma pool connection',
  registers: [register],
});

export const appUptime = new promClient.Gauge({
  name: 'app_uptime_seconds',
  help: 'Application uptime in seconds',
  registers: [register],
  collect() {
    this.set(process.uptime());
  },
});

export { register };
