import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createYoga } from 'graphql-yoga';
import { schema } from './graphql/schema.js';
import { buildContext } from './graphql/context.js';

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

const yoga = createYoga({ schema, context: buildContext, graphqlEndpoint: '/graphql' });
// graphql-yoga's server adapter is compatible with Express but requires a type cast
app.use('/graphql', yoga as unknown as express.RequestHandler);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use(((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
}) as express.ErrorRequestHandler);

export default app;
