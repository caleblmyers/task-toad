import type { Request, Response, NextFunction } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { TenantContext } from '@task-toad/shared';
import { orgRoleSchema } from '@task-toad/shared';

const COGNITO_REGION = process.env.COGNITO_REGION ?? 'us-east-1';
const COGNITO_USER_POOL_ID = process.env.COGNITO_USER_POOL_ID ?? '';

const JWKS_URL = `https://cognito-idp.${COGNITO_REGION}.amazonaws.com/${COGNITO_USER_POOL_ID}/.well-known/jwks.json`;

const jwks = COGNITO_USER_POOL_ID
  ? createRemoteJWKSet(new URL(JWKS_URL))
  : null;

export interface AuthenticatedRequest extends Request {
  tenant?: TenantContext;
  userEmail?: string;
}

export async function authMiddleware(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }
  const token = auth.slice(7);
  if (!jwks) {
    res.status(503).json({ error: 'Auth not configured (missing Cognito)' });
    return;
  }
  try {
    const { payload } = await jwtVerify(token, jwks);
    const sub = payload.sub as string;
    const orgId = (payload['custom:org_id'] as string) ?? null;
    const roleRaw = (payload['custom:role'] as string) ?? null;
    const role = roleRaw ? orgRoleSchema.safeParse(roleRaw).data ?? null : null;
    if (!sub) {
      res.status(401).json({ error: 'Invalid token: missing sub' });
      return;
    }
    req.tenant = {
      userId: sub,
      orgId: orgId ?? '',
      role: role ?? 'org:member',
    };
    req.userEmail = (payload.email as string) ?? '';
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/** Require tenant to have an org (used for org-scoped routes). */
export function requireOrg(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.tenant?.orgId) {
    res.status(403).json({ error: 'No organization; create one first' });
    return;
  }
  next();
}

/** Require org:admin role. */
export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (req.tenant?.role !== 'org:admin') {
    res.status(403).json({ error: 'Admin role required' });
    return;
  }
  next();
}
