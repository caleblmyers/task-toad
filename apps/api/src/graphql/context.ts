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
  res?: import('express').Response;
}

export async function buildContext(ctx: { request: Request; req?: import('http').IncomingMessage & { cookies?: Record<string, string> }; res?: import('express').Response }): Promise<Context> {
  const loaders = createLoaders(prisma);
  const res = ctx.res;

  // Read token from HttpOnly cookie first, fall back to Authorization header
  const cookieToken = ctx.req?.cookies?.['tt-access'] as string | undefined;
  const auth = ctx.request.headers.get('authorization');
  const token = cookieToken || (auth?.startsWith('Bearer ') ? auth.slice(7) : undefined);

  if (!token) {
    return { user: null, org: null, prisma, loaders, res };
  }
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub;
    if (!userId) return { user: null, org: null, prisma, loaders, res };

    const dbUser = await prisma.user.findUnique({ where: { userId } });
    if (!dbUser) return { user: null, org: null, prisma, loaders, res };

    // Reject tokens with stale tokenVersion (revoked via logout or password reset)
    const tv = payload.tv as number | undefined;
    if (tv !== undefined && tv !== dbUser.tokenVersion) {
      return { user: null, org: null, prisma, loaders, res };
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
      res,
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    log.warn({ code }, 'JWT verification failed');
    return { user: null, org: null, prisma, loaders, res };
  }
}
