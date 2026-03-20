import { GraphQLError } from 'graphql';
import type { Context } from '../../context.js';
import { requireOrg, requireProjectAccess } from '../auth.js';
import { requireTask } from '../../../utils/resolverHelpers.js';

// ── Filter types ──

export interface FilterConditionInput {
  field: string;
  operator: string;
  value?: string | null;
}

export interface FilterGroupInput {
  operator: string;
  conditions?: FilterConditionInput[] | null;
  groups?: FilterGroupInput[] | null;
}

export interface TaskFilterInput {
  status?: string[] | null;
  priority?: string[] | null;
  assigneeId?: string[] | null;
  labelIds?: string[] | null;
  search?: string | null;
  showArchived?: boolean | null;
  epicId?: string | null;
  sprintId?: string | null;
  dueDateFrom?: string | null;
  dueDateTo?: string | null;
  sortBy?: string | null;
  sortOrder?: string | null;
  filterGroup?: FilterGroupInput | null;
}

// ── Compound filter translation ──

const ALLOWED_FILTER_FIELDS = new Set([
  'status', 'priority', 'assignee', 'label', 'taskType',
  'dueDate', 'estimatedHours', 'storyPoints', 'sprintId', 'search',
]);

const ALLOWED_OPERATORS = new Set([
  'eq', 'neq', 'in', 'not_in', 'gt', 'lt', 'gte', 'lte',
  'contains', 'is_empty', 'is_not_empty',
]);

function translateCondition(condition: FilterConditionInput): Record<string, unknown> {
  const { field, operator, value } = condition;

  if (!ALLOWED_FILTER_FIELDS.has(field)) {
    throw new GraphQLError(`Unknown filter field: ${field}`);
  }
  if (!ALLOWED_OPERATORS.has(operator)) {
    throw new GraphQLError(`Unknown filter operator: ${operator}`);
  }

  switch (field) {
    case 'status':
    case 'priority':
    case 'taskType': {
      const dbField = field === 'taskType' ? 'taskType' : field;
      switch (operator) {
        case 'eq': return { [dbField]: value };
        case 'neq': return { [dbField]: { not: value } };
        case 'in': return { [dbField]: { in: JSON.parse(value!) } };
        case 'not_in': return { [dbField]: { notIn: JSON.parse(value!) } };
        case 'is_empty': return { [dbField]: null };
        case 'is_not_empty': return { [dbField]: { not: null } };
        default: throw new GraphQLError(`Operator '${operator}' not supported for field '${field}'`);
      }
    }

    case 'assignee': {
      switch (operator) {
        case 'eq': return { assigneeId: value };
        case 'neq': return { assigneeId: { not: value } };
        case 'in': return { assigneeId: { in: JSON.parse(value!) } };
        case 'not_in': return { assigneeId: { notIn: JSON.parse(value!) } };
        case 'is_empty': return { assigneeId: null };
        case 'is_not_empty': return { assigneeId: { not: null } };
        default: throw new GraphQLError(`Operator '${operator}' not supported for field 'assignee'`);
      }
    }

    case 'label': {
      switch (operator) {
        case 'eq': return { labels: { some: { labelId: value } } };
        case 'neq': return { labels: { none: { labelId: value } } };
        case 'in': return { labels: { some: { labelId: { in: JSON.parse(value!) } } } };
        case 'is_empty': return { labels: { none: {} } };
        case 'is_not_empty': return { labels: { some: {} } };
        default: throw new GraphQLError(`Operator '${operator}' not supported for field 'label'`);
      }
    }

    case 'dueDate': {
      switch (operator) {
        case 'eq': return { dueDate: value };
        case 'lt': return { dueDate: { lt: value } };
        case 'gt': return { dueDate: { gt: value } };
        case 'lte': return { dueDate: { lte: value } };
        case 'gte': return { dueDate: { gte: value } };
        case 'is_empty': return { dueDate: null };
        case 'is_not_empty': return { dueDate: { not: null } };
        default: throw new GraphQLError(`Operator '${operator}' not supported for field 'dueDate'`);
      }
    }

    case 'estimatedHours':
    case 'storyPoints': {
      const numValue = value != null ? parseFloat(value) : undefined;
      switch (operator) {
        case 'eq': return { [field]: numValue };
        case 'neq': return { [field]: { not: numValue } };
        case 'gt': return { [field]: { gt: numValue } };
        case 'lt': return { [field]: { lt: numValue } };
        case 'gte': return { [field]: { gte: numValue } };
        case 'lte': return { [field]: { lte: numValue } };
        case 'is_empty': return { [field]: null };
        case 'is_not_empty': return { [field]: { not: null } };
        default: throw new GraphQLError(`Operator '${operator}' not supported for field '${field}'`);
      }
    }

    case 'sprintId': {
      switch (operator) {
        case 'eq': return { sprintId: value };
        case 'neq': return { sprintId: { not: value } };
        case 'in': return { sprintId: { in: JSON.parse(value!) } };
        case 'is_empty': return { sprintId: null };
        case 'is_not_empty': return { sprintId: { not: null } };
        default: throw new GraphQLError(`Operator '${operator}' not supported for field 'sprintId'`);
      }
    }

    case 'search': {
      if (operator !== 'contains') {
        throw new GraphQLError(`Operator '${operator}' not supported for field 'search'`);
      }
      return {
        OR: [
          { title: { contains: value, mode: 'insensitive' } },
          { description: { contains: value, mode: 'insensitive' } },
        ],
      };
    }

    default:
      throw new GraphQLError(`Unknown filter field: ${field}`);
  }
}

