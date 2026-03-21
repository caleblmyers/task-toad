import type { PrismaClient } from '@prisma/client';
import { CronExpressionParser } from 'cron-parser';
import { createChildLogger } from '../../utils/logger.js';
import { executeAutomations } from '../../utils/automationEngine.js';

const log = createChildLogger('cron-scheduler');

const CHECK_INTERVAL_MS = 60_000; // Check every minute

export class CronScheduler {
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor(private prisma: PrismaClient) {}

  start(): void {
    log.info('Cron scheduler started');
    // Run immediately on startup, then every minute
    this.checkDueRules().catch((err) => {
      log.error({ err }, 'Error in initial cron check');
    });
    this.intervalId = setInterval(() => {
      this.checkDueRules().catch((err) => {
        log.error({ err }, 'Error checking cron rules');
      });
    }, CHECK_INTERVAL_MS);
  }

  stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      log.info('Cron scheduler stopped');
    }
  }

  private async checkDueRules(): Promise<void> {
    const now = new Date();

    const dueRules = await this.prisma.automationRule.findMany({
      where: {
        cronExpression: { not: null },
        enabled: true,
        nextRunAt: { lte: now },
      },
    });

    if (dueRules.length === 0) return;
    log.info({ count: dueRules.length }, 'Found due cron rules');

    for (const rule of dueRules) {
      try {
        // Execute the rule's actions against matching tasks in the project
        const trigger = JSON.parse(rule.trigger) as { event?: string; condition?: unknown };
        executeAutomations(this.prisma, {
          type: trigger.event ?? 'scheduled',
          projectId: rule.projectId,
          orgId: rule.orgId,
          data: { scheduled: true, cronExpression: rule.cronExpression },
        });

        // Compute next run time
        const tz = rule.timezone ?? 'UTC';
        let nextRunAt: Date | null = null;
        try {
          const expr = CronExpressionParser.parse(rule.cronExpression!, { tz });
          nextRunAt = expr.next().toDate();
        } catch {
          log.warn({ ruleId: rule.id, cronExpression: rule.cronExpression }, 'Invalid cron expression — disabling rule');
        }

        await this.prisma.automationRule.update({
          where: { id: rule.id },
          data: {
            lastRunAt: now,
            nextRunAt,
            ...(nextRunAt === null ? { enabled: false } : {}),
          },
        });
      } catch (err) {
        log.error({ err, ruleId: rule.id }, 'Failed to execute cron rule');
      }
    }
  }
}
