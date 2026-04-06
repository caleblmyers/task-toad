import * as Sentry from '@sentry/node';
import { PrismaClient } from '@prisma/client';
import app from './app.js';
import { logger } from './utils/logger.js';
import { sseManager } from './utils/sseManager.js';
import { createInfrastructure } from './infrastructure/bootstrap.js';

const prisma = new PrismaClient();
const PORT = Number(process.env.PORT) || 3001;

async function main() {
  // Initialize Sentry error tracking (gracefully skips if DSN not set)
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV ?? 'development',
      release: `tasktoad-api@${process.env.npm_package_version ?? '0.1.0'}`,
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    });
    logger.info('Sentry error tracking initialized');
  } else {
    logger.debug('SENTRY_DSN not set — Sentry error tracking disabled');
  }
  // Verify DB connectivity before accepting requests
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection verified');

    // Log connection pool configuration from DATABASE_URL
    const dbUrl = process.env.DATABASE_URL ?? '';
    try {
      const params = new URL(dbUrl).searchParams;
      const connectionLimit = params.get('connection_limit') ?? 'default';
      const poolTimeout = params.get('pool_timeout') ?? 'default';
      logger.info({ connectionLimit, poolTimeout }, 'Prisma pool configuration');
    } catch {
      logger.debug('Could not parse DATABASE_URL for pool config logging');
    }
  } catch (err) {
    logger.fatal({ err }, 'Failed to connect to database — exiting');
    process.exit(1);
  }

  // Warn about missing production config
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.SMTP_HOST) {
      logger.warn('SMTP_HOST is not set — email notifications will not be sent');
    }
    if (
      !process.env.ENCRYPTION_MASTER_KEY ||
      process.env.ENCRYPTION_MASTER_KEY === 'change-me-to-a-64-char-hex-string'
    ) {
      logger.warn('ENCRYPTION_MASTER_KEY is using the default value — this is insecure in production');
    }
  }

  // Clean up expired refresh tokens on startup (fire-and-forget)
  prisma.refreshToken.deleteMany({ where: { expiresAt: { lt: new Date() } } })
    .then((result) => logger.info({ count: result.count }, 'Cleaned up expired refresh tokens'))
    .catch((err) => logger.warn({ err }, 'Failed to clean up expired refresh tokens'));

  // Initialize event bus + job queue + cron scheduler infrastructure
  const { jobQueue, cronScheduler, slaBreachChecker } = createInfrastructure(prisma);
  jobQueue.start();
  cronScheduler.start();
  slaBreachChecker.start();

  // Recover stuck state from before a server restart.
  // Any action in "executing" for >5 min is likely abandoned (in-memory state lost).
  // Any session in "running" with no executing plans is orphaned.
  const stuckCutoff = new Date(Date.now() - 5 * 60 * 1000);
  (async () => {
    try {
      // Reset stuck actions
      const stuckActions = await prisma.taskAction.updateMany({
        where: { status: 'executing', startedAt: { lt: stuckCutoff } },
        data: { status: 'failed', errorMessage: 'Interrupted by server restart — retry to continue' },
      });
      if (stuckActions.count > 0) {
        logger.info({ count: stuckActions.count }, 'Reset stuck executing actions');
      }

      // Fail plans that had executing actions
      const stuckPlans = await prisma.taskActionPlan.updateMany({
        where: {
          status: 'executing',
          updatedAt: { lt: stuckCutoff },
          actions: { none: { status: { in: ['pending', 'executing'] } } },
        },
        data: { status: 'failed' },
      });
      if (stuckPlans.count > 0) {
        logger.info({ count: stuckPlans.count }, 'Reset stuck executing plans');
      }

      // Cancel orphaned running sessions (no executing plans)
      const runningSessions = await prisma.session.findMany({
        where: { status: 'running', startedAt: { lt: stuckCutoff } },
      });
      for (const session of runningSessions) {
        const taskIds = JSON.parse(session.taskIds) as string[];
        const activePlans = await prisma.taskActionPlan.count({
          where: { taskId: { in: taskIds }, status: { in: ['approved', 'executing'] } },
        });
        if (activePlans === 0) {
          await prisma.session.update({
            where: { id: session.id },
            data: { status: 'paused', pausedAt: new Date() },
          });
          logger.info({ sessionId: session.id }, 'Paused orphaned running session');
        }
      }
    } catch (err) {
      logger.warn({ err }, 'Failed to recover stuck state on startup');
    }
  })();

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, `TaskToad API listening on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully...');

    // Force-kill timeout to prevent zombie processes
    const forceKillTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000);
    forceKillTimeout.unref();

    await cronScheduler.stop();
    slaBreachChecker.stop();
    await jobQueue.shutdown();
    sseManager.closeAllConnections();

    server.close(() => {
      logger.info('HTTP server closed');
    });

    try {
      await prisma.$disconnect();
      logger.info('Prisma disconnected');
    } catch (err) {
      logger.error({ err }, 'Error disconnecting Prisma');
    }

    // Flush pending Sentry events before exiting
    try {
      await Sentry.close(2000);
    } catch {
      // Best-effort flush — don't block shutdown
    }

    process.exit(0);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (reason) => {
  logger.fatal({ err: reason }, 'Unhandled rejection — exiting');
  process.exit(1);
});

process.on('uncaughtException', (err) => {
  logger.fatal({ err }, 'Uncaught exception — exiting');
  process.exit(1);
});

main();