function countConditions(group: FilterGroupInput): number {
  let count = group.conditions?.length ?? 0;
  if (group.groups) {
    for (const sub of group.groups) {
      count += countConditions(sub);
    }
  }
  return count;
}

function validateFilterGroup(group: FilterGroupInput): void {
  const totalConditions = countConditions(group);
  if (totalConditions > 50) {
    throw new GraphQLError(`Filter group has ${totalConditions} conditions, maximum is 50`);
  }

  function checkDepth(g: FilterGroupInput, depth: number): void {
    if (depth > 5) {
      throw new GraphQLError('Filter group nesting exceeds maximum depth of 5');
    }
    if (g.groups) {
      for (const sub of g.groups) {
        checkDepth(sub, depth + 1);
      }
    }
  }
  checkDepth(group, 1);
}

export function translateFilterGroup(group: FilterGroupInput): Record<string, unknown> {
  validateFilterGroup(group);

  const op = group.operator.toUpperCase();
  if (op !== 'AND' && op !== 'OR') {
    throw new GraphQLError(`Invalid group operator: '${group.operator}', must be 'AND' or 'OR'`);
  }

  const parts: Record<string, unknown>[] = [];

  if (group.conditions) {
    for (const condition of group.conditions) {
      parts.push(translateCondition(condition));
    }
  }

  if (group.groups) {
    for (const subGroup of group.groups) {
      parts.push(translateFilterGroup(subGroup));
    }
  }

  if (parts.length === 0) return {};
  if (parts.length === 1 && op === 'AND') return parts[0];

  return { [op]: parts };
}

const ALLOWED_SORT_FIELDS = new Set(['position', 'createdAt', 'dueDate', 'priority', 'title', 'status']);

