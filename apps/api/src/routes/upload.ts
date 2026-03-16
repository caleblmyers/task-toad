import path from 'node:path';
import fs from 'node:fs';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '../graphql/context.js';

const router: ReturnType<typeof Router> = Router();
const prisma = new PrismaClient();

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

// File storage configuration
const uploadDir = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 10 * 1024 * 1024 } }); // 10MB max

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

    const attachment = await prisma.attachment.create({
      data: {
        taskId,
        fileName: req.file.originalname,
        fileKey: req.file.filename,
        mimeType: req.file.mimetype,
        sizeBytes: req.file.size,
        uploadedById: user.userId,
      },
    });

    res.status(201).json(attachment);
  } catch {
    res.status(500).json({ error: 'Upload failed' });
  }
});

// GET /api/uploads/:attachmentId — serve the file
router.get('/:attachmentId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
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

    const filePath = path.join(uploadDir, attachment.fileKey);
    if (!fs.existsSync(filePath)) {
      res.status(404).json({ error: 'File not found on disk' });
      return;
    }

    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${attachment.fileName}"`);
    res.sendFile(filePath);
  } catch {
    res.status(500).json({ error: 'Failed to serve file' });
  }
});

// DELETE /api/uploads/:attachmentId — delete attachment
router.delete('/:attachmentId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
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

    // Delete file from disk
    const filePath = path.join(uploadDir, attachment.fileKey);
    try { fs.unlinkSync(filePath); } catch { /* file may already be gone */ }

    // Delete DB record
    await prisma.attachment.delete({ where: { attachmentId } });

    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Delete failed' });
  }
});

export const uploadRouter: import('express').Router = router;
