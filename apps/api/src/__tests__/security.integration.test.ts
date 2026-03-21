import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { SignJWT } from 'jose';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { authMutations } from '../graphql/resolvers/auth.js';
import { orgMutations } from '../graphql/resolvers/org.js';
import { sprintMutations } from '../graphql/resolvers/sprint.js';
import { searchMutations } from '../graphql/resolvers/search.js';
import { taskMutations } from '../graphql/resolvers/task/mutations.js';
import { JWT_SECRET, type Context } from '../graphql/context.js';
import type { Loaders } from '../graphql/loaders.js';
import { createLoaders } from '../graphql/loaders.js';
import { checkAIRateLimit } from '../utils/aiRateLimiter.js';
import app from '../app.js';

// Ensure ENCRYPTION_MASTER_KEY is set for encryption tests
if (!process.env.ENCRYPTION_MASTER_KEY) {
  // 32 random bytes as hex (64 chars)
  process.env.ENCRYPTION_MASTER_KEY = 'a'.repeat(64);
}

// ── Helpers ──

function makeContext(
  user: Context['user'] = null,
  org: Context['org'] = null,
  res?: Context['res'],
): Context {
  return {
    user,
    org,
    prisma,
    loaders: user?.orgId ? createLoaders(prisma, user.orgId) : ({} as Loaders),
    res,
  };
}

async function generateToken(sub: string, email: string, extra?: Record<string, unknown>): Promise<string> {
  return new SignJWT({ sub, email, ...extra })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('1h')
    .sign(JWT_SECRET);
}

