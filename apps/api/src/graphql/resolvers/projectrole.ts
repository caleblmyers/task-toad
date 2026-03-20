import { z } from 'zod';
import type { Context } from '../context.js';
import { NotFoundError, ValidationError, AuthorizationError } from '../errors.js';
import { requireProjectAccess } from './auth.js';

const VALID_ROLES: readonly string[] = ['viewer', 'editor', 'admin'];

function safeParseJSON(value: string, fieldName: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    throw new ValidationError(`${fieldName} must be valid JSON`);
  }
}

const TriggerSchema = z.object({
  event: z.string(),
  condition: z.record(z.string(), z.unknown()).optional(),
});

const ActionSchema = z.object({
  type: z.enum(['notify_assignee', 'move_to_column', 'set_status', 'assign_to']),
  column: z.string().optional(),
  status: z.string().optional(),
  userId: z.string().optional(),
});

async function requireProjectAdmin(context: Context, projectId: string) {
  const { user, project } = await requireProjectAccess(context, projectId);
  // org:admin always has project admin access
  if (user.role === 'org:admin') return { user, project };
  // Check project-level role
  const membership = await context.prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.userId } },
  });
  if (!membership || membership.role !== 'admin') {
    throw new AuthorizationError('Project admin role required');
  }
  return { user, project };
}

// ── Project role queries ──

export const projectRoleQueries = {
  projectMembers: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    const members = await context.prisma.projectMember.findMany({
      where: { projectId: args.projectId },
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return members.map((m: typeof members[number]) => ({
      id: m.id,
      userId: m.userId,
      email: m.user.email,
      role: m.role,
      createdAt: m.createdAt.toISOString(),
    }));
  },

  automationRules: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    const { user } = await requireProjectAccess(context, args.projectId);
    const rules = await context.prisma.automationRule.findMany({
      where: { projectId: args.projectId, orgId: user.orgId },
      orderBy: { createdAt: 'asc' },
    });
    return rules.map((r: typeof rules[number]) => ({
      ...r,
      createdAt: r.createdAt.toISOString(),
    }));
  },
};

// ── Project role mutations ──

