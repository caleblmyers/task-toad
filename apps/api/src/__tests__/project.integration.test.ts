import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import {
  prisma,
  setupTestDatabase,
  cleanDatabase,
  teardownTestDatabase,
} from './setup.integration.js';
import { authMutations } from '../graphql/resolvers/auth.js';
import { projectQueries, projectMutations } from '../graphql/resolvers/project.js';
import type { Context } from '../graphql/context.js';
import { createLoaders } from '../graphql/loaders.js';

// ── Helpers ──

let orgId: string;
let userId: string;

function makeContext(overrides?: Partial<Context['user']>): Context {
  return {
    user: { userId, email: 'proj-test@example.com', orgId, role: 'org:admin', emailVerifiedAt: null, ...overrides },
    org: { orgId, name: 'Test Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, plan: 'free', createdAt: new Date(), trialEndsAt: null, stripeCustomerId: null, stripeSubscriptionId: null },
    prisma,
    loaders: createLoaders(prisma, null),
  };
}

function makeMemberContext(memberId: string, memberEmail: string): Context {
  return {
    user: { userId: memberId, email: memberEmail, orgId, role: 'org:member', emailVerifiedAt: null },
    org: { orgId, name: 'Test Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, plan: 'free', createdAt: new Date(), trialEndsAt: null, stripeCustomerId: null, stripeSubscriptionId: null },
    prisma,
    loaders: createLoaders(prisma, null),
  };
}

// ── Setup ──

beforeAll(async () => {
  await setupTestDatabase();
});

beforeEach(async () => {
  await cleanDatabase();

  // Create user + org
  await authMutations.signup(null, { email: 'proj-test@example.com', password: 'Password123' }, {
    user: null, org: null, prisma, loaders: createLoaders(prisma, null),
  } as Context);

  const user = await prisma.user.findUniqueOrThrow({ where: { email: 'proj-test@example.com' } });
  const org = await prisma.org.create({ data: { name: 'Test Org' } });
  await prisma.user.update({ where: { userId: user.userId }, data: { orgId: org.orgId, role: 'org:admin' } });

  orgId = org.orgId;
  userId = user.userId;
});

afterAll(async () => {
  await teardownTestDatabase();
});

// ── Tests ──

describe('createProject', () => {
  it('creates a project with correct name and orgId', async () => {
    const project = await projectMutations.createProject(null, { name: 'Test Project' }, makeContext());
    expect(project.name).toBe('Test Project');
    expect(project.orgId).toBe(orgId);

    const dbProject = await prisma.project.findUnique({ where: { projectId: project.projectId } });
    expect(dbProject).not.toBeNull();
    expect(dbProject!.name).toBe('Test Project');
  });

  it('rejects non-admin users with AuthorizationError', async () => {
    // Create a member user
    await authMutations.signup(null, { email: 'member@example.com', password: 'Password123' }, {
      user: null, org: null, prisma, loaders: createLoaders(prisma, null),
    } as Context);
    const member = await prisma.user.findUniqueOrThrow({ where: { email: 'member@example.com' } });
    await prisma.user.update({ where: { userId: member.userId }, data: { orgId, role: 'org:member' } });

    await expect(
      projectMutations.createProject(null, { name: 'Should Fail' }, makeMemberContext(member.userId, member.email)),
    ).rejects.toThrow('Admin role required');
  });

  it('rejects empty project name', async () => {
    await expect(
      projectMutations.createProject(null, { name: '' }, makeContext()),
    ).rejects.toThrow();
  });
});

describe('updateProject', () => {
  it('updates project name and description', async () => {
    const project = await projectMutations.createProject(null, { name: 'Original' }, makeContext());
    const updated = await projectMutations.updateProject(
      null,
      { projectId: project.projectId, name: 'Updated Name', description: 'A description' },
      makeContext(),
    );
    expect(updated.name).toBe('Updated Name');
    expect(updated.description).toBe('A description');
  });

  it('accepts valid statuses JSON array', async () => {
    const project = await projectMutations.createProject(null, { name: 'Status Project' }, makeContext());
    const updated = await projectMutations.updateProject(
      null,
      { projectId: project.projectId, statuses: '["todo","in_progress","done"]' },
      makeContext(),
    );
    expect(updated.statuses).toBe('["todo","in_progress","done"]');
  });

  it('rejects invalid statuses JSON', async () => {
    const project = await projectMutations.createProject(null, { name: 'Bad Status' }, makeContext());
    await expect(
      projectMutations.updateProject(
        null,
        { projectId: project.projectId, statuses: 'not-json' },
        makeContext(),
      ),
    ).rejects.toThrow('statuses must be a non-empty JSON array of strings');
  });
});

describe('archiveProject', () => {
  it('archives a project', async () => {
    const project = await projectMutations.createProject(null, { name: 'Archive Me' }, makeContext());
    const archived = await projectMutations.archiveProject(
      null,
      { projectId: project.projectId, archived: true },
      makeContext(),
    );
    expect(archived.archived).toBe(true);

    const dbProject = await prisma.project.findUnique({ where: { projectId: project.projectId } });
    expect(dbProject!.archived).toBe(true);
  });

  it('unarchives a project', async () => {
    const project = await projectMutations.createProject(null, { name: 'Unarchive Me' }, makeContext());
    await projectMutations.archiveProject(null, { projectId: project.projectId, archived: true }, makeContext());
    const unarchived = await projectMutations.archiveProject(
      null,
      { projectId: project.projectId, archived: false },
      makeContext(),
    );
    expect(unarchived.archived).toBe(false);
  });
});

describe('project query', () => {
  it('returns a project by projectId', async () => {
    const project = await projectMutations.createProject(null, { name: 'Query Me' }, makeContext());
    const result = await projectQueries.project(null, { projectId: project.projectId }, makeContext());
    expect(result).not.toBeNull();
    expect(result!.name).toBe('Query Me');
    expect(result!.projectId).toBe(project.projectId);
  });

  it('returns null for a project from another org', async () => {
    // Create project in the test org
    const project = await projectMutations.createProject(null, { name: 'Other Org Project' }, makeContext());

    // Create a second org + user
    await authMutations.signup(null, { email: 'other@example.com', password: 'Password123' }, {
      user: null, org: null, prisma, loaders: createLoaders(prisma, null),
    } as Context);
    const otherUser = await prisma.user.findUniqueOrThrow({ where: { email: 'other@example.com' } });
    const otherOrg = await prisma.org.create({ data: { name: 'Other Org' } });
    await prisma.user.update({ where: { userId: otherUser.userId }, data: { orgId: otherOrg.orgId, role: 'org:admin' } });

    const otherCtx: Context = {
      user: { userId: otherUser.userId, email: 'other@example.com', orgId: otherOrg.orgId, role: 'org:admin', emailVerifiedAt: null },
      org: { orgId: otherOrg.orgId, name: 'Other Org', anthropicApiKeyEncrypted: null, promptLoggingEnabled: true, monthlyBudgetCentsUSD: null, budgetAlertThreshold: 80, plan: 'free', createdAt: new Date(), trialEndsAt: null, stripeCustomerId: null, stripeSubscriptionId: null },
      prisma,
      loaders: createLoaders(prisma, null),
    };

    const result = await projectQueries.project(null, { projectId: project.projectId }, otherCtx);
    expect(result).toBeNull();
  });
});

describe('projects query', () => {
  it('lists projects for the org', async () => {
    await projectMutations.createProject(null, { name: 'Project A' }, makeContext());
    await projectMutations.createProject(null, { name: 'Project B' }, makeContext());

    const projects = await projectQueries.projects(null, {}, makeContext());
    expect(projects).toHaveLength(2);
  });

  it('excludes archived projects by default', async () => {
    const project = await projectMutations.createProject(null, { name: 'To Archive' }, makeContext());
    await projectMutations.createProject(null, { name: 'Keep' }, makeContext());
    await projectMutations.archiveProject(null, { projectId: project.projectId, archived: true }, makeContext());

    const projects = await projectQueries.projects(null, {}, makeContext());
    expect(projects).toHaveLength(1);
    expect(projects[0].name).toBe('Keep');
  });

  it('includes archived projects when includeArchived is true', async () => {
    const project = await projectMutations.createProject(null, { name: 'Archived' }, makeContext());
    await projectMutations.createProject(null, { name: 'Active' }, makeContext());
    await projectMutations.archiveProject(null, { projectId: project.projectId, archived: true }, makeContext());

    const projects = await projectQueries.projects(null, { includeArchived: true }, makeContext());
    expect(projects).toHaveLength(2);
  });
});
