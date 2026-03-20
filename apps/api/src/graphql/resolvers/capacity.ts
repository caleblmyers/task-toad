import type { Context } from '../context.js';
import { NotFoundError, ValidationError } from '../errors.js';
import { requireOrg, requireProjectAccess } from './auth.js';

// ── Capacity queries ──

export const capacityQueries = {
  teamCapacity: async (
    _parent: unknown,
    args: { projectId: string },
    context: Context,
  ) => {
    const { user } = await requireProjectAccess(context, args.projectId);

    // Get all project members
    const members = await context.prisma.projectMember.findMany({
      where: { projectId: args.projectId },
      include: { user: { select: { userId: true, email: true } } },
    });

    const memberUserIds = members.map((m: typeof members[number]) => m.userId);

    // Fetch capacity records for those members
    const capacities = await context.prisma.userCapacity.findMany({
      where: { orgId: user.orgId, userId: { in: memberUserIds } },
      include: { user: { select: { email: true } } },
    });

    const capacityMap = new Map(
      capacities.map((c: typeof capacities[number]) => [c.userId, c]),
    );

    // Return capacity for each member, defaulting to 40 hrs/week
    return members.map((m: typeof members[number]) => {
      const cap = capacityMap.get(m.userId);
      return {
        userCapacityId: cap?.userCapacityId ?? '',
        userId: m.userId,
        userEmail: m.user.email,
        hoursPerWeek: cap?.hoursPerWeek ?? 40,
        createdAt: cap?.createdAt?.toISOString() ?? new Date().toISOString(),
      };
    });
  },

  teamCapacitySummary: async (
    _parent: unknown,
    args: { projectId: string; startDate: string; endDate: string },
    context: Context,
  ) => {
    const { user } = await requireProjectAccess(context, args.projectId);

    const rangeStart = new Date(args.startDate);
    const rangeEnd = new Date(args.endDate);
    if (isNaN(rangeStart.getTime()) || isNaN(rangeEnd.getTime())) {
      throw new ValidationError('Invalid date format. Use ISO date strings (YYYY-MM-DD).');
    }
    if (rangeEnd <= rangeStart) {
      throw new ValidationError('endDate must be after startDate');
    }

    // Get project members
    const members = await context.prisma.projectMember.findMany({
      where: { projectId: args.projectId },
      include: { user: { select: { userId: true, email: true } } },
    });

    const memberUserIds = members.map((m: typeof members[number]) => m.userId);

    // Fetch capacities
    const capacities = await context.prisma.userCapacity.findMany({
      where: { orgId: user.orgId, userId: { in: memberUserIds } },
    });
    const capacityMap = new Map(
      capacities.map((c: typeof capacities[number]) => [c.userId, c.hoursPerWeek]),
    );

    // Fetch time off overlapping with range
    const timeOffs = await context.prisma.userTimeOff.findMany({
      where: {
        orgId: user.orgId,
        userId: { in: memberUserIds },
        startDate: { lte: args.endDate },
        endDate: { gte: args.startDate },
      },
      include: { user: { select: { email: true } } },
    });

    // Group time off by user
    const timeOffByUser = new Map<string, typeof timeOffs>();
    for (const to of timeOffs) {
      const existing = timeOffByUser.get(to.userId) ?? [];
      existing.push(to);
      timeOffByUser.set(to.userId, existing);
    }

    // Calculate working days in range
    const totalWorkingDays = countWorkingDays(rangeStart, rangeEnd);

    let totalHoursPerWeek = 0;
    let totalAvailableHours = 0;

    const memberCapacities = members.map((m: typeof members[number]) => {
      const hoursPerWeek = capacityMap.get(m.userId) ?? 40;
      totalHoursPerWeek += hoursPerWeek;

      const userTimeOffs = timeOffByUser.get(m.userId) ?? [];
      const timeOffDays = countTimeOffWorkingDays(userTimeOffs, rangeStart, rangeEnd);

      const hoursPerDay = hoursPerWeek / 5;
      const availableHours = hoursPerDay * (totalWorkingDays - timeOffDays);

      totalAvailableHours += availableHours;

      return {
        userId: m.userId,
        userEmail: m.user.email,
        hoursPerWeek,
        timeOff: userTimeOffs.map((to: typeof userTimeOffs[number]) => ({
          userTimeOffId: to.userTimeOffId,
          userId: to.userId,
          userEmail: to.user.email,
          startDate: to.startDate,
          endDate: to.endDate,
          description: to.description,
          createdAt: to.createdAt.toISOString(),
        })),
        availableHours: Math.round(availableHours * 10) / 10,
      };
    });

    return {
      members: memberCapacities,
      totalHoursPerWeek,
      availableHoursInRange: Math.round(totalAvailableHours * 10) / 10,
    };
  },

  userTimeOffs: async (
    _parent: unknown,
    args: { userId?: string | null },
    context: Context,
  ) => {
    const user = requireOrg(context);
    const targetUserId = args.userId ?? user.userId;

    const timeOffs = await context.prisma.userTimeOff.findMany({
      where: { orgId: user.orgId, userId: targetUserId },
      include: { user: { select: { email: true } } },
      orderBy: { startDate: 'asc' },
    });

    return timeOffs.map((to: typeof timeOffs[number]) => ({
      userTimeOffId: to.userTimeOffId,
      userId: to.userId,
      userEmail: to.user.email,
      startDate: to.startDate,
      endDate: to.endDate,
      description: to.description,
      createdAt: to.createdAt.toISOString(),
    }));
  },
};