export const projectRoleMutations = {
  addProjectMember: async (
    _parent: unknown,
    args: { projectId: string; userId: string; role?: string | null },
    context: Context,
  ) => {
    await requireProjectAdmin(context, args.projectId);
    const role = args.role ?? 'editor';
    if (!VALID_ROLES.includes(role as typeof VALID_ROLES[number])) {
      throw new ValidationError(`Invalid role "${role}". Valid: ${VALID_ROLES.join(', ')}`);
    }
    // Ensure user is in the same org
    const { user } = await requireProjectAccess(context, args.projectId);
    const targetUser = await context.prisma.user.findUnique({ where: { userId: args.userId } });
    if (!targetUser || targetUser.orgId !== user.orgId) {
      throw new NotFoundError('User not found in this organization');
    }
    const member = await context.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId: args.projectId, userId: args.userId } },
      update: { role },
      create: { projectId: args.projectId, userId: args.userId, role },
      include: { user: { select: { email: true } } },
    });
    return {
      id: member.id,
      userId: member.userId,
      email: member.user.email,
      role: member.role,
      createdAt: member.createdAt.toISOString(),
    };
  },

  removeProjectMember: async (
    _parent: unknown,
    args: { projectId: string; userId: string },
    context: Context,
  ) => {
    await requireProjectAdmin(context, args.projectId);
    const member = await context.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: args.projectId, userId: args.userId } },
    });
    if (!member) throw new NotFoundError('Member not found');
    // Prevent removing the last admin
    if (member.role === 'admin') {
      const adminCount = await context.prisma.projectMember.count({
        where: { projectId: args.projectId, role: 'admin' },
      });
      if (adminCount <= 1) {
        throw new ValidationError('Cannot remove the last project admin');
      }
    }
    await context.prisma.projectMember.delete({
      where: { projectId_userId: { projectId: args.projectId, userId: args.userId } },
    });
    return true;
  },

  updateProjectMemberRole: async (
    _parent: unknown,
    args: { projectId: string; userId: string; role: string },
    context: Context,
  ) => {
    await requireProjectAdmin(context, args.projectId);
    if (!VALID_ROLES.includes(args.role as typeof VALID_ROLES[number])) {
      throw new ValidationError(`Invalid role "${args.role}". Valid: ${VALID_ROLES.join(', ')}`);
    }
    const member = await context.prisma.projectMember.findUnique({
      where: { projectId_userId: { projectId: args.projectId, userId: args.userId } },
    });
    if (!member) throw new NotFoundError('Member not found');
    const updated = await context.prisma.projectMember.update({
      where: { projectId_userId: { projectId: args.projectId, userId: args.userId } },
      data: { role: args.role },
      include: { user: { select: { email: true } } },
    });
    return {
      id: updated.id,
      userId: updated.userId,
      email: updated.user.email,
      role: updated.role,
      createdAt: updated.createdAt.toISOString(),
    };
  },

  createAutomationRule: async (
    _parent: unknown,
    args: { projectId: string; name: string; trigger: string; action: string },
    context: Context,
  ) => {
    const { user } = await requireProjectAdmin(context, args.projectId);
    // Validate JSON structure
    const triggerResult = TriggerSchema.safeParse(safeParseJSON(args.trigger, 'trigger'));
    if (!triggerResult.success) {
      throw new ValidationError(`Invalid trigger: ${triggerResult.error.message}`);
    }
    const actionResult = ActionSchema.safeParse(safeParseJSON(args.action, 'action'));
    if (!actionResult.success) {
      throw new ValidationError(`Invalid action: ${actionResult.error.message}`);
    }
    const rule = await context.prisma.automationRule.create({
      data: {
        projectId: args.projectId,
        orgId: user.orgId,
        name: args.name,
        trigger: args.trigger,
        action: args.action,
      },
    });
    return { ...rule, createdAt: rule.createdAt.toISOString() };
  },

  updateAutomationRule: async (
    _parent: unknown,
    args: { ruleId: string; name?: string | null; trigger?: string | null; action?: string | null; enabled?: boolean | null },
    context: Context,
  ) => {
    const rule = await context.prisma.automationRule.findUnique({ where: { id: args.ruleId } });
    if (!rule) throw new NotFoundError('Automation rule not found');
    const { user: updateUser } = await requireProjectAdmin(context, rule.projectId);
    if (rule.orgId !== updateUser.orgId) {
      throw new AuthorizationError('Rule does not belong to your organization');
    }

    if (args.trigger !== undefined && args.trigger !== null) {
      const triggerResult = TriggerSchema.safeParse(safeParseJSON(args.trigger, 'trigger'));
      if (!triggerResult.success) {
        throw new ValidationError(`Invalid trigger: ${triggerResult.error.message}`);
      }
    }
    if (args.action !== undefined && args.action !== null) {
      const actionResult = ActionSchema.safeParse(safeParseJSON(args.action, 'action'));
      if (!actionResult.success) {
        throw new ValidationError(`Invalid action: ${actionResult.error.message}`);
      }
    }

    const updated = await context.prisma.automationRule.update({
      where: { id: args.ruleId },
      data: {
        ...(args.name !== undefined && args.name !== null ? { name: args.name } : {}),
        ...(args.trigger !== undefined && args.trigger !== null ? { trigger: args.trigger } : {}),
        ...(args.action !== undefined && args.action !== null ? { action: args.action } : {}),
        ...(args.enabled !== undefined && args.enabled !== null ? { enabled: args.enabled } : {}),
      },
    });
    return { ...updated, createdAt: updated.createdAt.toISOString() };
  },

  deleteAutomationRule: async (
    _parent: unknown,
    args: { ruleId: string },
    context: Context,
  ) => {
    const rule = await context.prisma.automationRule.findUnique({ where: { id: args.ruleId } });
    if (!rule) throw new NotFoundError('Automation rule not found');
    const { user: deleteUser } = await requireProjectAdmin(context, rule.projectId);
    if (rule.orgId !== deleteUser.orgId) {
      throw new AuthorizationError('Rule does not belong to your organization');
    }
    await context.prisma.automationRule.delete({ where: { id: args.ruleId } });
    return true;
  },
};
