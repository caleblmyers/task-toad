import path from 'node:path';
import fs from 'node:fs';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '../graphql/context.js';
import { getPrisma } from './sharedPrisma.js';
import {
  isS3Configured,
  buildS3Key,
  uploadToS3,
  getSignedDownloadUrl,
  deleteFromS3,
} from '../utils/s3.js';

const router: ReturnType<typeof Router> = Router();

// Safe MIME types that can be displayed inline (no XSS risk)
const SAFE_INLINE_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain',
]);

// Allowed upload MIME types (reject executables, scripts, etc.)
const ALLOWED_UPLOAD_MIME_TYPES = new Set([
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf',
  'text/plain', 'text/csv', 'text/markdown',
  'application/json',
  'application/zip', 'application/gzip',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
]);

interface AuthRequest extends Request {
  user?: { userId: string; email: string; orgId: string };
}

async function requireAuth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'No token' });
    return;
  }
  try {
    const prisma = getPrisma();
    const { payload } = await jwtVerify(token, JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { userId: payload.sub as string } });
    if (!user || !user.orgId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    req.user = { userId: user.userId, email: user.email, orgId: user.orgId };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Sanitize filenames: strip path traversal, null bytes, and non-alphanumeric chars (except .-_)
function sanitizeFilename(name: string): string {
  return name
    .replace(/\0/g, '')                    // null bytes
    .replace(/[/\\]/g, '')                 // path separators
    .replace(/\.\./g, '')                  // directory traversal
    .replace(/[^a-zA-Z0-9._-]/g, '_')     // non-safe chars → underscore
    .slice(0, 200);                        // length limit
}

// --- Storage configuration ---
// S3 mode: use memory storage (buffer available as req.file.buffer)
// Local mode: use disk storage (file written to uploads/ directory)
const uploadDir = path.resolve(process.cwd(), 'uploads');

if (!isS3Configured) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = isS3Configured
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: uploadDir,
      filename: (_req, file, cb) => cb(null, `${Date.now()}-${sanitizeFilename(file.originalname)}`),
    });

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_UPLOAD_MIME_TYPES.has(file.mimetype)) {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
      return;
    }
    cb(null, true);
  },
});

// Rate limiter: 10 uploads per minute per IP
const uploadLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Too many upload requests. Please try again later.' },
});

// POST /api/uploads/:taskId — upload a file attachment
router.post('/:taskId', requireAuth, uploadLimiter, upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { taskId } = req.params;
    const user = req.user!;

    // Verify task exists and user has access
    const task = await prisma.task.findUnique({ where: { taskId } });
    if (!task || task.orgId !== user.orgId) {
      res.status(404).json({ error: 'Task not found' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'No file provided' });
      return;
    }

    const sanitizedName = sanitizeFilename(req.file.originalname);
    let fileKey: string;

    if (isS3Configured) {
      // S3 mode: upload buffer to object storage
      fileKey = buildS3Key(user.orgId, taskId, sanitizedName);
      await uploadToS3(fileKey, req.file.buffer, req.file.mimetype);
    } else {
      // Local mode: file already written to disk by multer
      fileKey = req.file.filename;
    }

    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        fileName: sanitizedName,
        fileKey,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedById: user.userId,
      },
    });

    res.status(201).json(attachment);
  } catch (err) {
    const message = err instanceof Error && err.message.startsWith('File type')
      ? err.message : 'Upload failed';
    res.status(400).json({ error: message });
  }
});

// GET /api/uploads/:attachmentId — serve the file
router.get('/:attachmentId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { attachmentId } = req.params;
    const user = req.user!;

    const attachment = await prisma.attachment.findUnique({
      where: { attachmentId },
      include: { task: { select: { orgId: true } } },
    });
    if (!attachment || attachment.task.orgId !== user.orgId) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    if (isS3Configured) {
      // S3 mode: redirect to presigned URL
      const url = await getSignedDownloadUrl(attachment.fileKey);
      res.redirect(302, url);
    } else {
      // Local mode: stream file from disk
      const filePath = path.join(uploadDir, attachment.fileKey);
      if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: 'File not found on disk' });
        return;
      }

      const disposition = SAFE_INLINE_MIME_TYPES.has(attachment.mimeType) ? 'inline' : 'attachment';
      const contentType = ALLOWED_UPLOAD_MIME_TYPES.has(attachment.mimeType)
        ? attachment.mimeType : 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `${disposition}; filename="${sanitizeFilename(attachment.fileName)}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.sendFile(filePath);
    }
  } catch {
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// DELETE /api/uploads/:attachmentId — delete attachment
router.delete('/:attachmentId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const prisma = getPrisma();
    const { attachmentId } = req.params;
    const user = req.user!;

    const attachment = await prisma.attachment.findUnique({
      where: { attachmentId },
      include: { task: { select: { orgId: true } } },
    });
    if (!attachment || attachment.task.orgId !== user.orgId) {
      res.status(404).json({ error: 'Attachment not found' });
      return;
    }

    if (isS3Configured) {
      // S3 mode: delete from object storage
      try { await deleteFromS3(attachment.fileKey); } catch { /* object may already be gone */ }
    } else {
      // Local mode: delete from disk
      const filePath = path.join(uploadDir, attachment.fileKey);
      try { fs.unlinkSync(filePath); } catch { /* file may already be gone */ }
    }

    // Delete DB record
    await prisma.attachment.delete({ where: { attachmentId } });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Delete failed' });
  }
});

export const uploadRouter: import('express').Router = router;