function buildFilterWhere(
  projectId: string,
  filter: TaskFilterInput | null | undefined,
  parentTaskId: string | null | undefined,
): Record<string, unknown> {
  // When parentTaskId is explicitly provided, fetch subtasks (SUBTASKS_QUERY)
  if (parentTaskId !== undefined) {
    return { projectId, parentTaskId };
  }

  const where: Record<string, unknown> = { projectId, taskType: { notIn: ['epic', 'initiative'] } };
  // Collect AND conditions — used for label AND logic and combining OR groups
  const andConditions: Record<string, unknown>[] = [];

  if (!filter) return where;

  // Archived filter — default: exclude archived
  if (!filter.showArchived) {
    where.archived = false;
  }

  // Status filter
  if (filter.status && filter.status.length > 0) {
    where.status = { in: filter.status };
  }

  // Priority filter
  if (filter.priority && filter.priority.length > 0) {
    where.priority = { in: filter.priority };
  }

  // Assignee filter — special handling for "unassigned"
  if (filter.assigneeId && filter.assigneeId.length > 0) {
    const hasUnassigned = filter.assigneeId.includes('unassigned');
    const realIds = filter.assigneeId.filter((id) => id !== 'unassigned');
    if (hasUnassigned && realIds.length > 0) {
      andConditions.push({ OR: [{ assigneeId: null }, { assigneeId: { in: realIds } }] });
    } else if (hasUnassigned) {
      where.assigneeId = null;
    } else {
      where.assigneeId = { in: realIds };
    }
  }

  // Label filter — AND logic: task must have ALL listed labels
  if (filter.labelIds && filter.labelIds.length > 0) {
    for (const labelId of filter.labelIds) {
      andConditions.push({ labels: { some: { labelId } } });
    }
  }

  // Search — case-insensitive on title and description
  if (filter.search && filter.search.trim()) {
    const term = filter.search.trim();
    andConditions.push({
      OR: [
        { title: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ],
    });
  }

  // Epic filter
  if (filter.epicId) {
    where.parentTaskId = filter.epicId;
  }

  // Sprint filter
  if (filter.sprintId) {
    where.sprintId = filter.sprintId;
  }

  // Due date range
  if (filter.dueDateFrom || filter.dueDateTo) {
    const dueDateFilter: Record<string, string> = {};
    if (filter.dueDateFrom) dueDateFilter.gte = filter.dueDateFrom;
    if (filter.dueDateTo) dueDateFilter.lte = filter.dueDateTo;
    where.dueDate = dueDateFilter;
  }

  // Compound filter group — merge with flat filters via AND
  if (filter.filterGroup) {
    const groupWhere = translateFilterGroup(filter.filterGroup);
    if (Object.keys(groupWhere).length > 0) {
      andConditions.push(groupWhere);
    }
  }

  if (andConditions.length > 0) {
    where.AND = andConditions;
  }

  return where;
}

function buildOrderBy(filter: TaskFilterInput | null | undefined): Record<string, string>[] {
  if (filter?.sortBy && ALLOWED_SORT_FIELDS.has(filter.sortBy)) {
    const order = filter.sortOrder === 'desc' ? 'desc' : 'asc';
    return [{ [filter.sortBy]: order }];
  }
  return [{ position: 'asc' }, { createdAt: 'asc' }];
}

// ── Task queries ──

export const taskQueries = {
  tasks: async (
    _parent: unknown,
    args: {
      projectId: string;
      filter?: TaskFilterInput | null;
      parentTaskId?: string | null;
      limit?: number | null;
      offset?: number | null;
    },
    context: Context
  ) => {
    await requireProjectAccess(context, args.projectId);
    const limit = Math.max(0, Math.min(args.limit ?? 100, 1000));
    const offset = Math.max(0, args.offset ?? 0);

    const where = buildFilterWhere(args.projectId, args.filter, args.parentTaskId);
    const orderBy = buildOrderBy(args.filter);

    const [tasks, total] = await Promise.all([
      context.prisma.task.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
      }),
      context.prisma.task.count({ where }),
    ]);
    return { tasks, hasMore: offset + limit < total, total };
  },

  comments: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    await requireTask(context, args.taskId);
    const comments = await context.prisma.comment.findMany({
      where: { taskId: args.taskId, parentCommentId: null },
      include: { user: { select: { email: true } }, replies: { include: { user: { select: { email: true } } }, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    return comments.map((c: typeof comments[number]) => ({
      ...c,
      userEmail: c.user.email,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
      replies: c.replies.map((r: typeof c.replies[number]) => ({
        ...r,
        userEmail: r.user.email,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        replies: [],
      })),
    }));
  },

  activities: async (_parent: unknown, args: { projectId?: string | null; taskId?: string | null; limit?: number | null; cursor?: string | null }, context: Context) => {
    const user = requireOrg(context);
    const where: Record<string, unknown> = { orgId: user.orgId };
    if (args.projectId) where.projectId = args.projectId;
    if (args.taskId) where.taskId = args.taskId;
    const limit = args.limit ?? 50;
    const activities = await context.prisma.activity.findMany({
      where,
      include: { user: { select: { email: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(args.cursor ? { cursor: { activityId: args.cursor }, skip: 1 } : {}),
    });
    const hasMore = activities.length > limit;
    const items = hasMore ? activities.slice(0, limit) : activities;
    const nextCursor = hasMore ? items[items.length - 1].activityId : null;
    return {
      activities: items.map((a: typeof activities[number]) => ({
        ...a,
        userEmail: a.user.email,
        createdAt: a.createdAt.toISOString(),
      })),
      hasMore,
      nextCursor,
    };
  },

  epics: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    return context.prisma.task.findMany({
      where: { projectId: args.projectId, taskType: { in: ['epic', 'initiative'] }, parentTaskId: null, archived: false },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  },

  taskWatchers: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    await requireTask(context, args.taskId);
    const watchers = await context.prisma.taskWatcher.findMany({
      where: { taskId: args.taskId },
      include: { user: true },
    });
    return watchers.map((w) => ({
      id: w.id,
      user: w.user,
      watchedAt: w.watchedAt.toISOString(),
    }));
  },

  customFields: async (_parent: unknown, args: { projectId: string }, context: Context) => {
    await requireProjectAccess(context, args.projectId);
    return context.prisma.customField.findMany({
      where: { projectId: args.projectId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  },

  taskAncestors: async (_parent: unknown, args: { taskId: string }, context: Context) => {
    const { task } = await requireTask(context, args.taskId);
    const ancestors = [];
    let currentParentId = task.parentTaskId;
    const maxDepth = 10; // safety limit
    let depth = 0;
    while (currentParentId && depth < maxDepth) {
      const parent = await context.prisma.task.findUnique({ where: { taskId: currentParentId } });
      if (!parent) break;
      ancestors.push(parent);
      currentParentId = parent.parentTaskId;
      depth++;
    }
    // Return from root to immediate parent (reverse order)
    return ancestors.reverse();
  },
};
