/**
 * GitHub OAuth user-to-server flow.
 *
 * GET /api/auth/github        — Redirect to GitHub authorization page
 * GET /api/auth/github/callback — Exchange code for token, store encrypted, close popup
 */

import { Router } from 'express';
import { jwtVerify } from 'jose';
import { prisma, JWT_SECRET } from '../graphql/context.js';
import { encryptApiKey } from '../utils/encryption.js';
import { logger } from '../utils/logger.js';

const router: import('express').Router = Router();
const log = logger.child({ module: 'github-oauth' });

function getClientId(): string {
  const id = process.env.GITHUB_CLIENT_ID;
  if (!id) throw new Error('GITHUB_CLIENT_ID is required for GitHub OAuth');
  return id;
}

function getClientSecret(): string {
  const secret = process.env.GITHUB_CLIENT_SECRET;
  if (!secret) throw new Error('GITHUB_CLIENT_SECRET is required for GitHub OAuth');
  return secret;
}

/**
 * Redirect to GitHub OAuth authorization page.
 * Passes the user's JWT as state so we can identify them on callback.
 */
router.get('/api/auth/github', (req, res) => {
  const token = req.cookies?.['tt-access'] ?? req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Must be logged in to connect GitHub' });
    return;
  }

  const params = new URLSearchParams({
    client_id: getClientId(),
    scope: 'repo',
    state: token,
    allow_signup: 'false',
  });

  res.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
});

/**
 * GitHub OAuth callback. Exchange code for token, store it, and close the popup.
 */
router.get('/api/auth/github/callback', async (req, res) => {
  const { code, state } = req.query;

  if (!code || !state || typeof code !== 'string' || typeof state !== 'string') {
    res.status(400).send('Missing code or state parameter');
    return;
  }

  // Verify the JWT from state to identify the user
  let userId: string;
  try {
    const { payload } = await jwtVerify(state, JWT_SECRET);
    userId = payload.sub as string;
    if (!userId) throw new Error('No sub in token');
  } catch {
    res.status(401).send('Invalid or expired session. Please log in again and retry.');
    return;
  }

  // Exchange code for access token
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: getClientId(),
        client_secret: getClientSecret(),
        code,
      }),
    });

    const tokenData = (await tokenResponse.json()) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    };

    if (tokenData.error || !tokenData.access_token) {
      log.error({ error: tokenData.error, description: tokenData.error_description }, 'GitHub OAuth token exchange failed');
      res.status(400).send(`GitHub OAuth failed: ${tokenData.error_description ?? tokenData.error}`);
      return;
    }

    // Fetch GitHub user info
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const githubUser = (await userResponse.json()) as { login: string };

    // Store encrypted token and GitHub login on user
    await prisma.user.update({
      where: { userId },
      data: {
        githubLogin: githubUser.login,
        githubTokenEncrypted: encryptApiKey(tokenData.access_token),
      },
    });

    log.info({ userId, githubLogin: githubUser.login }, 'GitHub account connected');

    // Redirect to a frontend page that handles the popup close.
    // We can't rely on window.opener here — browsers strip it after cross-origin
    // navigation through github.com. Instead, redirect to a frontend route that
    // uses postMessage + window.close(), or falls back to localStorage event.
    const frontendOrigin = process.env.CORS_ORIGINS?.split(',')[0] ?? '';
    const redirectUrl = `${frontendOrigin}/github-callback?login=${encodeURIComponent(githubUser.login)}`;
    res.redirect(redirectUrl);
  } catch (err) {
    log.error({ error: err instanceof Error ? err.message : err }, 'GitHub OAuth callback error');
    res.status(500).send('Failed to connect GitHub account. Please try again.');
  }
});

export default router;
