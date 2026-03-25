import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import { createYoga } from 'graphql-yoga';
import { z } from 'zod';
import { NoSchemaIntrospectionCustomRule } from 'graphql';
import { schema, depthLimitRule, costLimitRule } from './graphql/schema.js';
import { buildContext } from './graphql/context.js';
import { handleGitHubWebhook } from './github/index.js';
import { handleSlackCommand } from './slack/slackWebhookHandler.js';
import { exportRouter } from './routes/export.js';
import { docsRouter } from './routes/docs.js';
import { uploadRouter } from './routes/upload.js';
import githubOAuthRouter from './routes/githubOAuth.js';
import { logger } from './utils/logger.js';
import { sseManager } from './utils/sseManager.js';
import { jwtVerify, SignJWT } from 'jose';
import { JWT_SECRET } from './graphql/context.js';
import crypto from 'crypto';
import { register, httpRequestDuration, httpRequestsTotal, graphqlResolverDuration } from './utils/metrics.js';
import { checkS3Health } from './utils/s3.js';
import { prisma as sharedPrisma } from './graphql/context.js';

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
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
});

const envResult = envSchema.safeParse(process.env);
if (!envResult.success) {
  const missing = envResult.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  logger.fatal({ issues: envResult.error.issues }, `Missing or invalid environment variables:\n${missing}\n\nCopy apps/api/.env.example to apps/api/.env and fill in the values.`);
  process.exit(1);
}

const app: express.Express = express();

// Trust first proxy hop (Railway LB) so req.ip returns real client IP for rate limiting
app.set('trust proxy', 1);

// Security headers with explicit CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      frameAncestors: ["'none'"],
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

// Parse cookies — must be before any handler that reads cookies
app.use(cookieParser());

