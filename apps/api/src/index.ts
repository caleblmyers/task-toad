import { PrismaClient } from '@prisma/client';
import app from './app.js';
import { logger } from './utils/logger.js';
import { checkDueDateReminders } from './utils/dueDateReminder.js';

const prisma = new PrismaClient();
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
  logger.info({ port: PORT }, `TaskToad API listening on http://localhost:${PORT}`);
  // Check due date reminders every 15 minutes
  setInterval(() => checkDueDateReminders(prisma).catch(err => logger.error({ err }, 'Due date reminder check failed')), 15 * 60 * 1000);
});
