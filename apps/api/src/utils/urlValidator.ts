import dns from 'node:dns';
import { ValidationError } from '../graphql/errors.js';

const BLOCKED_PORTS = new Set([5432, 6379, 27017, 3306, 9200, 11211, 2379, 8500]);

/**
 * Check if an IPv4 address falls within private/reserved ranges.
 */
function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) return true;
  const [a, b] = parts;
  // 127.0.0.0/8
  if (a === 127) return true;
  // 10.0.0.0/8
  if (a === 10) return true;
  // 172.16.0.0/12
  if (a === 172 && b >= 16 && b <= 31) return true;
  // 192.168.0.0/16
  if (a === 192 && b === 168) return true;
  // 169.254.0.0/16 (link-local)
  if (a === 169 && b === 254) return true;
  // 0.0.0.0/8
  if (a === 0) return true;
  return false;
}

/**
 * Check if an IPv6 address is private/reserved.
 */
function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true;
  // fc00::/7 — unique local addresses
  if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
  // fe80::/10 — link-local
  if (normalized.startsWith('fe80')) return true;
  return false;
}

const BLOCKED_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0']);

/**
 * Validate a webhook URL is safe to send requests to.
 * Rejects private IPs, non-HTTP protocols, and common internal service ports.
 * Resolves DNS to catch hostname-based SSRF bypasses.
 */
export async function validateWebhookUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ValidationError('Invalid URL format');
  }

  // Protocol check
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new ValidationError('Only http and https URLs are allowed');
  }

  // Hostname check
  if (BLOCKED_HOSTNAMES.has(parsed.hostname)) {
    throw new ValidationError('URL points to a blocked hostname');
  }

  // Port check (only for non-standard ports)
  if (parsed.port && BLOCKED_PORTS.has(Number(parsed.port))) {
    throw new ValidationError('URL uses a blocked port');
  }

  // DNS resolution check — resolve and verify all IPs are public
  try {
    const addresses = await dns.promises.resolve4(parsed.hostname);
    for (const ip of addresses) {
      if (isPrivateIPv4(ip)) {
        throw new ValidationError('URL resolves to a private IP address');
      }
    }
  } catch (err) {
    if (err instanceof ValidationError) throw err;
    // Try IPv6
    try {
      const addresses = await dns.promises.resolve6(parsed.hostname);
      for (const ip of addresses) {
        if (isPrivateIPv6(ip)) {
          throw new ValidationError('URL resolves to a private IP address');
        }
      }
    } catch (err6) {
      if (err6 instanceof ValidationError) throw err6;
      // If DNS fails entirely, it might be a raw IP — check it directly
      if (isPrivateIPv4(parsed.hostname) || isPrivateIPv6(parsed.hostname)) {
        throw new ValidationError('URL points to a private IP address');
      }
      // DNS resolution failed but hostname isn't a private IP — allow it
      // (the webhook delivery will fail naturally if the host doesn't exist)
    }
  }
}
