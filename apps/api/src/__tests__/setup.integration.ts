import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/tasktoad_test';

// Override DATABASE_URL so Prisma uses the test database
process.env.DATABASE_URL = TEST_DATABASE_URL;

export const prisma = new PrismaClient({
  datasourceUrl: TEST_DATABASE_URL,
});

/**
 * Push the current schema to the test database (creates tables if needed).
 * Uses db push instead of migrate deploy for speed in test environments.
 */
export async function setupTestDatabase(): Promise<void> {
  const schemaPath = path.resolve(import.meta.dirname, '../../prisma/schema');
  execSync(`npx prisma db push --schema=${schemaPath} --skip-generate --accept-data-loss`, {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: 'pipe',
  });
}

/**
 * Truncate all tables (in correct order to avoid FK violations).
 */
export async function cleanDatabase(): Promise<void> {
  // Prisma model names → table names in PostgreSQL are quoted to preserve casing
  const tableNames = [
    'Activity',
    'Comment',
    'AIPromptLog',
    'AIUsageLog',
    'CustomFieldValue',
    'CustomField',
    'TaskLabel',
    'Attachment',
    'TaskAssignee',
    'Label',
    'GitHubPullRequestLink',
    'GitHubCommitLink',
    'GitHubInstallation',
    'Notification',
    'NotificationPreference',
    'WebhookDelivery',
    'WebhookEndpoint',
    'SlackUserMapping',
    'SlackIntegration',
    'AutomationRule',
    'ProjectMember',
    'Report',
    'SavedFilter',
    'TaskTemplate',
    'Task',
    'Sprint',
    'Project',
    'OrgInvite',
    'User',
    'Org',
  ];

  // Use a single TRUNCATE CASCADE for all tables
  const quoted = tableNames.map((t) => `"${t}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} CASCADE`);
}

/**
 * Disconnect the test Prisma client.
 */
export async function teardownTestDatabase(): Promise<void> {
  await prisma.$disconnect();
}
