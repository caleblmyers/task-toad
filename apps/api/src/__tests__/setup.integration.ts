import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import path from 'path';
import { InProcessEventBus } from '../infrastructure/eventbus/inProcessAdapter.js';
import { setEventBus } from '../infrastructure/eventbus/index.js';
import { registerListeners } from '../infrastructure/listeners/index.js';

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://postgres:postgres@localhost:5432/tasktoad_test';

// Override DATABASE_URL so Prisma uses the test database
process.env.DATABASE_URL = TEST_DATABASE_URL;

export const prisma = new PrismaClient({
  datasourceUrl: TEST_DATABASE_URL,
});

// Initialize event bus for integration tests
const testEventBus = new InProcessEventBus();
setEventBus(testEventBus);
registerListeners(testEventBus, prisma);

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
  // Actual PostgreSQL table names from @@map() directives in Prisma schema
  const tableNames = [
    'activities',
    'comments',
    'ai_prompt_logs',
    'ai_usage_logs',
    'custom_field_values',
    'custom_fields',
    'task_labels',
    'attachments',
    'task_assignees',
    'labels',
    'github_pull_request_links',
    'github_commit_links',
    'github_installations',
    'notifications',
    'notification_preferences',
    'webhook_deliveries',
    'webhook_endpoints',
    'slack_user_mappings',
    'slack_integrations',
    'automation_rules',
    'project_members',
    'reports',
    'saved_filters',
    'task_templates',
    'tasks',
    'sprints',
    'projects',
    'org_invites',
    'refresh_tokens',
    'users',
    'orgs',
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
