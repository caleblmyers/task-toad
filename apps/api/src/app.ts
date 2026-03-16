import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createYoga } from 'graphql-yoga';
import { z } from 'zod';
import { schema } from './graphql/schema.js';
import { buildContext } from './graphql/context.js';
import { handleGitHubWebhook } from './github/index.js';
import { exportRouter } from './routes/export.js';
import { logger } from './utils/logger.js';
import { sseManager } from './utils/sseManager.js';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from './graphql/context.js';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const ssePrisma = new PrismaClient();

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

// GitHub webhook endpoint needs raw body for signature verification — must be before JSON parser
app.post('/api/github/webhooks', express.raw({ type: 'application/json' }), handleGitHubWebhook);

// Compress responses
app.use(compression());

// Body size limit
app.use(express.json({ limit: '1mb' }));

// SSE endpoint for real-time events
app.get('/api/events', async (req, res) => {
  const token = req.query.token as string;
  if (!token) { res.status(401).json({ error: 'No token' }); return; }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = await ssePrisma.user.findUnique({ where: { userId: payload.sub as string } });
    if (!user?.orgId) { res.status(401).json({ error: 'Unauthorized' }); return; }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    res.write('event: connected\ndata: {}\n\n');

    const clientId = crypto.randomUUID();
    sseManager.addClient(clientId, user.orgId, user.userId, res);

    // Heartbeat every 30s
    const heartbeat = setInterval(() => res.write(': heartbeat\n\n'), 30000);
    res.on('close', () => clearInterval(heartbeat));
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Export REST endpoints (file downloads — not suited for GraphQL)
app.use('/api/export', exportRouter);

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


const yoga = createYoga({ schema, context: buildContext, graphqlEndpoint: '/graphql' });
// graphql-yoga's server adapter is compatible with Express but requires a type cast
app.use('/graphql', yoga as unknown as express.RequestHandler);

// In production, serve the web frontend as static files
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.resolve(__dirname, '../../web/dist');
  app.use(express.static(webDist));
  // SPA fallback — serve index.html for non-API routes
  app.get('*', (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
} else {
  app.use((_req, res) => {
    res.status(404).json({ error: 'Not found' });
  });
}

app.use(((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error({ err }, 'Unhandled express error');
  res.status(500).json({ error: 'Internal server error' });
}) as express.ErrorRequestHandler);

export default app;
