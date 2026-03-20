/**
 * Deletes all test data tracked in .ai/bugs/test-data.json from the database.
 * Deletes in reverse dependency order to respect FK constraints.
 *
 * Usage: cd apps/api && npx tsx ../../scripts/testswarm/cleanup-test-data.ts
 */

import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TRACKER_PATH = resolve(__dirname, '../../.ai/bugs/test-data.json');

interface TestData {
  users: string[];
  orgs: string[];
  projects: string[];
  tasks: string[];
  sprints: string[];
  comments: string[];
  labels: string[];
  webhooks: string[];
  slackIntegrations: string[];
}

async function main() {
  if (!existsSync(TRACKER_PATH)) {
    console.log('No test-data.json found — nothing to clean up.');
    process.exit(0);
  }

  const data: TestData = JSON.parse(readFileSync(TRACKER_PATH, 'utf8'));

  const totalItems = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
  if (totalItems === 0) {
    console.log('Test data tracker is empty — nothing to clean up.');
    process.exit(0);
  }

  console.log('Test data to delete:');
  for (const [key, ids] of Object.entries(data)) {
    if ((ids as string[]).length > 0) console.log(`  ${key}: ${(ids as string[]).length}`);
  }

  const prisma = new PrismaClient();

  try {
    // Delete in reverse dependency order (children before parents)

    if (data.comments.length > 0) {
      const r = await prisma.comment.deleteMany({ where: { commentId: { in: data.comments } } });
      console.log(`Deleted ${r.count} comments`);
    }

    if (data.labels.length > 0) {
      await prisma.taskLabel.deleteMany({ where: { labelId: { in: data.labels } } });
      const r = await prisma.label.deleteMany({ where: { labelId: { in: data.labels } } });
      console.log(`Deleted ${r.count} labels`);
    }

    if (data.tasks.length > 0) {
      await prisma.taskAssignee.deleteMany({ where: { taskId: { in: data.tasks } } });
      await prisma.taskLabel.deleteMany({ where: { taskId: { in: data.tasks } } });
      await prisma.task.updateMany({ where: { parentTaskId: { in: data.tasks } }, data: { parentTaskId: null } });
      await prisma.activity.deleteMany({ where: { taskId: { in: data.tasks } } });
      await prisma.comment.deleteMany({ where: { taskId: { in: data.tasks } } });
      await prisma.customFieldValue.deleteMany({ where: { taskId: { in: data.tasks } } });
      await prisma.notification.deleteMany({ where: { relatedTaskId: { in: data.tasks } } });
      await prisma.releaseTask.deleteMany({ where: { taskId: { in: data.tasks } } });
      await prisma.gitHubPullRequestLink.deleteMany({ where: { taskId: { in: data.tasks } } });
      await prisma.gitHubCommitLink.deleteMany({ where: { taskId: { in: data.tasks } } });
      await prisma.taskAction.deleteMany({ where: { plan: { taskId: { in: data.tasks } } } });
      await prisma.taskActionPlan.deleteMany({ where: { taskId: { in: data.tasks } } });
      await prisma.taskWatcher.deleteMany({ where: { taskId: { in: data.tasks } } });
      await prisma.taskDependency.deleteMany({ where: { OR: [{ sourceTaskId: { in: data.tasks } }, { targetTaskId: { in: data.tasks } }] } });
      await prisma.aIPromptLog.deleteMany({ where: { taskId: { in: data.tasks } } });
      // timeEntry table may not exist if migrations are pending — ignore errors
      try { await prisma.timeEntry.deleteMany({ where: { taskId: { in: data.tasks } } }); } catch (_) { /* table may not exist */ }
      const r = await prisma.task.deleteMany({ where: { taskId: { in: data.tasks } } });
      console.log(`Deleted ${r.count} tasks`);
    }

    if (data.sprints.length > 0) {
      await prisma.task.updateMany({ where: { sprintId: { in: data.sprints } }, data: { sprintId: null, sprintColumn: null } });
      const r = await prisma.sprint.deleteMany({ where: { sprintId: { in: data.sprints } } });
      console.log(`Deleted ${r.count} sprints`);
    }

    if (data.webhooks.length > 0) {
      await prisma.webhookDelivery.deleteMany({ where: { endpointId: { in: data.webhooks } } });
      const r = await prisma.webhookEndpoint.deleteMany({ where: { id: { in: data.webhooks } } });
      console.log(`Deleted ${r.count} webhook endpoints`);
    }

    if (data.slackIntegrations.length > 0) {
      await prisma.slackUserMapping.deleteMany({ where: { slackIntegrationId: { in: data.slackIntegrations } } });
      const r = await prisma.slackIntegration.deleteMany({ where: { id: { in: data.slackIntegrations } } });
      console.log(`Deleted ${r.count} Slack integrations`);
    }

    if (data.projects.length > 0) {
      await prisma.activity.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.notification.deleteMany({ where: { relatedProjectId: { in: data.projects } } });
      await prisma.customFieldValue.deleteMany({ where: { customField: { projectId: { in: data.projects } } } });
      await prisma.customField.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.releaseTask.deleteMany({ where: { release: { projectId: { in: data.projects } } } });
      await prisma.release.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.taskTemplate.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.workflowTransition.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.savedFilter.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.report.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.projectMember.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.automationRule.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.aIPromptLog.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.taskAssignee.deleteMany({ where: { task: { projectId: { in: data.projects } } } });
      await prisma.taskLabel.deleteMany({ where: { task: { projectId: { in: data.projects } } } });
      await prisma.comment.deleteMany({ where: { task: { projectId: { in: data.projects } } } });
      await prisma.task.deleteMany({ where: { projectId: { in: data.projects } } });
      await prisma.sprint.deleteMany({ where: { projectId: { in: data.projects } } });
      const r = await prisma.project.deleteMany({ where: { projectId: { in: data.projects } } });
      console.log(`Deleted ${r.count} projects`);
    }

    if (data.orgs.length > 0) {
      await prisma.orgInvite.deleteMany({ where: { orgId: { in: data.orgs } } });
      await prisma.aIPromptLog.deleteMany({ where: { orgId: { in: data.orgs } } });
      await prisma.gitHubInstallation.deleteMany({ where: { orgId: { in: data.orgs } } });
      await prisma.webhookEndpoint.deleteMany({ where: { orgId: { in: data.orgs } } });
      await prisma.slackIntegration.deleteMany({ where: { orgId: { in: data.orgs } } });
      await prisma.label.deleteMany({ where: { orgId: { in: data.orgs } } });
      await prisma.user.updateMany({ where: { orgId: { in: data.orgs } }, data: { orgId: null, role: null } });
      const r = await prisma.org.deleteMany({ where: { orgId: { in: data.orgs } } });
      console.log(`Deleted ${r.count} orgs`);
    }

    if (data.users.length > 0) {
      await prisma.notification.deleteMany({ where: { userId: { in: data.users } } });
      await prisma.taskAssignee.deleteMany({ where: { userId: { in: data.users } } });
      await prisma.projectMember.deleteMany({ where: { userId: { in: data.users } } });
      const r = await prisma.user.deleteMany({ where: { userId: { in: data.users } } });
      console.log(`Deleted ${r.count} users`);
    }

    console.log('\nTest data cleanup complete.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
