import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createYoga } from 'graphql-yoga';
import { z } from 'zod';
import { schema, depthLimitRule } from './graphql/schema.js';
import { buildContext } from './graphql/context.js';
import { handleGitHubWebhook } from './github/index.js';
import { handleSlackCommand } from './slack/slackWebhookHandler.js';
import { exportRouter } from './routes/export.js';
import { docsRouter } from './routes/docs.js';
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

// Security headers with explicit CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
    },
  },
}));

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

// Slack slash command endpoint — URL-encoded form data from Slack
app.post('/api/slack/commands', express.urlencoded({ extended: false }), handleSlackCommand);

// Compress responses
app.use(compression());

// Body size limit
app.use(express.json({ limit: '1mb' }));

// SSE endpoint for real-time events — reads token from Authorization header
app.get('/api/events', async (req, res) => {
  const token = req.headers.authorization?.replace('Bearer ', '') ?? (req.query.token as string);
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

// Export rate limit: 5 requests per 10 minutes per IP
const exportLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many export requests. Please try again later.' },
});

// Export REST endpoints (file downloads — not suited for GraphQL)
app.use('/api/export', exportLimiter, exportRouter);

// API documentation
app.use('/api/docs', docsRouter);

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

// Tighter rate limit for password reset & email verification: 5 per minute per IP
const sensitiveAuthLimiter = rateLimit({
  windowMs: 60_000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { errors: [{ message: 'Too many attempts. Please try again later.' }] },
  skip: (req) => {
    const body = req.body as { query?: string } | undefined;
    if (!body?.query) return true;
    return !/\b(requestPasswordReset|sendVerificationEmail)\s*[({]/.test(body.query);
  },
});
app.use('/graphql', sensitiveAuthLimiter);


const yoga = createYoga({
  schema,
  context: buildContext,
  graphqlEndpoint: '/graphql',
  plugins: [
    { onValidate({ addValidationRule }: { addValidationRule: (rule: unknown) => void }) { addValidationRule(depthLimitRule(10)); } },
  ],
});
// graphql-yoga's server adapter is compatible with Express but requires a type cast
app.use('/graphql', yoga as unknown as express.RequestHandler);

// In production, serve the web frontend as static files
if (process.env.NODE_ENV === 'production') {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const webDist = path.resolve(__dirname, '../../web/dist');

  // Hashed assets (Vite fingerprints these) — cache immutably for 1 year
  app.use('/assets', express.static(path.join(webDist, 'assets'), {
    maxAge: '1y',
    immutable: true,
  }));

  // All other static files — always revalidate HTML to pick up new deployments
  app.use(express.static(webDist, {
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  }));

  // SPA fallback — serve index.html for non-API routes
  app.get('*', (_req, res) => {
    res.setHeader('Cache-Control', 'no-cache');
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