// Health check — before rate limiting so monitoring isn't rate-limited
app.get('/api/health', async (_req, res) => {
  try {
    await sharedPrisma.$queryRaw`SELECT 1`;
    const s3Status = await checkS3Health();
    res.json({
      status: 'ok',
      db: 'ok',
      s3: s3Status,
      version: process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GIT_COMMIT_SHA || 'dev',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch {
    const s3Status = await checkS3Health().catch(() => 'unknown');
    res.status(503).json({
      status: 'error',
      db: 'unreachable',
      s3: s3Status,
    });
  }
});

// Prometheus metrics endpoint — before rate limiting so scraping isn't rate-limited
app.get('/api/metrics', async (_req, res) => {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
});

// Request logging + metrics middleware
app.use((req, res, next) => {
  const url = req.originalUrl ?? req.url;
  const requestId = crypto.randomUUID();
  const start = process.hrtime.bigint();
  req.headers['x-request-id'] = requestId;

  res.on('finish', () => {
    const durationNs = Number(process.hrtime.bigint() - start);
    const durationSec = durationNs / 1e9;

    // Extract GraphQL operation name for both metrics and logging
    let operationName: string | undefined;
    const isGraphQL = url === '/graphql' || url.startsWith('/graphql?');
    if (isGraphQL) {
      const body = req.body as { query?: string; operationName?: string } | undefined;
      operationName = body?.operationName
        ?? body?.query?.match(/(?:query|mutation|subscription)\s+(\w+)/)?.[1]
        ?? undefined;
    }

    // Record Prometheus metrics
    const route = isGraphQL ? `/graphql:${operationName ?? 'anonymous'}` : url;
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequestDuration.observe(labels, durationSec);
    httpRequestsTotal.inc(labels);

    // Skip request logging for health and metrics endpoints
    if (url === '/api/health' || url === '/api/metrics') return;

    const logData: Record<string, unknown> = {
      requestId,
      method: req.method,
      url,
      statusCode: res.statusCode,
      responseTime: Math.round(durationNs / 1e4) / 100, // ms with 2 decimal places
      contentLength: res.getHeader('content-length'),
    };
    if (operationName) logData.operationName = operationName;

    if (res.statusCode >= 500) {
      logger.error(logData, 'request completed');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'request completed');
    } else {
      logger.info(logData, 'request completed');
    }
  });
  next();
});

// GitHub webhook endpoint needs raw body for signature verification — must be before JSON parser
app.post('/api/github/webhooks', express.raw({ type: 'application/json' }), handleGitHubWebhook);

// Slack slash command endpoint — URL-encoded form data from Slack
app.post('/api/slack/commands', express.urlencoded({ extended: false }), handleSlackCommand);

// Compress responses
app.use(compression());

// Body size limit
app.use(express.json({ limit: '1mb' }));

// L-11: Strip null bytes from REST request bodies and query params
app.use((req, _res, next) => {
  if (req.body) req.body = stripNullBytes(req.body);
  if (req.query) req.query = stripNullBytes(req.query) as typeof req.query;
  next();
});

// Refresh token endpoint — rotates access + refresh tokens using refresh cookie
// Mounted at both paths: /api/auth/refresh (production) and /auth/refresh (dev via Vite proxy which strips /api)
const refreshHandler: import('express').RequestHandler = async (req, res) => {
  const refreshToken = req.cookies?.['tt-refresh'];
  if (!refreshToken) { res.status(401).json({ error: 'No refresh token' }); return; }
  try {
    const { payload } = await jwtVerify(refreshToken, JWT_SECRET);
    if (payload.type !== 'refresh') { res.status(401).json({ error: 'Invalid token type' }); return; }
    const userId = payload.sub as string;
    const user = await sharedPrisma.user.findUnique({ where: { userId } });
    if (!user) { res.status(401).json({ error: 'User not found' }); return; }
    // Check tokenVersion matches to detect revoked tokens
    const tv = payload.tv as number | undefined;
    const dbTokenVersion = user.tokenVersion ?? 0;
    if (tv !== undefined && tv !== dbTokenVersion) {
      res.clearCookie('tt-access', { path: '/' });
      res.clearCookie('tt-refresh', { path: '/' });
      res.status(401).json({ error: 'Token revoked' });
      return;
    }
    // Validate refresh token exists in DB (session not pruned or logged out)
    const oldTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const existingRecord = await sharedPrisma.refreshToken.findUnique({ where: { tokenHash: oldTokenHash } });
    if (!existingRecord) {
      res.clearCookie('tt-access', { path: '/' });
      res.clearCookie('tt-refresh', { path: '/' });
      res.status(401).json({ error: 'Session expired or revoked' });
      return;
    }
    // Issue new access token
    const accessToken = await new SignJWT({ sub: user.userId, email: user.email, tv: user.tokenVersion })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('15m')
      .sign(JWT_SECRET);
    // Token rotation: issue new refresh token, delete old record, create new record
    const newRefreshToken = await new SignJWT({ sub: user.userId, type: 'refresh', tv: user.tokenVersion })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('7d')
      .sign(JWT_SECRET);
    const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
    await sharedPrisma.refreshToken.delete({ where: { id: existingRecord.id } });
    await sharedPrisma.refreshToken.create({
      data: {
        userId: user.userId,
        tokenHash: newTokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        userAgent: req.headers['user-agent'] ?? null,
      },
    });
    res.cookie('tt-access', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000,
      path: '/',
    });
    res.cookie('tt-refresh', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000,
      path: '/',
    });
    res.json({ ok: true });
  } catch {
    res.clearCookie('tt-access', { path: '/' });
    res.clearCookie('tt-refresh', { path: '/' });
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};
app.post('/api/auth/refresh', refreshHandler);
app.post('/auth/refresh', refreshHandler);


// SSE endpoint for real-time events — reads token from cookie with Authorization fallback
app.get(['/events', '/api/events'], async (req, res) => {
  const token = req.cookies?.['tt-access'] || req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'No token' }); return; }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = await sharedPrisma.user.findUnique({ where: { userId: payload.sub as string } });
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
// In test environment, use a high limit to avoid 429s from integration test suites
// that make multiple export requests in quick succession.
const exportLimiter = rateLimit({
  windowMs: 10 * 60_000,
  limit: process.env.NODE_ENV === 'test' ? 1000 : 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many export requests. Please try again later.' },
});

