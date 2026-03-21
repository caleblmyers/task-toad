import type { PrismaClient } from '@prisma/client';
import { createChildLogger } from '../../utils/logger.js';

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

    let breachCount = 0;

    for (const timer of timers) {
      const updates: Record<string, unknown> = {};

      // Check response breach (time from creation to first response)
      if (!timer.responseBreached && !timer.respondedAt) {
        const responseDeadline = timer.startedAt.getTime() + timer.policy.responseTimeHours * 3600_000;
        if (now.getTime() > responseDeadline) {
          updates.responseBreached = true;
        }
      }

      // Check resolution breach (time from creation to resolution)
      if (!timer.resolutionBreached) {
        const resolutionDeadline = timer.startedAt.getTime() + timer.policy.resolutionTimeHours * 3600_000;
        if (now.getTime() > resolutionDeadline) {
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
