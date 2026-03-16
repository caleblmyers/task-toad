import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import * as Sentry from '@sentry/node';
import { createChildLogger } from '../utils/logger.js';
import { createLoaders, type Loaders } from './loaders.js';

const log = createChildLogger('auth');

const prisma = new PrismaClient();

export const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret');

export interface Context {
  user: { userId: string; email: string; orgId: string | null; role: string | null; emailVerifiedAt: Date | null } | null;
  org: { orgId: string; name: string; anthropicApiKeyEncrypted: string | null } | null;
  prisma: PrismaClient;
  loaders: Loaders;
}

export async function buildContext(ctx: { request: Request }): Promise<Context> {
  const loaders = createLoaders(prisma);
  const auth = ctx.request.headers.get('authorization');

  if (!auth?.startsWith('Bearer ')) {
    return { user: null, org: null, prisma, loaders };
  }

  const token = auth.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub;
    if (!userId) return { user: null, org: null, prisma, loaders };

    const dbUser = await prisma.user.findUnique({ where: { userId } });
    if (!dbUser) return { user: null, org: null, prisma, loaders };

    let org: Context['org'] = null;
    if (dbUser.orgId) {
      org = await prisma.org.findUnique({
        where: { orgId: dbUser.orgId },
        select: { orgId: true, name: true, anthropicApiKeyEncrypted: true },
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
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    log.warn({ code }, 'JWT verification failed');
    return { user: null, org: null, prisma, loaders };
  }
}
