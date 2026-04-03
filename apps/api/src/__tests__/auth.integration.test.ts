import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { authMutations } from '../graphql/resolvers/auth.js';
import { orgMutations } from '../graphql/resolvers/org.js';
import { JWT_SECRET, type Context } from '../graphql/context.js';
import type { Loaders } from '../graphql/loaders.js';

// ── Helpers ──

function makeContext(user: Context['user'] = null, org: Context['org'] = null): Context {
  return {
    user,
    org,
    prisma,
    // Loaders are not used by auth resolvers — provide a stub
    loaders: {} as Loaders,
  };
}

async function signupUser(email: string, password: string): Promise<void> {
  await authMutations.signup(null, { email, password }, makeContext());
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

describe('signup', () => {
  it('creates a user in the database with a hashed password', async () => {
    const email = 'test@example.com';
    const password = 'SecurePass123';

    const result = await authMutations.signup(null, { email, password }, makeContext());
    expect(result).toBe(true);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user).not.toBeNull();
    expect(user!.email).toBe(email);
    // Password must be hashed, not stored in plaintext
    expect(user!.passwordHash).not.toBe(password);
    const isHashed = await bcrypt.compare(password, user!.passwordHash);
    expect(isHashed).toBe(true);
  });

  it('returns success for duplicate email to prevent enumeration', async () => {
    await signupUser('dup@example.com', 'Password123');

    const result = await authMutations.signup(null, { email: 'dup@example.com', password: 'Password456' }, makeContext());
    expect(result).toBe(true);
  });

  it('rejects short password with ValidationError', async () => {
    await expect(
      authMutations.signup(null, { email: 'short@example.com', password: 'abc' }, makeContext()),
    ).rejects.toThrow('Password must be at least 8 characters');
  });
});

describe('login', () => {
  const email = 'login@example.com';
  const password = 'CorrectHorse1';

  beforeEach(async () => {
    await signupUser(email, password);
    // Mark email as verified so login succeeds
    await prisma.user.update({ where: { email }, data: { emailVerifiedAt: new Date() } });
  });

  it('returns a valid JWT token on success', async () => {
    const result = await authMutations.login(null, { email, password }, makeContext());
    expect(result).toHaveProperty('token');
    expect(typeof result.token).toBe('string');

    // Verify the token can be decoded with jose
    const { payload } = await jwtVerify(result.token, JWT_SECRET);
    expect(payload.sub).toBeDefined();
    expect(payload.email).toBe(email);
  });

  it('rejects wrong password with AuthenticationError', async () => {
    await expect(
      authMutations.login(null, { email, password: 'WrongPassword1' }, makeContext()),
    ).rejects.toThrow('Invalid email or password');
  });

  it('rejects nonexistent email with AuthenticationError', async () => {
    await expect(
      authMutations.login(null, { email: 'nobody@example.com', password: 'Anything123' }, makeContext()),
    ).rejects.toThrow('Invalid email or password');
  });
});

