import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createYoga } from 'graphql-yoga';
import { z } from 'zod';
import { schema } from './graphql/schema.js';
import { buildContext } from './graphql/context.js';
import { handleGitHubWebhook } from './github/index.js';
import { logger } from './utils/logger.js';

// Validate required environment variables at startup
const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_SECRET: z.string().min(1, 'JWT_SECRET is required'),
  ENCRYPTION_MASTER_KEY: z.string().min(1, 'ENCRYPTION_MASTER_KEY is required'),
  PORT: z.string().default('3001'),
  NODE_ENV: z.string().default('development'),
  CORS_ORIGINS: z.string().optional(),
  GITHUB_APP_ID: z.string().optional(),
  GITHUB_PRIVATE_KEY: z.string().optional(),
  GITHUB_WEBHOOK_SECRET: z.string().optional(),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  const missing = envResult.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  logger.fatal({ issues: envResult.error.issues }, `Missing or invalid environment variables:\n${missing}\n\nCopy apps/api/.env.example to apps/api/.env and fill in the values.`);
  process.exit(1);
}

const app: express.Express = express();

// Security headers
app.use(helmet());

// CORS — allow the Vite dev server and any configured origin
const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173').split(',');
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true,
  })
);

// Body size limit
app.use(express.json({ limit: '1mb' }));

// Global rate limit: 200 requests per minute per IP
app.use(
  rateLimit({
    windowMs: 60_000,
    limit: 200,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  })
);

// Stricter rate limit for auth-related operations: 10 per minute per IP
const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { errors: [{ message: 'Too many attempts. Please try again later.' }] },
  // Only count requests containing signup/login mutations
  skip: (req) => {
    const body = req.body as { query?: string } | undefined;
    if (!body?.query) return true;
    return !/\b(signup|login)\s*\(/.test(body.query);
  },
});
app.use('/graphql', authLimiter);

// GitHub webhook endpoint — must be before the 404 handler
app.post('/api/github/webhooks', handleGitHubWebhook);

const yoga = createYoga({ schema, context: buildContext, graphqlEndpoint: '/graphql' });
// graphql-yoga's server adapter is compatible with Express but requires a type cast
app.use('/graphql', yoga as unknown as express.RequestHandler);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled express error');
  res.status(500).json({ error: 'Internal server error' });
}) as express.ErrorRequestHandler);

export default app;
