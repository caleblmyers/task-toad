import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { jwtVerify } from 'jose';
import { JWT_SECRET } from '../graphql/context.js';

const router: ReturnType<typeof Router> = Router();
const prisma = new PrismaClient();

interface AuthRequest extends Request {
  user?: { userId: string; email: string; orgId: string | null };
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
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    req.user = { userId: user.userId, email: user.email, orgId: user.orgId };
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

async function verifyProjectAccess(req: AuthRequest, res: Response): Promise<string | null> {
  const { projectId } = req.params;
  const user = req.user!;
  if (!user.orgId) {
    res.status(403).json({ error: 'No org membership' });
    return null;
  }
  const project = await prisma.project.findUnique({ where: { projectId } });
  if (!project || project.orgId !== user.orgId) {
    res.status(404).json({ error: 'Project not found' });
    return null;
  }
  return projectId;
}

function toCSV(rows: Record<string, string | number | null | undefined>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const lines = [headers.join(',')];
  for (const row of rows) {
    lines.push(
      headers
        .map((h) => {
          const val = row[h] ?? '';
          const str = String(val);
          return str.includes(',') || str.includes('"') || str.includes('\n')
            ? `"${str.replace(/"/g, '""')}"`
            : str;
        })
        .join(',')
    );
  }
  return lines.join('\n');
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9_-]/g, '_');
}

interface TaskExportRow {
  taskId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignee: string;
  sprint: string;
  dueDate: string;
  storyPoints: string | number;
  estimatedHours: string | number;
  labels: string;
  createdAt: string;
}

// GET /project/:projectId/json
router.get('/project/:projectId/json', requireAuth, async (req: AuthRequest, res: Response) => {
  const projectId = await verifyProjectAccess(req, res);
  if (!projectId) return;

  const project = await prisma.project.findUnique({ where: { projectId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      labels: { include: { label: true } },
      comments: { include: { user: { select: { email: true } } }, orderBy: { createdAt: 'asc' } },
      assignee: { select: { email: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  const sprints = await prisma.sprint.findMany({
    where: { projectId },
    orderBy: { createdAt: 'asc' },
  });

  const filename = sanitizeFilename(project.name);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json({
    project: {
      name: project.name,
      description: project.description,
      statuses: project.statuses,
      createdAt: project.createdAt,
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tasks: tasks.map((t: any) => ({
      taskId: t.taskId,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      taskType: t.taskType,
      assignee: t.assignee?.email ?? null,
      sprintId: t.sprintId,
      sprintColumn: t.sprintColumn,
      dueDate: t.dueDate,
      storyPoints: t.storyPoints,
      estimatedHours: t.estimatedHours,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      labels: t.labels.map((tl: any) => tl.label.name),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      comments: t.comments.map((c: any) => ({
        user: c.user.email,
        content: c.content,
        createdAt: c.createdAt,
      })),
      createdAt: t.createdAt,
    })),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sprints: sprints.map((s: any) => ({
      sprintId: s.sprintId,
      name: s.name,
      goal: s.goal,
      isActive: s.isActive,
      columns: s.columns,
      startDate: s.startDate,
      endDate: s.endDate,
      createdAt: s.createdAt,
      closedAt: s.closedAt,
    })),
  });
});

// GET /project/:projectId/csv
router.get('/project/:projectId/csv', requireAuth, async (req: AuthRequest, res: Response) => {
  const projectId = await verifyProjectAccess(req, res);
  if (!projectId) return;

  const project = await prisma.project.findUnique({ where: { projectId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    include: {
      labels: { include: { label: true } },
      assignee: { select: { email: true } },
      sprint: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: TaskExportRow[] = tasks.map((t: any) => ({
    taskId: t.taskId,
    title: t.title,
    description: t.description ?? '',
    status: t.status,
    priority: t.priority,
    assignee: t.assignee?.email ?? '',
    sprint: t.sprint?.name ?? '',
    dueDate: t.dueDate ?? '',
    storyPoints: t.storyPoints ?? '',
    estimatedHours: t.estimatedHours ?? '',
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    labels: t.labels.map((tl: any) => tl.label.name).join('; '),
    createdAt: t.createdAt.toISOString(),
  }));

  const csv = toCSV(rows as unknown as Record<string, string | number | null>[]);
  const filename = sanitizeFilename(project.name);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}-tasks.csv"`);
  res.send(csv);
});

interface ActivityExportRow {
  date: string;
  user: string;
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
  taskId: string;
}

function buildActivityDateFilter(query: { from?: string; to?: string }): { gte?: Date; lte?: Date } | undefined {
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: from } : {}),
    ...(to ? { lte: to } : {}),
  };
}

// GET /project/:projectId/activity/json
router.get('/project/:projectId/activity/json', requireAuth, async (req: AuthRequest, res: Response) => {
  const projectId = await verifyProjectAccess(req, res);
  if (!projectId) return;

  const project = await prisma.project.findUnique({ where: { projectId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const dateFilter = buildActivityDateFilter(req.query as { from?: string; to?: string });
  const activities = await prisma.activity.findMany({
    where: {
      projectId,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  const filename = sanitizeFilename(project.name);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}-activity.json"`);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  res.json(activities.map((a: any) => ({
    activityId: a.activityId,
    date: a.createdAt.toISOString(),
    user: a.user.email,
    action: a.action,
    field: a.field,
    oldValue: a.oldValue,
    newValue: a.newValue,
    taskId: a.taskId,
    sprintId: a.sprintId,
  })));
});

// GET /project/:projectId/activity/csv
router.get('/project/:projectId/activity/csv', requireAuth, async (req: AuthRequest, res: Response) => {
  const projectId = await verifyProjectAccess(req, res);
  if (!projectId) return;

  const project = await prisma.project.findUnique({ where: { projectId } });
  if (!project) {
    res.status(404).json({ error: 'Project not found' });
    return;
  }

  const dateFilter = buildActivityDateFilter(req.query as { from?: string; to?: string });
  const activities = await prisma.activity.findMany({
    where: {
      projectId,
      ...(dateFilter ? { createdAt: dateFilter } : {}),
    },
    include: { user: { select: { email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10000,
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rows: ActivityExportRow[] = activities.map((a: any) => ({
    date: a.createdAt.toISOString(),
    user: a.user.email,
    action: a.action,
    field: a.field ?? '',
    oldValue: a.oldValue ?? '',
    newValue: a.newValue ?? '',
    taskId: a.taskId ?? '',
  }));

  const csv = toCSV(rows as unknown as Record<string, string | number | null>[]);
  const filename = sanitizeFilename(project.name);
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}-activity.csv"`);
  res.send(csv);
});

export { router as exportRouter };
