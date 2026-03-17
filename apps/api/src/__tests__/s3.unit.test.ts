import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock AWS SDK before importing s3 module ──

const mockSend = vi.fn();
vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: vi.fn().mockImplementation(() => ({ send: mockSend })),
  PutObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'PutObject' })),
  GetObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'GetObject' })),
  DeleteObjectCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'DeleteObject' })),
  HeadBucketCommand: vi.fn().mockImplementation((input) => ({ ...input, _type: 'HeadBucket' })),
}));

const mockGetSignedUrl = vi.fn().mockResolvedValue('https://s3.example.com/signed-url');
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: (...args: unknown[]) => mockGetSignedUrl(...args),
}));

// Mock logger to suppress warnings during tests
vi.mock('../utils/logger.js', () => ({
  logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

// ── Tests ──

describe('S3 utilities', () => {
  // We need to dynamically import the module to pick up env var changes,
  // since isS3Configured is computed at module load time.

  describe('when S3 is configured', () => {
    beforeEach(() => {
      process.env.S3_BUCKET = 'test-bucket';
      process.env.S3_ACCESS_KEY_ID = 'test-key';
      process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
      process.env.S3_REGION = 'us-east-1';
      mockSend.mockReset();
      mockGetSignedUrl.mockReset().mockResolvedValue('https://s3.example.com/signed-url');
      // Reset module cache to re-evaluate isS3Configured
      vi.resetModules();
    });

    afterEach(() => {
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;
      delete process.env.S3_REGION;
    });

    it('buildS3Key produces correct format', async () => {
      const { buildS3Key } = await import('../utils/s3.js');
      const key = buildS3Key('org-123', 'task-456', 'report.pdf');
      expect(key).toMatch(/^attachments\/org-123\/task-456\/\d+-report\.pdf$/);
    });

    it('uploadToS3 calls PutObjectCommand with correct params', async () => {
      const { uploadToS3 } = await import('../utils/s3.js');
      const { PutObjectCommand } = await import('@aws-sdk/client-s3');

      mockSend.mockResolvedValueOnce({});
      await uploadToS3('attachments/org/task/file.txt', Buffer.from('hello'), 'text/plain');

      expect(PutObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'attachments/org/task/file.txt',
        Body: Buffer.from('hello'),
        ContentType: 'text/plain',
      });
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('getSignedDownloadUrl calls getSignedUrl with default 900s expiry', async () => {
      const { getSignedDownloadUrl } = await import('../utils/s3.js');
      const { GetObjectCommand } = await import('@aws-sdk/client-s3');

      const url = await getSignedDownloadUrl('attachments/org/task/file.txt');

      expect(url).toBe('https://s3.example.com/signed-url');
      expect(GetObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'attachments/org/task/file.txt',
      });
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ Bucket: 'test-bucket', Key: 'attachments/org/task/file.txt' }),
        { expiresIn: 900 },
      );
    });

    it('getSignedDownloadUrl uses custom expiry', async () => {
      const { getSignedDownloadUrl } = await import('../utils/s3.js');

      await getSignedDownloadUrl('key', 3600);

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 3600 },
      );
    });

    it('deleteFromS3 calls DeleteObjectCommand', async () => {
      const { deleteFromS3 } = await import('../utils/s3.js');
      const { DeleteObjectCommand } = await import('@aws-sdk/client-s3');

      mockSend.mockResolvedValueOnce({});
      await deleteFromS3('attachments/org/task/file.txt');

      expect(DeleteObjectCommand).toHaveBeenCalledWith({
        Bucket: 'test-bucket',
        Key: 'attachments/org/task/file.txt',
      });
      expect(mockSend).toHaveBeenCalledOnce();
    });

    it('checkS3Health returns "ok" when HeadBucketCommand succeeds', async () => {
      const { checkS3Health } = await import('../utils/s3.js');

      mockSend.mockResolvedValueOnce({});
      const result = await checkS3Health();
      expect(result).toBe('ok');
    });

    it('checkS3Health returns error string when HeadBucketCommand fails', async () => {
      const { checkS3Health } = await import('../utils/s3.js');

      mockSend.mockRejectedValueOnce(new Error('Access Denied'));
      const result = await checkS3Health();
      expect(result).toBe('error: Access Denied');
    });

    it('isS3Configured is true when env vars are set', async () => {
      const { isS3Configured } = await import('../utils/s3.js');
      expect(isS3Configured).toBe(true);
    });

    it('buildS3Key handles filenames with spaces and special characters', async () => {
      const { buildS3Key } = await import('../utils/s3.js');
      const key = buildS3Key('org-1', 'task-2', 'my report (final).pdf');
      expect(key).toMatch(/^attachments\/org-1\/task-2\/\d+-my report \(final\)\.pdf$/);
    });

    it('buildS3Key handles unicode filenames', async () => {
      const { buildS3Key } = await import('../utils/s3.js');
      const key = buildS3Key('org-1', 'task-2', '日本語ファイル.txt');
      expect(key).toMatch(/^attachments\/org-1\/task-2\/\d+-日本語ファイル\.txt$/);
    });

    it('uploadToS3 propagates network errors', async () => {
      const { uploadToS3 } = await import('../utils/s3.js');
      mockSend.mockRejectedValueOnce(new Error('Network timeout'));
      await expect(uploadToS3('key', Buffer.from('x'), 'text/plain')).rejects.toThrow('Network timeout');
    });

    it('deleteFromS3 propagates errors', async () => {
      const { deleteFromS3 } = await import('../utils/s3.js');
      mockSend.mockRejectedValueOnce(new Error('Access Denied'));
      await expect(deleteFromS3('key')).rejects.toThrow('Access Denied');
    });
  });

  describe('with custom S3 endpoint', () => {
    beforeEach(() => {
      process.env.S3_BUCKET = 'test-bucket';
      process.env.S3_ACCESS_KEY_ID = 'test-key';
      process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
      process.env.S3_REGION = 'us-east-1';
      process.env.S3_ENDPOINT = 'https://minio.local:9000';
      mockSend.mockReset();
      vi.resetModules();
    });

    afterEach(() => {
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;
      delete process.env.S3_REGION;
      delete process.env.S3_ENDPOINT;
    });

    it('creates S3Client with endpoint and forcePathStyle', async () => {
      const { S3Client } = await import('@aws-sdk/client-s3');
      const { uploadToS3 } = await import('../utils/s3.js');
      mockSend.mockResolvedValueOnce({});
      await uploadToS3('key', Buffer.from('x'), 'text/plain');

      expect(S3Client).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'https://minio.local:9000',
          forcePathStyle: true,
        }),
      );
    });
  });

  describe('with custom ATTACHMENT_URL_EXPIRY_SECONDS', () => {
    beforeEach(() => {
      process.env.S3_BUCKET = 'test-bucket';
      process.env.S3_ACCESS_KEY_ID = 'test-key';
      process.env.S3_SECRET_ACCESS_KEY = 'test-secret';
      process.env.S3_REGION = 'us-east-1';
      process.env.ATTACHMENT_URL_EXPIRY_SECONDS = '3600';
      mockSend.mockReset();
      mockGetSignedUrl.mockReset().mockResolvedValue('https://s3.example.com/signed-url');
      vi.resetModules();
    });

    afterEach(() => {
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;
      delete process.env.S3_REGION;
      delete process.env.ATTACHMENT_URL_EXPIRY_SECONDS;
    });

    it('uses ATTACHMENT_URL_EXPIRY_SECONDS env var as default expiry', async () => {
      const { getSignedDownloadUrl } = await import('../utils/s3.js');
      await getSignedDownloadUrl('key');

      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        { expiresIn: 3600 },
      );
    });
  });

  describe('when S3 is NOT configured', () => {
    beforeEach(() => {
      delete process.env.S3_BUCKET;
      delete process.env.S3_ACCESS_KEY_ID;
      delete process.env.S3_SECRET_ACCESS_KEY;
      vi.resetModules();
    });

    it('isS3Configured is false', async () => {
      const { isS3Configured } = await import('../utils/s3.js');
      expect(isS3Configured).toBe(false);
    });

    it('checkS3Health returns "not configured"', async () => {
      const { checkS3Health } = await import('../utils/s3.js');
      const result = await checkS3Health();
      expect(result).toBe('not configured');
    });

    it('uploadToS3 throws "S3 is not configured"', async () => {
      const { uploadToS3 } = await import('../utils/s3.js');
      await expect(uploadToS3('key', Buffer.from('x'), 'text/plain')).rejects.toThrow(
        'S3 is not configured',
      );
    });

    it('getSignedDownloadUrl throws "S3 is not configured"', async () => {
      const { getSignedDownloadUrl } = await import('../utils/s3.js');
      await expect(getSignedDownloadUrl('key')).rejects.toThrow('S3 is not configured');
    });

    it('deleteFromS3 throws "S3 is not configured"', async () => {
      const { deleteFromS3 } = await import('../utils/s3.js');
      await expect(deleteFromS3('key')).rejects.toThrow('S3 is not configured');
    });
  });
});
