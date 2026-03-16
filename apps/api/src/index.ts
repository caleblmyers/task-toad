import { PrismaClient } from '@prisma/client';
import app from './app.js';
import { logger } from './utils/logger.js';
import { checkDueDateReminders } from './utils/dueDateReminder.js';

const prisma = new PrismaClient();
const PORT = Number(process.env.PORT) || 3001;

async function main() {
  // Verify DB connectivity before accepting requests
  try {
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection verified');
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

  const reminderInterval = setInterval(
    () => checkDueDateReminders(prisma).catch(err => logger.error({ err }, 'Due date reminder check failed')),
    15 * 60 * 1000,
  );

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

    clearInterval(reminderInterval);

    server.close(() => {
      logger.info('HTTP server closed');
    });

    try {
      await prisma.$disconnect();
      logger.info('Prisma disconnected');
    } catch (err) {
      logger.error({ err }, 'Error disconnecting Prisma');
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