// ── Capacity mutations ──

export const capacityMutations = {
  setUserCapacity: async (
    _parent: unknown,
    args: { userId: string; hoursPerWeek: number },
    context: Context,
  ) => {
    const user = requireOrg(context);

    if (args.hoursPerWeek < 1 || args.hoursPerWeek > 168) {
      throw new ValidationError('hoursPerWeek must be between 1 and 168');
    }

    // Verify target user is in the same org
    const targetUser = await context.prisma.user.findUnique({
      where: { userId: args.userId },
    });
    if (!targetUser || targetUser.orgId !== user.orgId) {
      throw new NotFoundError('User not found in this organization');
    }

    const capacity = await context.prisma.userCapacity.upsert({
      where: { orgId_userId: { orgId: user.orgId, userId: args.userId } },
      update: { hoursPerWeek: args.hoursPerWeek },
      create: {
        orgId: user.orgId,
        userId: args.userId,
        hoursPerWeek: args.hoursPerWeek,
      },
      include: { user: { select: { email: true } } },
    });

    return {
      userCapacityId: capacity.userCapacityId,
      userId: capacity.userId,
      userEmail: capacity.user.email,
      hoursPerWeek: capacity.hoursPerWeek,
      createdAt: capacity.createdAt.toISOString(),
    };
  },

  addTimeOff: async (
    _parent: unknown,
    args: { userId: string; startDate: string; endDate: string; description?: string | null },
    context: Context,
  ) => {
    const user = requireOrg(context);

    // Validate dates
    const start = new Date(args.startDate);
    const end = new Date(args.endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new ValidationError('Invalid date format. Use ISO date strings (YYYY-MM-DD).');
    }
    if (end < start) {
      throw new ValidationError('endDate must not be before startDate');
    }

    // Verify target user is in the same org
    const targetUser = await context.prisma.user.findUnique({
      where: { userId: args.userId },
    });
    if (!targetUser || targetUser.orgId !== user.orgId) {
      throw new NotFoundError('User not found in this organization');
    }

    const timeOff = await context.prisma.userTimeOff.create({
      data: {
        orgId: user.orgId,
        userId: args.userId,
        startDate: args.startDate,
        endDate: args.endDate,
        description: args.description ?? null,
      },
      include: { user: { select: { email: true } } },
    });

    return {
      userTimeOffId: timeOff.userTimeOffId,
      userId: timeOff.userId,
      userEmail: timeOff.user.email,
      startDate: timeOff.startDate,
      endDate: timeOff.endDate,
      description: timeOff.description,
      createdAt: timeOff.createdAt.toISOString(),
    };
  },

  removeTimeOff: async (
    _parent: unknown,
    args: { userTimeOffId: string },
    context: Context,
  ) => {
    const user = requireOrg(context);

    const timeOff = await context.prisma.userTimeOff.findUnique({
      where: { userTimeOffId: args.userTimeOffId },
    });
    if (!timeOff) {
      throw new NotFoundError('Time off entry not found');
    }
    if (timeOff.orgId !== user.orgId) {
      throw new NotFoundError('Time off entry not found');
    }

    await context.prisma.userTimeOff.delete({
      where: { userTimeOffId: args.userTimeOffId },
    });

    return true;
  },
};

// ── Helpers ──

/** Count working days (Mon-Fri) between two dates, inclusive. */
function countWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

/** Count working days of time off that overlap with the given range. */
function countTimeOffWorkingDays(
  timeOffs: Array<{ startDate: string; endDate: string }>,
  rangeStart: Date,
  rangeEnd: Date,
): number {
  let totalDays = 0;
  for (const to of timeOffs) {
    const toStart = new Date(to.startDate);
    const toEnd = new Date(to.endDate);
    // Clamp to range
    const effectiveStart = toStart > rangeStart ? toStart : rangeStart;
    const effectiveEnd = toEnd < rangeEnd ? toEnd : rangeEnd;
    if (effectiveStart <= effectiveEnd) {
      totalDays += countWorkingDays(effectiveStart, effectiveEnd);
    }
  }
  return totalDays;
}