async function generateRefreshToken(sub: string, tv: number): Promise<string> {
  const jwt = await new SignJWT({ sub, type: 'refresh', tv })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(JWT_SECRET);
  // Create a matching RefreshToken record in the DB so the refresh endpoint accepts it
  const tokenHash = crypto.createHash('sha256').update(jwt).digest('hex');
  await prisma.refreshToken.create({
    data: {
      userId: sub,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return jwt;
}

async function signupAndVerify(email: string, password: string): Promise<string> {
  await authMutations.signup(null, { email, password }, makeContext());
  const user = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.user.update({ where: { userId: user.userId }, data: { emailVerifiedAt: new Date() } });
  return user.userId;
}

// ── Suite ──

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ═══════════════════════════════════════════════════
// Group 1: Cookie-based Auth Flow
// ═══════════════════════════════════════════════════

describe('Cookie-based Auth Flow', () => {
  const email = 'cookie@example.com';
  const password = 'SecurePass123';

  it('login sets tt-access and tt-refresh cookies via supertest', async () => {
    await signupAndVerify(email, password);

    const res = await request(app)
      .post('/graphql')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        query: `mutation { login(email: "${email}", password: "${password}") { token } }`,
      });

    expect(res.status).toBe(200);
    expect(res.body.data.login.token).toBeDefined();

    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.length).toBeGreaterThan(0);
    const cookieStr = cookies.join('; ');
    expect(cookieStr).toContain('tt-access=');
    expect(cookieStr).toContain('tt-refresh=');
    expect(cookieStr).toContain('HttpOnly');
  });

  it('logout clears both cookies', async () => {
    await signupAndVerify(email, password);

    // Login first to get cookies
    const loginRes = await request(app)
      .post('/graphql')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({
        query: `mutation { login(email: "${email}", password: "${password}") { token } }`,
      });
    const token = loginRes.body.data.login.token;

    const res = await request(app)
      .post('/graphql')
      .set('X-Requested-With', 'XMLHttpRequest')
      .set('Authorization', `Bearer ${token}`)
      .send({
        query: 'mutation { logout }',
      });

    expect(res.status).toBe(200);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.length).toBeGreaterThan(0);
    const cookieStr = cookies.join('; ');
    // Cleared cookies have empty values or expires in the past
    expect(cookieStr).toContain('tt-access=');
    expect(cookieStr).toContain('tt-refresh=');
  });

  it('/api/auth/refresh returns 401 without refresh cookie', async () => {
    const res = await request(app).post('/api/auth/refresh');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('No refresh token');
  });

  it('/api/auth/refresh with valid token returns new access token cookie', async () => {
    const userId = await signupAndVerify(email, password);
    const user = await prisma.user.findUniqueOrThrow({ where: { userId } });
    const refreshToken = await generateRefreshToken(userId, user.tokenVersion);

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `tt-refresh=${refreshToken}`);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    const cookies = ([] as string[]).concat(res.headers['set-cookie'] ?? []);
    expect(cookies.length).toBeGreaterThan(0);
    expect(cookies.join('; ')).toContain('tt-access=');
  });

  it('refresh rejects token after logout (tokenVersion incremented)', async () => {
    const userId = await signupAndVerify(email, password);
    const user = await prisma.user.findUniqueOrThrow({ where: { userId } });
    const refreshToken = await generateRefreshToken(userId, user.tokenVersion);

    // Simulate logout by incrementing tokenVersion
    await prisma.user.update({
      where: { userId },
      data: { tokenVersion: { increment: 1 } },
    });

    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `tt-refresh=${refreshToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Token revoked');
  });
});

// ═══════════════════════════════════════════════════
// Group 2: CSRF Protection
// ═══════════════════════════════════════════════════

describe('CSRF Protection', () => {
  it('POST /graphql without X-Requested-With returns 403', async () => {
    const res = await request(app)
      .post('/graphql')
      .send({ query: '{ me { userId } }' });

    expect(res.status).toBe(403);
    expect(res.body.errors[0].message).toBe('Missing X-Requested-With header');
  });

  it('POST /graphql with X-Requested-With succeeds', async () => {
    const res = await request(app)
      .post('/graphql')
      .set('X-Requested-With', 'XMLHttpRequest')
      .send({ query: '{ me { userId } }' });

    // Should reach GraphQL layer (200 even if unauthenticated — me returns null)
    expect(res.status).toBe(200);
  });
});

// ═══════════════════════════════════════════════════
// Group 3: AI Rate Limiter
// ═══════════════════════════════════════════════════

describe('AI Rate Limiter', () => {
  let orgId: string;

  beforeEach(async () => {
    const org = await prisma.org.create({ data: { name: 'Rate Limit Org' } });
    orgId = org.orgId;
  });

  it('passes when under the rate limit', async () => {
    await expect(checkAIRateLimit(prisma, orgId)).resolves.toBeUndefined();
  });

  it('throws when request count exceeds the limit', async () => {
    // Create prompt logs exceeding the default limit (60)
    const limit = Number(process.env.AI_RATE_LIMIT_PER_HOUR) || 60;
    const entries = Array.from({ length: limit }, () => ({
      orgId,
      userId: 'fake-user',
      model: 'test',
      feature: 'test',
      input: 'test input',
      output: 'test output',
      inputTokens: 10,
      outputTokens: 10,
      costUSD: 0.001,
      latencyMs: 100,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }));
    await prisma.aIPromptLog.createMany({ data: entries });

    await expect(checkAIRateLimit(prisma, orgId)).rejects.toThrow('AI rate limit exceeded');
  });
});

// ═══════════════════════════════════════════════════
// Group 4: Audit Logging
// ═══════════════════════════════════════════════════

describe('Audit Logging', () => {
  let orgId: string;
  let userId: string;
  const password = 'AuditPass123';

  beforeEach(async () => {
    const org = await prisma.org.create({ data: { name: 'Audit Org' } });
    orgId = org.orgId;
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email: 'audit@example.com',
        passwordHash,
        orgId,
        role: 'org:admin',
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.userId;
  });

  it('setOrgApiKey creates an Activity with action api_key_changed', async () => {
    const ctx = makeContext(
      { userId, email: 'audit@example.com', orgId, role: 'org:admin', emailVerifiedAt: new Date() },
      { orgId, name: 'Audit Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, createdAt: new Date() },
    );

    await orgMutations.setOrgApiKey(null, { apiKey: 'sk-ant-test-key', confirmPassword: password }, ctx);
    // Allow fire-and-forget audit write to settle
    await new Promise((r) => setTimeout(r, 200));

    const activity = await prisma.activity.findFirst({
      where: { orgId, action: 'api_key_changed' },
    });
    expect(activity).not.toBeNull();
    expect(activity!.userId).toBe(userId);
  });

  it('inviteOrgMember creates an Activity with action member_invited', async () => {
    const ctx = makeContext(
      { userId, email: 'audit@example.com', orgId, role: 'org:admin', emailVerifiedAt: new Date() },
      { orgId, name: 'Audit Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, createdAt: new Date() },
    );

    await authMutations.inviteOrgMember(null, { email: 'invited@example.com' }, ctx);
    await new Promise((r) => setTimeout(r, 200));

    const activity = await prisma.activity.findFirst({
      where: { orgId, action: 'member_invited' },
    });
    expect(activity).not.toBeNull();
    expect(activity!.newValue).toBe('invited@example.com');
  });

  it('logout creates an Activity with action user_logout', async () => {
    const ctx = makeContext(
      { userId, email: 'audit@example.com', orgId, role: 'org:admin', emailVerifiedAt: new Date() },
      { orgId, name: 'Audit Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, createdAt: new Date() },
    );

    await authMutations.logout(null, {}, ctx);
    await new Promise((r) => setTimeout(r, 200));

    const activity = await prisma.activity.findFirst({
      where: { orgId, action: 'user_logout' },
    });
    expect(activity).not.toBeNull();
    expect(activity!.userId).toBe(userId);
  });
});

// ═══════════════════════════════════════════════════
// Group 5: Email Anti-Enumeration
// (signup duplicate already tested in auth.integration.test.ts —
//  testing requestPasswordReset here for coverage)
// ═══════════════════════════════════════════════════

describe('Email Anti-Enumeration', () => {
  it('requestPasswordReset returns true for existing email', async () => {
    await signupAndVerify('exists@example.com', 'Password123');

    const result = await authMutations.requestPasswordReset(
      null,
      { email: 'exists@example.com' },
      makeContext(),
    );
    expect(result).toBe(true);
  });

  it('requestPasswordReset returns true for non-existent email (same response)', async () => {
    const result = await authMutations.requestPasswordReset(
      null,
      { email: 'ghost@example.com' },
      makeContext(),
    );
    expect(result).toBe(true);
  });
});

// ═══════════════════════════════════════════════════
// Group 6: Export Email Redaction
// ═══════════════════════════════════════════════════

describe('Export Email Redaction', () => {
  let orgId: string;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    const org = await prisma.org.create({ data: { name: 'Redact Org' } });
    orgId = org.orgId;
    const user = await prisma.user.create({
      data: {
        email: 'john@company.com',
        passwordHash: '$2a$10$placeholder',
        orgId,
        role: 'org:admin',
      },
    });
    userId = user.userId;
    const project = await prisma.project.create({
      data: { name: 'Redact Project', orgId, prompt: 'test' },
    });
    projectId = project.projectId;
    await prisma.task.create({
      data: {
        title: 'Test Task',
        status: 'todo',
        priority: 'medium',
        taskType: 'task',
        projectId,
        orgId,
        assigneeId: userId,
      },
    });
  });

  it('export with ?redactEmails=true masks email addresses', async () => {
    const token = await generateToken(userId, 'john@company.com');
    const res = await request(app)
      .get(`/api/export/project/${projectId}/json?redactEmails=true`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    // Check that full email is NOT present
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('john@company.com');
    // Check redacted format: first char + *** + @domain
    expect(body).toContain('j***@company.com');
  });

  it('export without ?redactEmails shows full emails', async () => {
    const token = await generateToken(userId, 'john@company.com');
    const res = await request(app)
      .get(`/api/export/project/${projectId}/json`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const body = JSON.stringify(res.body);
    expect(body).toContain('john@company.com');
  });
});

// ═══════════════════════════════════════════════════
// Group 7: Bulk Update Cap
// ═══════════════════════════════════════════════════

describe('Bulk Update Cap', () => {
  it('bulkUpdateTasks rejects more than 100 taskIds', async () => {
    const org = await prisma.org.create({ data: { name: 'Bulk Org' } });
    const user = await prisma.user.create({
      data: {
        email: 'bulk@example.com',
        passwordHash: '$2a$10$placeholder',
        orgId: org.orgId,
        role: 'org:admin',
        emailVerifiedAt: new Date(),
      },
    });

    const ctx = makeContext(
      { userId: user.userId, email: 'bulk@example.com', orgId: org.orgId, role: 'org:admin', emailVerifiedAt: new Date() },
      { orgId: org.orgId, name: 'Bulk Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, createdAt: new Date() },
    );

    const fakeIds = Array.from({ length: 101 }, (_, i) => `fake-task-${i}`);

    await expect(
      taskMutations.bulkUpdateTasks(null, { taskIds: fakeIds, status: 'done' }, ctx),
    ).rejects.toThrow('Cannot update more than 100 tasks at once');
  });
});

// ═══════════════════════════════════════════════════
// Group 8: Input Validation — Length Limits
// ═══════════════════════════════════════════════════

describe('Input Validation — Length Limits', () => {
  let orgId: string;
  let userId: string;
  let projectId: string;

  beforeEach(async () => {
    // Create user first (no org), then org, then link them
    const user = await prisma.user.create({
      data: {
        email: 'validate@example.com',
        passwordHash: '$2a$10$placeholder',
        emailVerifiedAt: new Date(),
      },
    });
    userId = user.userId;
    const org = await prisma.org.create({ data: { name: 'Validation Org' } });
    orgId = org.orgId;
    await prisma.user.update({
      where: { userId },
      data: { orgId, role: 'org:admin' },
    });
    const project = await prisma.project.create({
      data: { name: 'Valid Project', orgId, prompt: 'test' },
    });
    projectId = project.projectId;
    // Add user as project member for sprint creation permission
    await prisma.projectMember.create({
      data: { projectId, userId, role: 'admin' },
    });
  });

  it('createSprint rejects name longer than 200 characters', async () => {
    const ctx = makeContext(
      { userId, email: 'validate@example.com', orgId, role: 'org:admin', emailVerifiedAt: new Date() },
      { orgId, name: 'Validation Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, createdAt: new Date() },
    );

    const longName = 'x'.repeat(201);

    await expect(
      sprintMutations.createSprint(null, { projectId, name: longName }, ctx),
    ).rejects.toThrow('200 characters or less');
  });

  it('createLabel rejects name longer than 100 characters', async () => {
    const ctx = makeContext(
      { userId, email: 'validate@example.com', orgId, role: 'org:admin', emailVerifiedAt: new Date() },
      { orgId, name: 'Validation Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, createdAt: new Date() },
    );

    const longName = 'x'.repeat(101);

    await expect(
      searchMutations.createLabel(null, { name: longName }, ctx),
    ).rejects.toThrow('100 characters or less');
  });
});
