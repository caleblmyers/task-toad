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

  it('rejects duplicate email with ConflictError', async () => {
    await signupUser('dup@example.com', 'Password123');

    await expect(
      authMutations.signup(null, { email: 'dup@example.com', password: 'Password456' }, makeContext()),
    ).rejects.toThrow('Email already in use');
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
