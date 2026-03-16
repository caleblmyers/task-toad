import { randomBytes, createHash } from 'crypto';

export function generateToken(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a token with SHA-256 for safe storage in the database.
 * The raw token is sent to the user (via email); only the hash is stored.
 */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
