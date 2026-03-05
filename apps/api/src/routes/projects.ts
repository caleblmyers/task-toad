import express, { Router, type Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { requireAdmin } from '../middleware/auth.js';
import { createProjectSchema } from '@task-toad/shared';
import { listProjects, getProject, putProject } from '../db/table.js';
import { v4 as uuidv4 } from 'uuid';

const router: express.IRouter = Router();

router.get('/projects', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const orgId = req.tenant!.orgId;
  const items = await listProjects(orgId);
  res.json(
    items.map((p) => ({
      projectId: p.projectId,
      name: p.name,
      createdAt: p.createdAt,
    }))
  );
});

router.post('/projects', requireAdmin, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const parsed = createProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const orgId = req.tenant!.orgId;
  const projectId = uuidv4();
  await putProject(orgId, projectId, parsed.data.name);
  res.status(201).json({ projectId, name: parsed.data.name, createdAt: new Date().toISOString() });
});

router.get('/projects/:projectId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const orgId = req.tenant!.orgId;
  const project = await getProject(orgId, projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  res.json({
    projectId: project.projectId,
    name: project.name,
    createdAt: project.createdAt,
  });
});

export default router;
