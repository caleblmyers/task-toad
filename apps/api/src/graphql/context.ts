import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import * as Sentry from '@sentry/node';
import { createChildLogger } from '../utils/logger.js';
import { createLoaders, type Loaders } from './loaders.js';

const log = createChildLogger('auth');

export const prisma = new PrismaClient();

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('JWT_SECRET environment variable is required in production');
    }
    return new TextEncoder().encode('dev-secret');
  }
  return new TextEncoder().encode(secret);
}

export const JWT_SECRET = getJwtSecret();

export interface Context {
  user: { userId: string; email: string; orgId: string | null; role: string | null; emailVerifiedAt: Date | null } | null;
  org: { orgId: string; name: string; anthropicApiKeyEncrypted: string | null; promptLoggingEnabled: boolean; monthlyBudgetCentsUSD: number | null; budgetAlertThreshold: number; createdAt: Date } | null;
  prisma: PrismaClient;
  loaders: Loaders;
  req?: import('http').IncomingMessage & { cookies?: Record<string, string> };
  res?: import('express').Response;
}

export async function buildContext(ctx: { request: Request; req?: import('http').IncomingMessage & { cookies?: Record<string, string> }; res?: import('express').Response }): Promise<Context> {
  const req = ctx.req;
  const res = ctx.res;

  // Read token from HttpOnly cookie first, fall back to Authorization header
  const cookieToken = ctx.req?.cookies?.['tt-access'] as string | undefined;
  const auth = ctx.request.headers.get('authorization');
  const token = cookieToken || (auth?.startsWith('Bearer ') ? auth.slice(7) : undefined);

  if (!token) {
    const loaders = createLoaders(prisma, null);
    return { user: null, org: null, prisma, loaders, req, res };
  }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub;
    if (!userId) {
      const loaders = createLoaders(prisma, null);
      return { user: null, org: null, prisma, loaders, req, res };
    }

    const dbUser = await prisma.user.findUnique({ where: { userId } });
    if (!dbUser) {
      const loaders = createLoaders(prisma, null);
      return { user: null, org: null, prisma, loaders, req, res };
    }

    // Reject tokens with stale tokenVersion (revoked via logout or password reset)
    const tv = payload.tv as number | undefined;
    if (tv !== undefined && tv !== dbUser.tokenVersion) {
      const loaders = createLoaders(prisma, null);
      return { user: null, org: null, prisma, loaders, req, res };
    }

    let org: Context['org'] = null;
    if (dbUser.orgId) {
      org = await prisma.org.findUnique({
        where: { orgId: dbUser.orgId },
        select: { orgId: true, name: true, anthropicApiKeyEncrypted: true, promptLoggingEnabled: true, monthlyBudgetCentsUSD: true, budgetAlertThreshold: true, createdAt: true },
      });
    }

    // Set Sentry user context for error attribution
    Sentry.setUser({ id: dbUser.userId, email: dbUser.email });

    // Create loaders scoped to the user's org for tenant isolation
    const loaders = createLoaders(prisma, dbUser.orgId);

    return {
      user: {
        userId: dbUser.userId,
        email: dbUser.email,
        orgId: dbUser.orgId,
        role: dbUser.role,
        emailVerifiedAt: dbUser.emailVerifiedAt,
      },
      org,
      prisma,
      loaders,
      req,
      res,
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    log.warn({ code }, 'JWT verification failed');
    const loaders = createLoaders(prisma, null);
    return { user: null, org: null, prisma, loaders, req, res };
  }
}
