import * as Sentry from '@sentry/node';
import { PrismaClient } from '@prisma/client';
import app from './app.js';
import { logger } from './utils/logger.js';
import { checkDueDateReminders } from './utils/dueDateReminder.js';
import { startRetryProcessor, stopRetryProcessor } from './utils/webhookDispatcher.js';
import { sseManager } from './utils/sseManager.js';
import { startRecurrenceScheduler, stopRecurrenceScheduler } from './utils/recurrenceScheduler.js';
import { cleanExpiredPromptLogs } from './utils/promptRetention.js';
import { withAdvisoryLock, LOCK_IDS } from './utils/advisoryLock.js';

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
    if (!process.env.ANTHROPIC_API_KEY) {
      logger.warn('ANTHROPIC_API_KEY is not set — AI features will be unavailable');
    }
    if (
      !process.env.ENCRYPTION_MASTER_KEY ||
      process.env.ENCRYPTION_MASTER_KEY === 'change-me-to-a-64-char-hex-string'
    ) {
      logger.warn('ENCRYPTION_MASTER_KEY is using the default value — this is insecure in production');
    }
  }

  // Wrap background jobs with advisory locks so only one replica runs each
  const lockedReminders = withAdvisoryLock(prisma, LOCK_IDS.DUE_DATE_REMINDERS, checkDueDateReminders);
  const lockedPromptCleanup = withAdvisoryLock(prisma, LOCK_IDS.PROMPT_CLEANUP, cleanExpiredPromptLogs);

  const reminderInterval = setInterval(
    () => lockedReminders().catch(err => logger.error({ err }, 'Due date reminder check failed')),
    15 * 60 * 1000,
  );

  // Clean expired AI prompt logs every 6 hours
  const promptCleanupInterval = setInterval(
    () => lockedPromptCleanup().catch(err => logger.error({ err }, 'Prompt log cleanup failed')),
    6 * 60 * 60 * 1000,
  );
  // Run once at startup too
  lockedPromptCleanup().catch(err => logger.error({ err }, 'Initial prompt log cleanup failed'));

  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, `TaskToad API listening on http://localhost:${PORT}`);
  });

  startRetryProcessor(prisma);
  const recurrenceTimer = startRecurrenceScheduler(prisma);

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down gracefully...');

    // Force-kill timeout to prevent zombie processes
    const forceKillTimeout = setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, 10_000);
    forceKillTimeout.unref();

    clearInterval(reminderInterval);
    clearInterval(promptCleanupInterval);
    stopRetryProcessor();
    stopRecurrenceScheduler(recurrenceTimer);
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
