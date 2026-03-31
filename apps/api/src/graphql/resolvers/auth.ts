import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { type Context } from '../context.js';
import { generateToken, hashToken } from '../../utils/token.js';
import {
  sendEmail,
  verifyEmailText,
  resetPasswordText,
  inviteText,
  buildVerifyEmailHtml,
  buildResetPasswordHtml,
  buildInviteHtml,
} from '../../utils/email.js';
import { decryptApiKey } from '../../utils/encryption.js';
import {
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../errors.js';
import { validatePassword } from '../../utils/passwordPolicy.js';
import { getPermissionsForProject } from '../../auth/permissions.js';
import { auditLog } from '../../utils/auditLog.js';
import { generateTokenPair, setAuthCookies, trackRefreshToken, hashRefreshToken } from '../../utils/tokenManager.js';

// ── Shared auth helpers (imported by other resolver modules) ──

export function requireAuth(context: Context) {
  if (!context.user) {
    throw new AuthenticationError();
  }
  return context.user;
}

export function requireOrg(context: Context) {
  const user = requireAuth(context);
  if (!user.orgId) {
    throw new AuthenticationError('No organization; create one first');
  }
  return user as typeof user & { orgId: string };
}

export async function requireProjectAccess(context: Context, projectId: string) {
  const user = requireOrg(context);
  const project = await context.prisma.project.findFirst({
    where: { projectId, orgId: user.orgId },
  });
  if (!project) {
    throw new NotFoundError('Project not found');
  }
  return { user, project };
}

export function requireApiKey(context: Context): string {
  requireOrg(context);
  const encrypted = context.org?.anthropicApiKeyEncrypted;
  if (!encrypted) {
    throw new ValidationError('No Anthropic API key configured. Add one in Settings.');
  }
  try {
    return decryptApiKey(encrypted);
  } catch {
    throw new ValidationError('Failed to decrypt API key. Re-enter your key in Settings.');
  }
}

// ── Auth queries ──

export const authQueries = {
  me: async (_parent: unknown, _args: unknown, context: Context) => {
    if (!context.user) return null;
    const user = await context.prisma.user.findUnique({ where: { userId: context.user.userId } });
    if (!user) return null;
    return { ...user, orgPlan: context.org?.plan ?? 'free' };
  },

  myPermissions: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    return getPermissionsForProject(context, args.projectId);
  },
};

// ── Auth mutations ──

