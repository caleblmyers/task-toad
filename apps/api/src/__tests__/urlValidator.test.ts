import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock node:dns before importing the module
const mockResolve4 = vi.fn<(hostname: string) => Promise<string[]>>();
const mockResolve6 = vi.fn<(hostname: string) => Promise<string[]>>();
vi.mock('node:dns', () => ({
  default: {
    promises: {
      resolve4: (...args: unknown[]) => mockResolve4(args[0] as string),
      resolve6: (...args: unknown[]) => mockResolve6(args[0] as string),
    },
  },
}));

import { validateWebhookUrl } from '../utils/urlValidator.js';

describe('validateWebhookUrl', () => {
  beforeEach(() => {
    mockResolve4.mockReset();
    mockResolve6.mockReset();
  });

  it('accepts valid public HTTPS URL', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    await expect(validateWebhookUrl('https://example.com/webhook')).resolves.toBeUndefined();
  });

  it('accepts valid HTTP URL', async () => {
    mockResolve4.mockResolvedValue(['93.184.216.34']);
    await expect(validateWebhookUrl('http://example.com/webhook')).resolves.toBeUndefined();
  });

  it('rejects invalid URL format', async () => {
    await expect(validateWebhookUrl('not-a-url')).rejects.toThrow('Invalid URL format');
  });

  describe('blocked hostnames', () => {
    it.each([
      ['localhost', 'http://localhost/hook'],
      ['127.0.0.1', 'http://127.0.0.1/hook'],
      ['::1', 'http://[::1]/hook'],
      ['0.0.0.0', 'http://0.0.0.0/hook'],
    ])(
      'rejects %s',
      async (_label, url) => {
        await expect(validateWebhookUrl(url)).rejects.toThrow(/blocked hostname|private IP/);
      },
    );
  });

  describe('private IP ranges (via DNS resolution)', () => {
    it.each([
      ['10.0.0.1', 'private 10.x.x.x'],
      ['172.16.0.1', 'private 172.16.x.x'],
      ['192.168.1.1', 'private 192.168.x.x'],
    ])('rejects DNS resolving to %s (%s)', async (ip) => {
      mockResolve4.mockResolvedValue([ip]);
      await expect(validateWebhookUrl('https://evil.example.com/hook')).rejects.toThrow('private IP');
    });
  });

  describe('blocked ports', () => {
    it.each([5432, 6379, 27017])('rejects port %d', async (port) => {
      await expect(validateWebhookUrl(`https://example.com:${port}/hook`)).rejects.toThrow('blocked port');
    });
  });

  describe('non-HTTP protocols', () => {
    it.each(['ftp://example.com', 'file:///etc/passwd'])(
      'rejects %s',
      async (url) => {
        await expect(validateWebhookUrl(url)).rejects.toThrow('Only http and https');
      },
    );
  });

  describe('private IPv6 addresses (via DNS resolution)', () => {
    it.each([
      ['fc00::1', 'unique local'],
      ['fe80::1', 'link-local'],
    ])('rejects DNS resolving to %s (%s)', async (ip6) => {
      mockResolve4.mockRejectedValue(new Error('ENODATA'));
      mockResolve6.mockResolvedValue([ip6]);
      await expect(validateWebhookUrl('https://v6only.example.com/hook')).rejects.toThrow('private IP');
    });
  });

  it('allows URL when DNS fails but hostname is not a private IP', async () => {
    mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));
    mockResolve6.mockRejectedValue(new Error('ENOTFOUND'));
    // 93.184.216.34 is a public IP — DNS failure falls through to direct check, which passes
    await expect(validateWebhookUrl('https://93.184.216.34/hook')).resolves.toBeUndefined();
  });

  it('rejects when DNS fails and hostname IS a private IP', async () => {
    mockResolve4.mockRejectedValue(new Error('ENOTFOUND'));
    mockResolve6.mockRejectedValue(new Error('ENOTFOUND'));
    await expect(validateWebhookUrl('http://10.0.0.5/hook')).rejects.toThrow('private IP');
  });
});
