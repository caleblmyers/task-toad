import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';

const prisma = new PrismaClient();

export const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? 'dev-secret');

export interface Context {
  user: { userId: string; email: string; orgId: string | null; role: string | null; emailVerifiedAt: Date | null } | null;
  org: { orgId: string; name: string; anthropicApiKeyEncrypted: string | null } | null;
  prisma: PrismaClient;
}

export async function buildContext(ctx: { request: Request }): Promise<Context> {
  const auth = ctx.request.headers.get('authorization');

  if (!auth?.startsWith('Bearer ')) {
    return { user: null, org: null, prisma };
  }

  const token = auth.slice(7);
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const userId = payload.sub;
    if (!userId) return { user: null, org: null, prisma };

    const dbUser = await prisma.user.findUnique({ where: { userId } });
    if (!dbUser) return { user: null, org: null, prisma };

    let org: Context['org'] = null;
    if (dbUser.orgId) {
      org = await prisma.org.findUnique({
        where: { orgId: dbUser.orgId },
        select: { orgId: true, name: true, anthropicApiKeyEncrypted: true },
      });
    }

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
    };
  } catch (err) {
    const code = err instanceof Error ? err.message : 'unknown';
    console.warn(`[auth] JWT verification failed: ${code}`);
    return { user: null, org: null, prisma };
  }
}
