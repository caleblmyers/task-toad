import { createHash } from 'node:crypto';

// ---------------------------------------------------------------------------
// In-memory LRU cache for AI responses
// ---------------------------------------------------------------------------

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

export class LRUCache<T> {
  private cache = new Map<string, CacheEntry<T>>();

  constructor(
    private maxSize: number,
    private defaultTTLMs: number
  ) {}

  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: string, value: T, ttlMs?: number): void {
    // Delete first so re-insertion moves to end
    this.cache.delete(key);
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + (ttlMs ?? this.defaultTTLMs),
    });
  }

  clear(): void {
    this.cache.clear();
  }
}

/** Hash system + user prompt into a cache key. */
export function hashPrompt(systemPrompt: string, userPrompt: string): string {
  return createHash('sha256')
    .update(systemPrompt)
    .update('\0')
    .update(userPrompt)
    .digest('hex')
    .slice(0, 16); // 16 hex chars = 64 bits, sufficient for cache keys
}

/** Singleton cache for raw AI response strings. 500 entries, 5-minute default TTL. */
export const aiCache = new LRUCache<string>(500, 300_000);