describe('logout → login as different user', () => {
  it('ensures tenant isolation after re-login as a different user', async () => {
    // 1. Sign up user A and verify email
    const emailA = 'usera@example.com';
    const passA = 'PasswordA123';
    await signupUser(emailA, passA);
    await prisma.user.update({ where: { email: emailA }, data: { emailVerifiedAt: new Date() } });

    // 2. Login as user A
    const loginA = await authMutations.login(null, { email: emailA, password: passA }, makeContext());
    expect(loginA.token).toBeDefined();
    const { payload: payloadA } = await jwtVerify(loginA.token, JWT_SECRET);
    const userA = await prisma.user.findUnique({ where: { userId: payloadA.sub as string } });
    expect(userA).not.toBeNull();

    // 3. Create org for user A and a project
    const ctxA = makeContext({
      userId: userA!.userId,
      email: userA!.email,
      orgId: null,
      role: null,
      emailVerifiedAt: userA!.emailVerifiedAt,
    });
    await orgMutations.createOrg(null, { name: 'Org A' }, ctxA);

    // Reload user A to get orgId/role
    const userAUpdated = await prisma.user.findUnique({ where: { userId: userA!.userId } });
    const ctxAWithOrg = makeContext({
      userId: userAUpdated!.userId,
      email: userAUpdated!.email,
      orgId: userAUpdated!.orgId,
      role: userAUpdated!.role,
      emailVerifiedAt: userAUpdated!.emailVerifiedAt,
    });

    const { projectMutations } = await import('../graphql/resolvers/project.js');
    const projectA = await projectMutations.createProject(null, { name: 'Secret Project' }, ctxAWithOrg);
    expect(projectA.projectId).toBeDefined();

    // 4. "Logout" — discard user A's token (no server-side logout mutation needed)

    // 5. Sign up user B in a different org
    const emailB = 'userb@example.com';
    const passB = 'PasswordB123';
    await signupUser(emailB, passB);
    await prisma.user.update({ where: { email: emailB }, data: { emailVerifiedAt: new Date() } });

    // 6. Login as user B
    const loginB = await authMutations.login(null, { email: emailB, password: passB }, makeContext());
    expect(loginB.token).toBeDefined();
    const { payload: payloadB } = await jwtVerify(loginB.token, JWT_SECRET);
    const userB = await prisma.user.findUnique({ where: { userId: payloadB.sub as string } });
    expect(userB).not.toBeNull();

    // Create org for user B
    const ctxB = makeContext({
      userId: userB!.userId,
      email: userB!.email,
      orgId: null,
      role: null,
      emailVerifiedAt: userB!.emailVerifiedAt,
    });
    await orgMutations.createOrg(null, { name: 'Org B' }, ctxB);

    // Reload user B to get orgId/role
    const userBUpdated = await prisma.user.findUnique({ where: { userId: userB!.userId } });
    const ctxBWithOrg = makeContext({
      userId: userBUpdated!.userId,
      email: userBUpdated!.email,
      orgId: userBUpdated!.orgId,
      role: userBUpdated!.role,
      emailVerifiedAt: userBUpdated!.emailVerifiedAt,
    });

    // 7. Verify user B CANNOT access user A's project (tenant isolation)
    const { projectQueries } = await import('../graphql/resolvers/project.js');
    const result = await projectQueries.project(null, { projectId: projectA.projectId }, ctxBWithOrg);
    expect(result).toBeNull();

    // Also verify user B's projects list doesn't include user A's project
    const projectsB = await projectQueries.projects(null, {}, ctxBWithOrg);
    const projectIds = projectsB.map((p: { projectId: string }) => p.projectId);
    expect(projectIds).not.toContain(projectA.projectId);

    // Verify user A can still access their own project
    const resultA = await projectQueries.project(null, { projectId: projectA.projectId }, ctxAWithOrg);
    expect(resultA).not.toBeNull();
    expect(resultA!.projectId).toBe(projectA.projectId);
  });
});

describe('createOrg', () => {
  it('creates an org and attaches user as admin', async () => {
    // First create a user
    await signupUser('orguser@example.com', 'Password123');
    const user = await prisma.user.findUnique({ where: { email: 'orguser@example.com' } });
    expect(user).not.toBeNull();

    const ctx = makeContext({
      userId: user!.userId,
      email: user!.email,
      orgId: null,
      role: null,
      emailVerifiedAt: null,
    });

    const org = await orgMutations.createOrg(null, { name: 'Test Org' }, ctx);
    expect(org).toHaveProperty('orgId');
    expect(org.name).toBe('Test Org');

    // User should now be an admin of the org
    const updatedUser = await prisma.user.findUnique({ where: { userId: user!.userId } });
    expect(updatedUser!.orgId).toBe(org.orgId);
    expect(updatedUser!.role).toBe('org:admin');
  });
});
