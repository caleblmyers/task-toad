import type { Context } from '../graphql/context.js';
import { AuthorizationError } from '../graphql/errors.js';
import { requireOrg } from '../graphql/resolvers/auth.js';
import { isPremiumEnabled } from '../utils/license.js';

// ── Permission enum ──

export enum Permission {
  VIEW_TASKS = 'VIEW_TASKS',
  CREATE_TASKS = 'CREATE_TASKS',
  EDIT_TASKS = 'EDIT_TASKS',
  DELETE_TASKS = 'DELETE_TASKS',
  TRANSITION_TASKS = 'TRANSITION_TASKS',
  ASSIGN_TASKS = 'ASSIGN_TASKS',
  MANAGE_SPRINTS = 'MANAGE_SPRINTS',
  CLOSE_SPRINTS = 'CLOSE_SPRINTS',
  CREATE_COMMENTS = 'CREATE_COMMENTS',
  DELETE_COMMENTS = 'DELETE_COMMENTS',
  MANAGE_LABELS = 'MANAGE_LABELS',
  MANAGE_CUSTOM_FIELDS = 'MANAGE_CUSTOM_FIELDS',
  MANAGE_PROJECT_SETTINGS = 'MANAGE_PROJECT_SETTINGS',
  MANAGE_AUTOMATIONS = 'MANAGE_AUTOMATIONS',
  VIEW_REPORTS = 'VIEW_REPORTS',
  MANAGE_RELEASES = 'MANAGE_RELEASES',
  MANAGE_GITHUB = 'MANAGE_GITHUB',
  MANAGE_WEBHOOKS = 'MANAGE_WEBHOOKS',
  MANAGE_SLACK = 'MANAGE_SLACK',
  LOG_TIME = 'LOG_TIME',
  MANAGE_CAPACITY = 'MANAGE_CAPACITY',
  INVITE_MEMBERS = 'INVITE_MEMBERS',
  MANAGE_ORG_SETTINGS = 'MANAGE_ORG_SETTINGS',
}

// ── Role → Permission mapping ──

const ALL_PERMISSIONS = Object.values(Permission);

const PROJECT_ADMIN_PERMISSIONS = ALL_PERMISSIONS.filter(
  (p) => p !== Permission.INVITE_MEMBERS && p !== Permission.MANAGE_ORG_SETTINGS,
);

const PROJECT_EDITOR_PERMISSIONS: Permission[] = [
  Permission.VIEW_TASKS,
  Permission.CREATE_TASKS,
  Permission.EDIT_TASKS,
  Permission.TRANSITION_TASKS,
  Permission.ASSIGN_TASKS,
  Permission.CREATE_COMMENTS,
  Permission.LOG_TIME,
  Permission.VIEW_REPORTS,
];

const PROJECT_VIEWER_PERMISSIONS: Permission[] = [
  Permission.VIEW_TASKS,
  Permission.CREATE_COMMENTS,
  Permission.VIEW_REPORTS,
];

const DEFAULT_PERMISSIONS: Permission[] = [
  ...PROJECT_EDITOR_PERMISSIONS,
];

export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  admin: PROJECT_ADMIN_PERMISSIONS,
  editor: PROJECT_EDITOR_PERMISSIONS,
  viewer: PROJECT_VIEWER_PERMISSIONS,
};

// ── Permission check helper ──

/**
 * Verify the current user has a specific permission for a project.
 * org:admin bypasses all permission checks.
 * Users without a ProjectMember record get default viewer permissions.
 */
export async function requirePermission(
  context: Context,
  projectId: string,
  permission: Permission,
) {
  const user = requireOrg(context);

  // org:admin bypasses all permission checks
  if (user.role === 'org:admin') return user;

  // In open source mode, skip project role checks — all org members get default permissions
  if (!isPremiumEnabled(context.org?.plan)) return user;

  // Look up project membership
  const membership = await context.prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.userId } },
  });

  const effectiveRole = membership?.role ?? 'viewer';
  const permissions = ROLE_PERMISSIONS[effectiveRole] ?? DEFAULT_PERMISSIONS;

  if (!permissions.includes(permission)) {
    throw new AuthorizationError(`Missing permission: ${permission}`);
  }

  return user;
}

/**
 * Get all permissions for a user on a specific project.
 */
export async function getPermissionsForProject(
  context: Context,
  projectId: string,
): Promise<string[]> {
  const user = requireOrg(context);

  // org:admin gets all permissions
  if (user.role === 'org:admin') return [...ALL_PERMISSIONS];

  // In open source mode, all org members get default permissions
  if (!isPremiumEnabled(context.org?.plan)) return [...DEFAULT_PERMISSIONS];

  const membership = await context.prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: user.userId } },
  });

  const effectiveRole = membership?.role ?? 'viewer';
  return [...(ROLE_PERMISSIONS[effectiveRole] ?? DEFAULT_PERMISSIONS)];
}
