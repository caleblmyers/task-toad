/**
 * GitHub App authentication: JWT generation and installation token management.
 *
 * Uses the App's private key to sign JWTs, then exchanges them for
 * short-lived installation access tokens. Tokens are cached until 1 minute
 * before expiration.
 */

import { SignJWT, importPKCS8 } from 'jose';
import type { CachedToken } from './githubTypes.js';
import { logTokenRefresh, logApiError } from './githubLogger.js';

const TOKEN_CACHE = new Map<string, CachedToken>();
const EXPIRY_BUFFER_MS = 60_000; // refresh 1 min before expiry

function getAppId(): string {
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error('GITHUB_APP_ID environment variable is required');
  return appId;
}

function getPrivateKey(): string {
  const key = process.env.GITHUB_PRIVATE_KEY;
  if (!key) throw new Error('GITHUB_PRIVATE_KEY environment variable is required');
  // Support both literal PEM and base64-encoded PEM
  if (key.startsWith('-----BEGIN')) return key;
  return Buffer.from(key, 'base64').toString('utf8');
}

/**
 * Generate a JWT for the GitHub App. Valid for 10 minutes (GitHub maximum).
 */
export async function generateAppJWT(): Promise<string> {
  const appId = getAppId();
  const privateKeyPem = getPrivateKey();
  const privateKey = await importPKCS8(privateKeyPem, 'RS256');

  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt(now - 60) // allow 60s clock skew
    .setExpirationTime(now + 600) // 10 minutes
    .setIssuer(appId)
    .sign(privateKey);
}

/**
 * Get an installation access token, using cache when available.
 * GitHub installation tokens expire after 1 hour; we cache and
 * refresh 1 minute before expiry.
 */
export async function getInstallationToken(installationId: string): Promise<string> {
  const cached = TOKEN_CACHE.get(installationId);
  if (cached && cached.expiresAt > Date.now() + EXPIRY_BUFFER_MS) {
    return cached.token;
  }

  const jwt = await generateAppJWT();

  // Installation token creation requires REST (not available via GraphQL)
  const response = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    }
  );

  if (!response.ok) {
    const body = await response.text();
    logApiError('getInstallationToken', new Error(`HTTP ${response.status}: ${body}`), {
      installationId,
    });
    throw new Error(`Failed to get installation token: ${response.status}`);
  }

  const data = (await response.json()) as { token: string; expires_at: string };
  const expiresAt = new Date(data.expires_at).getTime();

  TOKEN_CACHE.set(installationId, { token: data.token, expiresAt });
  logTokenRefresh(installationId);

  return data.token;
}

/** Remove a cached token (e.g., on uninstall). */
export function clearInstallationToken(installationId: string): void {
  TOKEN_CACHE.delete(installationId);
}
