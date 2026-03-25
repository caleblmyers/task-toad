import crypto from 'crypto';
import type express from 'express';
import { SignJWT } from 'jose';
import type { PrismaClient } from '@prisma/client';
import { JWT_SECRET } from '../graphql/context.js';

const MAX_SESSIONS = Number(process.env.MAX_SESSIONS_PER_USER) || 5;
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TokenUser {
  userId: string;
  email: string;
  tokenVersion: number;
}

/**
 * Generate an access + refresh JWT pair for the given user.
 */
export async function generateTokenPair(user: TokenUser): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await new SignJWT({ sub: user.userId, email: user.email, tv: user.tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('15m')
    .sign(JWT_SECRET);

  const refreshToken = await new SignJWT({ sub: user.userId, type: 'refresh', tv: user.tokenVersion })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);

  return { accessToken, refreshToken };
}

/**
 * Set tt-access and tt-refresh HttpOnly cookies on the response.
 */
export function setAuthCookies(res: express.Response, tokens: { accessToken: string; refreshToken: string }): void {
  const secure = process.env.NODE_ENV === 'production';
  res.cookie('tt-access', tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
  res.cookie('tt-refresh', tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

/** Hash a JWT for storage in the refresh_tokens table. */
export function hashRefreshToken(jwt: string): string {
  return crypto.createHash('sha256').update(jwt).digest('hex');
}

/**
 * Store a refresh token record and prune oldest sessions if over the limit.
 */
export async function trackRefreshToken(
  prisma: PrismaClient,
  userId: string,
  refreshJwt: string,
  userAgent?: string,
): Promise<void> {
  const tokenHash = hashRefreshToken(refreshJwt);
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
      userAgent: userAgent ?? null,
    },
  });

  // Prune oldest sessions if over the limit
  const activeTokens = await prisma.refreshToken.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'asc' },
    select: { id: true },
  });
  if (activeTokens.length > MAX_SESSIONS) {
    const tokensToDelete = activeTokens.slice(0, activeTokens.length - MAX_SESSIONS);
    await prisma.refreshToken.deleteMany({
      where: { id: { in: tokensToDelete.map((t) => t.id) } },
    });
  }
}