export const authMutations = {
  signup: async (_parent: unknown, args: { email: string; password: string }, context: Context) => {
    const email = args.email.trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new ValidationError('Invalid email format');
    }
    const pwResult = validatePassword(args.password);
    if (!pwResult.valid) {
      throw new ValidationError(pwResult.errors.join('; '));
    }
    const existing = await context.prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Return identical response to prevent email enumeration
      return true;
    }
    const passwordHash = await bcrypt.hash(args.password, 10);
    const rawToken = generateToken();
    const verificationToken = hashToken(rawToken);
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await context.prisma.user.create({
      data: { email, passwordHash, verificationToken, verificationTokenExpiry },
    });
    // Send the raw (unhashed) token to the user via email
    await sendEmail(
      email,
      'Verify your TaskToad account',
      verifyEmailText(rawToken),
      buildVerifyEmailHtml(rawToken)
    );
    return true;
  },

  login: async (_parent: unknown, args: { email: string; password: string }, context: Context) => {
    const user = await context.prisma.user.findUnique({ where: { email: args.email } });
    if (!user) throw new AuthenticationError('Invalid email or password');
    const valid = await bcrypt.compare(args.password, user.passwordHash);
    if (!valid) throw new AuthenticationError('Invalid email or password');
    // Require email verification before allowing login — but only if SMTP is configured
    // (otherwise users would be permanently locked out with no way to verify)
    if (process.env.SMTP_HOST && !user.emailVerifiedAt) {
      const hasVerificationFlow = user.verificationToken || user.verificationTokenExpiry;
      if (hasVerificationFlow) {
        throw new ValidationError('Please verify your email before logging in. Check your inbox for a verification link.');
      }
    }
    const tokens = await generateTokenPair(user);
    await trackRefreshToken(
      context.prisma,
      user.userId,
      tokens.refreshToken,
      context.req?.headers['user-agent'] as string | undefined,
    );
    if (context.res) setAuthCookies(context.res, tokens);
    // Return token in body for backward compat during migration
    return { token: tokens.accessToken };
  },

  requestVerificationEmail: async (_parent: unknown, args: { email: string }, context: Context) => {
    const email = args.email.trim().toLowerCase();
    const user = await context.prisma.user.findUnique({ where: { email } });
    // Don't leak user existence — always return true
    if (!user || user.emailVerifiedAt) return true;
    // Rate limit: skip if a token was generated less than 2 minutes ago
    if (user.verificationTokenExpiry) {
      const tokenAge = Date.now() - (user.verificationTokenExpiry.getTime() - 24 * 60 * 60 * 1000);
      if (tokenAge < 2 * 60 * 1000) return true;
    }
    const rawToken = generateToken();
    const verificationToken = hashToken(rawToken);
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await context.prisma.user.update({
      where: { userId: user.userId },
      data: { verificationToken, verificationTokenExpiry },
    });
    await sendEmail(
      user.email,
      'Verify your TaskToad account',
      verifyEmailText(rawToken),
      buildVerifyEmailHtml(rawToken)
    );
    return true;
  },

  sendVerificationEmail: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireAuth(context);
    const dbUser = await context.prisma.user.findUnique({ where: { userId: user.userId } });
    if (!dbUser) throw new NotFoundError('User not found');
    if (dbUser.emailVerifiedAt) return true;
    const rawToken = generateToken();
    const verificationToken = hashToken(rawToken);
    const verificationTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    await context.prisma.user.update({
      where: { userId: user.userId },
      data: { verificationToken, verificationTokenExpiry },
    });
    await sendEmail(
      dbUser.email,
      'Verify your TaskToad account',
      verifyEmailText(rawToken),
      buildVerifyEmailHtml(rawToken)
    );
    return true;
  },

  verifyEmail: async (_parent: unknown, args: { token: string }, context: Context) => {
    const hashedToken = hashToken(args.token);
    const user = await context.prisma.user.findFirst({
      where: {
        verificationToken: hashedToken,
        verificationTokenExpiry: { gt: new Date() },
      },
    });
    if (!user) throw new ValidationError('Invalid or expired verification token');
    await context.prisma.user.update({
      where: { userId: user.userId },
      data: { emailVerifiedAt: new Date(), verificationToken: null, verificationTokenExpiry: null },
    });
    // Auto-login: generate tokens and set cookies (same pattern as login)
    const tokens = await generateTokenPair(user);
    await trackRefreshToken(
      context.prisma,
      user.userId,
      tokens.refreshToken,
      context.req?.headers['user-agent'] as string | undefined,
    );
    if (context.res) setAuthCookies(context.res, tokens);
    return { success: true, token: tokens.accessToken };
  },

  requestPasswordReset: async (_parent: unknown, args: { email: string }, context: Context) => {
    const user = await context.prisma.user.findUnique({ where: { email: args.email } });
    if (!user) return true; // silent - no enumeration
    const rawToken = generateToken();
    const resetToken = hashToken(rawToken);
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await context.prisma.user.update({
      where: { userId: user.userId },
      data: { resetToken, resetTokenExpiry },
    });
    // Send the raw (unhashed) token to the user via email
    await sendEmail(
      user.email,
      'Reset your TaskToad password',
      resetPasswordText(rawToken),
      buildResetPasswordHtml(rawToken)
    );
    return true;
  },

  resetPassword: async (_parent: unknown, args: { token: string; newPassword: string }, context: Context) => {
    const pwResult = validatePassword(args.newPassword);
    if (!pwResult.valid) {
      throw new ValidationError(pwResult.errors.join('; '));
    }
    const hashedToken = hashToken(args.token);
    const user = await context.prisma.user.findFirst({
      where: {
        resetToken: hashedToken,
        resetTokenExpiry: { gt: new Date() },
      },
    });
    if (!user) throw new ValidationError('Invalid or expired reset token');
    const passwordHash = await bcrypt.hash(args.newPassword, 10);
    await context.prisma.user.update({
      where: { userId: user.userId },
      data: { passwordHash, resetToken: null, resetTokenExpiry: null, tokenVersion: { increment: 1 } },
    });
    return true;
  },

  inviteOrgMember: async (_parent: unknown, args: { email: string; role?: string | null }, context: Context) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    const existingUser = await context.prisma.user.findUnique({ where: { email: args.email } });
    if (existingUser?.orgId) {
      throw new ConflictError('This email already belongs to an org member');
    }
    const rawToken = generateToken();
    const hashedToken = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 hours
    const role = args.role ?? 'org:member';
    await context.prisma.orgInvite.upsert({
      where: { token: hashedToken },
      update: {},
      create: {
        orgId: user.orgId,
        email: args.email,
        token: hashedToken,
        role,
        expiresAt,
      },
    });
    // If a prior invite exists for this email+org, replace it
    await context.prisma.orgInvite.deleteMany({
      where: {
        orgId: user.orgId,
        email: args.email,
        acceptedAt: null,
        token: { not: hashedToken },
      },
    });
    const org = await context.prisma.org.findUnique({ where: { orgId: user.orgId } });
    // Send the raw (unhashed) token to the user via email
    await sendEmail(
      args.email,
      `You're invited to join ${org?.name ?? 'TaskToad'}`,
      inviteText(org?.name ?? 'TaskToad', rawToken),
      buildInviteHtml(org?.name ?? 'TaskToad', rawToken)
    );
    auditLog(context.prisma, { orgId: user.orgId, userId: user.userId, action: 'member_invited', field: 'email', newValue: args.email });
    return true;
  },

  acceptInvite: async (_parent: unknown, args: { token: string; password?: string | null }, context: Context) => {
    const hashedToken = hashToken(args.token);
    const invite = await context.prisma.orgInvite.findUnique({ where: { token: hashedToken } });
    if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) {
      throw new ValidationError('Invalid or expired invite');
    }
    let userId: string;
    const existingUser = await context.prisma.user.findUnique({ where: { email: invite.email } });
    if (existingUser) {
      if (existingUser.orgId) {
        throw new ConflictError('Email already belongs to an org member');
      }
      await context.prisma.user.update({
        where: { userId: existingUser.userId },
        data: { orgId: invite.orgId, role: invite.role, emailVerifiedAt: new Date() },
      });
      userId = existingUser.userId;
    } else {
      if (!args.password) {
        throw new ValidationError('Password is required for new accounts');
      }
      const invitePwResult = validatePassword(args.password);
      if (!invitePwResult.valid) {
        throw new ValidationError(invitePwResult.errors.join('; '));
      }
      const passwordHash = await bcrypt.hash(args.password, 10);
      const newUser = await context.prisma.user.create({
        data: {
          email: invite.email,
          passwordHash,
          orgId: invite.orgId,
          role: invite.role,
          emailVerifiedAt: new Date(),
        },
      });
      userId = newUser.userId;
    }
    await context.prisma.orgInvite.update({
      where: { inviteId: invite.inviteId },
      data: { acceptedAt: new Date() },
    });
    const updatedUser = await context.prisma.user.findUnique({ where: { userId } });
    if (!updatedUser) throw new NotFoundError('User not found');
    const tokens = await generateTokenPair(updatedUser);
    await trackRefreshToken(
      context.prisma,
      updatedUser.userId,
      tokens.refreshToken,
      context.req?.headers['user-agent'] as string | undefined,
    );
    if (context.res) setAuthCookies(context.res, tokens);
    return { token: tokens.accessToken };
  },

  revokeInvite: async (_parent: unknown, args: { inviteId: string }, context: Context) => {
    const user = requireOrg(context);
    if (user.role !== 'org:admin') {
      throw new AuthorizationError('Admin role required');
    }
    const invite = await context.prisma.orgInvite.findUnique({ where: { inviteId: args.inviteId } });
    if (!invite || invite.orgId !== user.orgId) {
      throw new NotFoundError('Invite not found');
    }
    await context.prisma.orgInvite.delete({ where: { inviteId: args.inviteId } });
    auditLog(context.prisma, { orgId: user.orgId, userId: user.userId, action: 'invite_revoked' });
    return true;
  },

  logout: async (_parent: unknown, _args: unknown, context: Context) => {
    const user = requireAuth(context);
    await context.prisma.user.update({
      where: { userId: user.userId },
      data: { tokenVersion: { increment: 1 } },
    });
    // Delete the specific refresh token record for this session
    const refreshJwt = context.req?.cookies?.['tt-refresh'] as string | undefined;
    if (refreshJwt) {
      const tokenHash = hashRefreshToken(refreshJwt);
      await context.prisma.refreshToken.deleteMany({ where: { tokenHash } });
    }
    if (user.orgId) {
      auditLog(context.prisma, { orgId: user.orgId, userId: user.userId, action: 'user_logout' });
    }
    // Clear auth cookies
    if (context.res) {
      context.res.clearCookie('tt-access', { path: '/' });
      context.res.clearCookie('tt-refresh', { path: '/' });
    }
    return true;
  },

  updateProfile: async (
    _parent: unknown,
    args: { displayName?: string | null; avatarUrl?: string | null; timezone?: string | null },
    context: Context,
  ) => {
    const user = requireAuth(context);
    const data: Record<string, string | null> = {};

    if (args.displayName !== undefined) {
      data.displayName = args.displayName?.trim() || null;
    }
    if (args.avatarUrl !== undefined) {
      if (args.avatarUrl) {
        try {
          new URL(args.avatarUrl);
        } catch {
          throw new ValidationError('Invalid avatar URL');
        }
      }
      data.avatarUrl = args.avatarUrl || null;
    }
    if (args.timezone !== undefined) {
      if (args.timezone && args.timezone.trim().length === 0) {
        throw new ValidationError('Timezone must be a non-empty string');
      }
      data.timezone = args.timezone?.trim() || null;
    }

    return context.prisma.user.update({
      where: { userId: user.userId },
      data,
    });
  },
};

// ── Auth field resolvers ──

export const authFieldResolvers = {
  User: {
    emailVerifiedAt: (parent: { emailVerifiedAt: Date | null }) =>
      parent.emailVerifiedAt ? parent.emailVerifiedAt.toISOString() : null,
    avatarUrl: (parent: { avatarUrl: string | null; email: string }) => {
      if (parent.avatarUrl) return parent.avatarUrl;
      const hash = crypto.createHash('md5').update(parent.email.trim().toLowerCase()).digest('hex');
      return `https://gravatar.com/avatar/${hash}?d=identicon&s=80`;
    },
  },

  OrgInvite: {
    expiresAt: (parent: { expiresAt: Date }) => parent.expiresAt.toISOString(),
    createdAt: (parent: { createdAt: Date }) => parent.createdAt.toISOString(),
    acceptedAt: (parent: { acceptedAt: Date | null }) =>
      parent.acceptedAt ? parent.acceptedAt.toISOString() : null,
  },
};
