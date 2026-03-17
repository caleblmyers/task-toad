import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import request from 'supertest';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { JWT_SECRET } from '../graphql/context.js';
import app from '../app.js';

// ── Helpers ──

let orgId: string;
let userId: string;
let projectId: string;

async function generateToken(sub: string, email: string): Promise<string> {
  return new SignJWT({ sub, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(JWT_SECRET);
}

// ── Setup ──

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();

  // Create org
  const org = await prisma.org.create({ data: { name: 'Export Test Org' } });
  orgId = org.orgId;

  // Create user in org
  const user = await prisma.user.create({
    data: {
      email: 'export@example.com',
      passwordHash: '$2a$10$placeholder',
      orgId,
      role: 'org:admin',
    },
  });
  userId = user.userId;

  // Create project
  const project = await prisma.project.create({
    data: { name: 'Export Project', orgId, prompt: 'test' },
  });
  projectId = project.projectId;

  // Create a task in the project
  await prisma.task.create({
    data: {
      title: 'Sample Task',
      status: 'todo',
      priority: 'medium',
      taskType: 'task',
      projectId,
      orgId,
    },
  });

  // Create an activity
  await prisma.activity.create({
    data: {
      projectId,
      orgId,
      userId,
      action: 'created_task',
      field: 'status',
      newValue: 'todo',
    },
  });
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('Export REST endpoints', () => {
  describe('GET /api/export/project/:projectId/json', () => {
    it('returns 200 with project data and tasks array', async () => {
      const token = await generateToken(userId, 'export@example.com');
      const res = await request(app)
        .get(`/api/export/project/${projectId}/json`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.body.project.name).toBe('Export Project');
      expect(res.body.tasks).toHaveLength(1);
      expect(res.body.tasks[0].title).toBe('Sample Task');
    });
  });

  describe('GET /api/export/project/:projectId/csv', () => {
    it('returns 200 with CSV content', async () => {
      const token = await generateToken(userId, 'export@example.com');
      const res = await request(app)
        .get(`/api/export/project/${projectId}/csv`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
      // CSV should have headers and at least one data row
      const lines = res.text.split('\n');
      expect(lines.length).toBeGreaterThanOrEqual(2);
      expect(lines[0]).toContain('taskId');
      expect(lines[0]).toContain('title');
    });
  });

  describe('GET /api/export/project/:projectId/activity/json', () => {
    it('returns 200 with activities array', async () => {
      const token = await generateToken(userId, 'export@example.com');
      const res = await request(app)
        .get(`/api/export/project/${projectId}/activity/json`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body).toBeInstanceOf(Array);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('action', 'created_task');
    });
  });

  describe('authentication', () => {
    it('returns 401 without auth token', async () => {
      const res = await request(app)
        .get(`/api/export/project/${projectId}/json`);

      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await request(app)
        .get(`/api/export/project/${projectId}/json`)
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(401);
    });
  });

  describe('tenant isolation', () => {
    it('returns 404 for a project in another org', async () => {
      // Create another org + user
      const otherOrg = await prisma.org.create({ data: { name: 'Other Org' } });
      const otherUser = await prisma.user.create({
        data: {
          email: 'other@example.com',
          passwordHash: '$2a$10$placeholder',
          orgId: otherOrg.orgId,
          role: 'org:member',
        },
      });

      const token = await generateToken(otherUser.userId, 'other@example.com');
      const res = await request(app)
        .get(`/api/export/project/${projectId}/json`)
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Project not found');
    });
  });
});
