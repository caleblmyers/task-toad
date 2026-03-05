import express, { Router, type Response } from 'express';
import type { AuthenticatedRequest } from '../middleware/auth.js';
import { createTaskSchema, updateTaskSchema } from '@task-toad/shared';
import { listTasks, getTask, putTask, updateTask, getProject } from '../db/table.js';
import { v4 as uuidv4 } from 'uuid';

const router: express.IRouter = Router();

router.get('/projects/:projectId/tasks', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const orgId = req.tenant!.orgId;
  const project = await getProject(orgId, projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const items = await listTasks(orgId, projectId);
  res.json(
    items.map((t) => ({
      taskId: t.taskId,
      title: t.title,
      status: t.status,
      projectId: t.projectId,
      createdAt: t.createdAt,
    }))
  );
});

router.post('/projects/:projectId/tasks', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const parsed = createTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const orgId = req.tenant!.orgId;
  const project = await getProject(orgId, projectId);
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }
  const taskId = uuidv4();
  const status = parsed.data.status ?? 'todo';
  await putTask(orgId, taskId, projectId, parsed.data.title, status);
  const createdAt = new Date().toISOString();
  res.status(201).json({
    taskId,
    title: parsed.data.title,
    status,
    projectId,
    createdAt,
  });
});

router.patch('/tasks/:taskId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;
  const parsed = updateTaskSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten() });
    return;
  }
  const orgId = req.tenant!.orgId;
  const task = await getTask(orgId, taskId);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  const updates: { title?: string; status?: string } = {};
  if (parsed.data.title !== undefined) updates.title = parsed.data.title;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  const updated = await updateTask(orgId, taskId, updates);
  res.json({
    taskId: updated!.taskId,
    title: updated!.title,
    status: updated!.status,
    projectId: updated!.projectId,
    createdAt: updated!.createdAt,
  });
});

router.get('/tasks/:taskId', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;
  const orgId = req.tenant!.orgId;
  const task = await getTask(orgId, taskId);
  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }
  res.json({
    taskId: task.taskId,
    title: task.title,
    status: task.status,
    projectId: task.projectId,
    createdAt: task.createdAt,
  });
});

export default router;
