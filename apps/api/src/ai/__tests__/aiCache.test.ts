import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LRUCache, hashPrompt, aiCache } from '../aiCache.js';

describe('hashPrompt', () => {
  it('produces same hash for same inputs', () => {
    const a = hashPrompt('system', 'user');
    const b = hashPrompt('system', 'user');
    expect(a).toBe(b);
  });

  it('produces different hashes for different inputs', () => {
    const a = hashPrompt('system', 'user-a');
    const b = hashPrompt('system', 'user-b');
    expect(a).not.toBe(b);
  });

  it('produces different hashes when system prompt differs', () => {
    const a = hashPrompt('system-a', 'user');
    const b = hashPrompt('system-b', 'user');
    expect(a).not.toBe(b);
  });

  it('returns a 16-char hex string', () => {
    const hash = hashPrompt('hello', 'world');
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });
});

describe('LRUCache', () => {
  let cache: LRUCache<string>;

  beforeEach(() => {
    cache = new LRUCache<string>(5, 60_000);
  });

  it('returns undefined for missing key', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('stores and retrieves values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('returns undefined for wrong key', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key2')).toBeUndefined();
  });

  it('evicts oldest entry when at capacity', () => {
    for (let i = 0; i < 5; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    // Cache is full (5 entries). Adding one more should evict key0.
    cache.set('key5', 'value5');
    expect(cache.get('key0')).toBeUndefined();
    expect(cache.get('key5')).toBe('value5');
  });

  it('promotes recently accessed entries (LRU behavior)', () => {
    for (let i = 0; i < 5; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    // Access key0, making it most recently used
    cache.get('key0');
    // Add new entry — key1 (oldest after key0 was promoted) should be evicted
    cache.set('key5', 'value5');
    expect(cache.get('key0')).toBe('value0');
    expect(cache.get('key1')).toBeUndefined();
  });

  describe('TTL expiry', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('expires entries after TTL', () => {
      const shortCache = new LRUCache<string>(10, 100);
      shortCache.set('key', 'value');
      expect(shortCache.get('key')).toBe('value');

      vi.advanceTimersByTime(150);
      expect(shortCache.get('key')).toBeUndefined();
    });

    it('respects custom TTL per entry', () => {
      const c = new LRUCache<string>(10, 10_000);
      c.set('short', 'val', 50);
      c.set('long', 'val', 5000);

      vi.advanceTimersByTime(60);
      expect(c.get('short')).toBeUndefined();
      expect(c.get('long')).toBe('val');
    });
  });

  it('clear removes all entries', () => {
    cache.set('a', '1');
    cache.set('b', '2');
    cache.clear();
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('b')).toBeUndefined();
  });
});

describe('aiCache singleton', () => {
  it('is an instance of LRUCache', () => {
    expect(aiCache).toBeInstanceOf(LRUCache);
  });

  it('can set and get values', () => {
    aiCache.set('test-singleton', 'hello');
    expect(aiCache.get('test-singleton')).toBe('hello');
    aiCache.clear(); // clean up
  });
});
