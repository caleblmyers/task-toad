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
 * Retries on failure to handle fire-and-forget async operations
 * (event listeners writing activities, notifications, etc.) that
 * may still be in-flight from the previous test.
 */
export async function cleanDatabase(): Promise<void> {
  // Actual PostgreSQL table names from @@map() directives in Prisma schema
  // Must include ALL tables — missing ones cause unique constraint / FK errors
  const tableNames = [
    // Action plans & actions (depend on tasks)
    'task_actions',
    'task_action_plans',
    // Activity & comments
    'activities',
    'comments',
    // AI logs
    'ai_prompt_logs',
    'ai_usage_logs',
    // Task relations (depend on tasks)
    'custom_field_values',
    'custom_fields',
    'task_labels',
    'attachments',
    'task_assignees',
    'task_watchers',
    'task_dependencies',
    'task_insights',
    'labels',
    // GitHub
    'github_pull_request_links',
    'github_commit_links',
    'github_installations',
    // Notifications
    'notifications',
    'notification_preferences',
    // Webhooks
    'webhook_deliveries',
    'webhook_endpoints',
    // Slack
    'slack_user_mappings',
    'slack_integrations',
    // Project relations
    'automation_rules',
    'project_members',
    'reports',
    'saved_filters',
    'task_templates',
    // SLA (depend on tasks/projects)
    'sla_timers',
    'sla_policies',
    // Approvals
    'approvals',
    // Releases (depend on tasks/projects)
    'release_tasks',
    'releases',
    // Workflow
    'workflow_transitions',
    // Time tracking
    'time_entries',
    // Knowledge base
    'knowledge_entries',
    // Initiatives (depend on projects)
    'initiative_projects',
    'initiatives',
    // Capacity
    'user_time_off',
    'user_capacities',
    // Field permissions
    'field_permissions',
    // Core entities
    'tasks',
    'sprints',
    'projects',
    'org_invites',
    'refresh_tokens',
    'users',
    'orgs',
  ];

  // Use a single TRUNCATE CASCADE for all tables.
  // Retry up to 3 times to handle fire-and-forget async operations
  // (activity logging, notification creation, SLA timer updates, etc.)
  // that may still be writing from the previous test.
  const quoted = tableNames.map((t) => `"${t}"`).join(', ');
  const maxRetries = 3;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoted} CASCADE`);
      return;
    } catch (err) {
      if (attempt === maxRetries) throw err;
      // Brief delay to let in-flight async operations complete
      await new Promise((r) => setTimeout(r, 100));
    }
  }
}

/**
 * Disconnect the test Prisma client.
 */
export async function teardownTestDatabase(): Promise<void> {
  await prisma.$disconnect();
}
