import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../utils/logger.js';
import { calculateBusinessMs } from '../../utils/businessHours.js';
import { isPremiumEnabled } from '../../utils/license.js';

const log = createChildLogger('sla-breach-checker');

const CHECK_INTERVAL_MS = 5 * 60_000; // 5 minutes

export class SLABreachChecker {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private prisma: PrismaClient) {}

  start(): void {
    log.info('SLA breach checker started (every 5 minutes)');
    this.intervalId = setInterval(() => {
      this.checkBreaches().catch((err) => {
        log.error({ err }, 'Error checking SLA breaches');
      });
    }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('SLA breach checker stopped');
    }
  }

  private async checkBreaches(): Promise<void> {
    const now = new Date();

    // Find unresolved timers that haven't been flagged as breached yet
    const timers = await this.prisma.sLATimer.findMany({
      where: {
        resolvedAt: null,
        OR: [
          { responseBreached: false },
          { resolutionBreached: false },
        ],
      },
      include: { policy: true },
    });

    if (timers.length === 0) return;

    // Load org plans and filter to premium orgs only
    const orgIds = [...new Set(timers.map(t => t.orgId))];
    const orgs = await this.prisma.org.findMany({
      where: { orgId: { in: orgIds } },
      select: { orgId: true, plan: true },
    });
    const orgPlanMap = new Map(orgs.map(o => [o.orgId, o.plan]));
    const premiumTimers = timers.filter(t => isPremiumEnabled(orgPlanMap.get(t.orgId)));

    if (premiumTimers.length === 0) return;

    let breachCount = 0;

    for (const timer of premiumTimers) {
      const updates: Record<string, unknown> = {};

      // Calculate effective elapsed business time (minus paused time)
      const businessMs = calculateBusinessMs(timer.startedAt, now, {
        businessHoursStart: timer.policy.businessHoursStart,
        businessHoursEnd: timer.policy.businessHoursEnd,
        excludeWeekends: timer.policy.excludeWeekends,
      });

      // Subtract paused time and any currently-paused duration
      let pausedMs = timer.totalPausedMs;
      if (timer.pausedAt) {
        pausedMs += now.getTime() - timer.pausedAt.getTime();
      }
      const effectiveMs = Math.max(0, businessMs - pausedMs);

      // Check response breach (time from creation to first response)
      if (!timer.responseBreached && !timer.respondedAt) {
        const responseDeadlineMs = timer.policy.responseTimeHours * 3600_000;
        if (effectiveMs > responseDeadlineMs) {
          updates.responseBreached = true;
        }
      }

      // Check resolution breach (time from creation to resolution)
      if (!timer.resolutionBreached) {
        const resolutionDeadlineMs = timer.policy.resolutionTimeHours * 3600_000;
        if (effectiveMs > resolutionDeadlineMs) {
          updates.resolutionBreached = true;
        }
      }

      if (Object.keys(updates).length > 0) {
        await this.prisma.sLATimer.update({
          where: { slaTimerId: timer.slaTimerId },
          data: updates,
        });
        breachCount++;
      }
    }

    if (breachCount > 0) {
      log.info({ breachCount }, 'Flagged SLA breaches');
    }
  }
}