// Export REST endpoints (file downloads — not suited for GraphQL)
app.use(githubOAuthRouter);
app.use('/api/export', exportLimiter, exportRouter);

// File uploads (multipart — before JSON body parser would conflict, but self-contained via multer)
app.use('/api/uploads', uploadRouter);

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


// Expected user error codes that should NOT be reported to Sentry
const EXPECTED_ERROR_CODES = new Set([
  'ERR_NOT_FOUND',
  'ERR_VALIDATION',
  'ERR_AUTH',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'BAD_USER_INPUT',
]);

/** Recursively strip null bytes (\0) from all string values in an object. */
function stripNullBytes(obj: unknown): unknown {
  if (typeof obj === 'string') return obj.replace(/\0/g, '');
  if (Array.isArray(obj)) return obj.map(stripNullBytes);
  if (obj !== null && typeof obj === 'object') {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      cleaned[k] = stripNullBytes(v);
    }
    return cleaned;
  }
  return obj;
}

const isProduction = process.env.NODE_ENV === 'production';

const yoga = createYoga({
  schema,
  context: buildContext,
  graphqlEndpoint: '/graphql',
  graphiql: !isProduction,
  maskedErrors: {
    isDev: !isProduction,
  },
  plugins: [
    {
      onParams({ params, setParams }: { params: { query?: string; variables?: Record<string, unknown> }; setParams: (p: typeof params) => void }) {
        const updates: Partial<typeof params> = {};
        if (params.query && params.query.includes('\0')) {
          updates.query = params.query.replace(/\0/g, '');
        }
        if (params.variables) {
          updates.variables = stripNullBytes(params.variables) as Record<string, unknown>;
        }
        if (Object.keys(updates).length > 0) {
          setParams({ ...params, ...updates });
        }
      },
    },
    { onValidate({ addValidationRule }: { addValidationRule: (rule: unknown) => void }) {
      addValidationRule(depthLimitRule(7));
      addValidationRule(costLimitRule(Number(process.env.MAX_QUERY_COST) || 100000));
      if (isProduction) {
        addValidationRule(NoSchemaIntrospectionCustomRule);
      }
    } },
    {
      onExecute() {
        const start = process.hrtime.bigint();
        return {
          onExecuteDone({ args }: { args: { operationName?: string | null; document: { definitions: ReadonlyArray<{ kind: string; name?: { value: string } }> } } }) {
            const durationSec = Number(process.hrtime.bigint() - start) / 1e9;
            const operationName =
              args.operationName ??
              (args.document.definitions.find(
                (d) => d.kind === 'OperationDefinition' && d.name?.value,
              ) as { name?: { value: string } } | undefined)?.name?.value ??
              'anonymous';
            graphqlResolverDuration.observe({ resolver_name: operationName }, durationSec);
          },
        };
      },
    },
    {
      onResultProcess({ result }: { result: { errors?: ReadonlyArray<{ message: string; extensions?: Record<string, unknown> }> } }) {
        if (!result.errors) return;
        for (const err of result.errors) {
          const code = err.extensions?.['code'] as string | undefined;
          if (code && EXPECTED_ERROR_CODES.has(code)) continue;
          Sentry.captureException(err instanceof Error ? err : new Error(err.message), {
            tags: { source: 'graphql' },
            extra: { extensions: err.extensions },
          });
        }
      },
    },
  ],
});
// CSRF protection: POST /graphql must include X-Requested-With header
app.use('/graphql', (req, res, next) => {
  if (req.method === 'POST' && !req.headers['x-requested-with']) {
    res.status(403).json({ errors: [{ message: 'Missing X-Requested-With header' }] });
    return;
  }
  next();
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
  Sentry.captureException(err);
  logger.error({ err }, 'Unhandled express error');
  res.status(500).json({ error: 'Internal server error' });
}) as express.ErrorRequestHandler);

export default app;
