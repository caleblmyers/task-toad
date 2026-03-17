import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from './logger.js';

const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_BUCKET = process.env.S3_BUCKET;
const S3_REGION = process.env.S3_REGION || 'auto';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;

/** Whether S3 storage is configured. When false, local disk fallback is used. */
export const isS3Configured =
  !!S3_BUCKET && !!S3_ACCESS_KEY_ID && !!S3_SECRET_ACCESS_KEY;

let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    if (!isS3Configured) {
      throw new Error('S3 is not configured');
    }
    s3Client = new S3Client({
      region: S3_REGION,
      ...(S3_ENDPOINT ? { endpoint: S3_ENDPOINT } : {}),
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID!,
        secretAccessKey: S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true, // Required for MinIO / R2 compatibility
    });
  }
  return s3Client;
}

/** Build a storage key for an attachment. */
export function buildS3Key(
  orgId: string,
  taskId: string,
  sanitizedFilename: string,
): string {
  return `attachments/${orgId}/${taskId}/${Date.now()}-${sanitizedFilename}`;
}

/** Upload a file buffer to S3. */
export async function uploadToS3(
  key: string,
  body: Buffer,
  contentType: string,
): Promise<void> {
  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET!,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Generate a presigned download URL (default 15 min expiry). */
export async function getSignedDownloadUrl(
  key: string,
  expiresIn = 900,
): Promise<string> {
  const client = getS3Client();
  return getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: S3_BUCKET!, Key: key }),
    { expiresIn },
  );
}

/** Delete an object from S3. */
export async function deleteFromS3(key: string): Promise<void> {
  const client = getS3Client();
  await client.send(
    new DeleteObjectCommand({ Bucket: S3_BUCKET!, Key: key }),
  );
}

/** Check S3 bucket connectivity. Returns 'ok', 'not configured', or an error string. */
export async function checkS3Health(): Promise<string> {
  if (!isS3Configured) return 'not configured';
  try {
    const client = getS3Client();
    await client.send(new HeadBucketCommand({ Bucket: S3_BUCKET! }));
    return 'ok';
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn({ err }, 'S3 health check failed');
    return `error: ${message}`;
  }
}

if (!isS3Configured) {
  logger.warn(
    'S3 storage not configured (S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY). Using local disk fallback.',
  );
}
