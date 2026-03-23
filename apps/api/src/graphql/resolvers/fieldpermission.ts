import type { Context } from '../context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requirePermission, Permission } from '../../auth/permissions.js';
import { requireLicense } from '../../utils/license.js';
import { requireProject } from '../../utils/resolverHelpers.js';

const VALID_FIELD_NAMES = ['priority', 'estimatedHours', 'storyPoints', 'dueDate', 'assigneeId'];
const VALID_ROLES = ['viewer', 'editor', 'admin'];

export const fieldPermissionQueries = {
  fieldPermissions: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context,
  ) => {
    requireLicense('field_permissions');
    await requireProject(context, args.projectId);
    const permissions = await context.prisma.fieldPermission.findMany({
      where: { projectId: args.projectId },
      orderBy: { fieldName: 'asc' },
    });
    return permissions.map((p) => ({
      ...p,
      allowedRoles: JSON.parse(p.allowedRoles) as string[],
      createdAt: p.createdAt.toISOString(),
    }));
  },
};

export const fieldPermissionMutations = {
  setFieldPermission: async (
    _parent: unknown,
    args: { projectId: string; fieldName: string; allowedRoles: string[] },
    context: Context,
  ) => {
    requireLicense('field_permissions');
    const { user } = await requireProject(context, args.projectId);
    await requirePermission(context, args.projectId, Permission.MANAGE_PROJECT_SETTINGS);

    if (!VALID_FIELD_NAMES.includes(args.fieldName)) {
      throw new ValidationError(
        `Invalid fieldName "${args.fieldName}". Valid: ${VALID_FIELD_NAMES.join(', ')}`,
      );
    }
    for (const role of args.allowedRoles) {
      if (!VALID_ROLES.includes(role)) {
        throw new ValidationError(
          `Invalid role "${role}". Valid: ${VALID_ROLES.join(', ')}`,
        );
      }
    }
    if (args.allowedRoles.length === 0) {
      throw new ValidationError('allowedRoles must not be empty');
    }

    const permission = await context.prisma.fieldPermission.upsert({
      where: {
        projectId_fieldName: { projectId: args.projectId, fieldName: args.fieldName },
      },
      create: {
        projectId: args.projectId,
        orgId: user.orgId,
        fieldName: args.fieldName,
        allowedRoles: JSON.stringify(args.allowedRoles),
      },
      update: {
        allowedRoles: JSON.stringify(args.allowedRoles),
      },
    });

    return {
      ...permission,
      allowedRoles: JSON.parse(permission.allowedRoles) as string[],
      createdAt: permission.createdAt.toISOString(),
    };
  },

  deleteFieldPermission: async (
    _parent: unknown,
    args: { projectId: string; fieldName: string },
    context: Context,
  ) => {
    requireLicense('field_permissions');
    await requireProject(context, args.projectId);
    await requirePermission(context, args.projectId, Permission.MANAGE_PROJECT_SETTINGS);

    const existing = await context.prisma.fieldPermission.findUnique({
      where: {
        projectId_fieldName: { projectId: args.projectId, fieldName: args.fieldName },
      },
    });
    if (!existing) {
      throw new NotFoundError('Field permission not found');
    }

    await context.prisma.fieldPermission.delete({
      where: {
        projectId_fieldName: { projectId: args.projectId, fieldName: args.fieldName },
      },
    });
    return true;
  },
};
