import bcrypt from 'bcryptjs';
import type { Context } from '../context.js';
import { encryptApiKey, decryptApiKey } from '../../utils/encryption.js';
import { AuthenticationError, AuthorizationError, ValidationError } from '../errors.js';
import { requireAuth, requireOrg } from './auth.js';

// ── Org queries ──

export const orgQueries = {
  org: (_parent: unknown, _args: unknown, context: Context) => {
    requireOrg(context);
    return context.org;
  },

  orgUsers: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);
    return context.prisma.user.findMany({
      where: { orgId: user.orgId },
      select: { userId: true, email: true, role: true },
    });
  },

  orgInvites: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    return context.prisma.orgInvite.findMany({
      where: { orgId: user.orgId, acceptedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  },
};

// ── Org mutations ──

export const orgMutations = {
  createOrg: async (_parent: unknown, args: { name: string; apiKey?: string | null }, context: Context) => {
    const user = requireAuth(context);
    if (user.orgId) {
      throw new ValidationError('You already belong to an organization. Leave your current org first.');
    }
    if (!args.name.trim()) {
      throw new ValidationError('Name is required');
    }
    const org = await context.prisma.org.create({
      data: {
        name: args.name,
        ...(args.apiKey ? { anthropicApiKeyEncrypted: encryptApiKey(args.apiKey) } : {}),
      },
    });
    await context.prisma.user.update({
      where: { userId: user.userId },
      data: { orgId: org.orgId, role: 'org:admin' },
    });
    return org;
  },

  setOrgApiKey: async (_parent: unknown, args: { apiKey: string; confirmPassword: string }, context: Context) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    const dbUser = await context.prisma.user.findUnique({
      where: { userId: user.userId },
      select: { passwordHash: true },
    });
    if (!dbUser) throw new AuthenticationError('User not found');
    const valid = await bcrypt.compare(args.confirmPassword, dbUser.passwordHash);
    if (!valid) throw new AuthenticationError('Invalid password');
    return context.prisma.org.update({
      where: { orgId: user.orgId },
      data: { anthropicApiKeyEncrypted: encryptApiKey(args.apiKey) },
    });
  },
};

// ── Org field resolvers ──

export const orgFieldResolvers = {
  Org: {
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    hasApiKey: (parent: { anthropicApiKeyEncrypted?: string | null }) => !!parent.anthropicApiKeyEncrypted,
    apiKeyHint: (parent: { anthropicApiKeyEncrypted?: string | null }) => {
      if (!parent.anthropicApiKeyEncrypted) return null;
      try {
        const plaintext = decryptApiKey(parent.anthropicApiKeyEncrypted);
        return `...${plaintext.slice(-4)}`;
      } catch {
        return null;
      }
    },
  },
};
