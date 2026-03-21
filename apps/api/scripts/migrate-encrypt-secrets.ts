/**
 * Data migration: Encrypt plaintext webhook secrets and Slack webhook URLs.
 *
 * Usage: cd apps/api && npx tsx scripts/migrate-encrypt-secrets.ts
 *
 * Requires ENCRYPTION_MASTER_KEY and DATABASE_URL in .env.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { encryptApiKey, isEncrypted } from '../src/utils/encryption.js';

async function main() {
  const prisma = new PrismaClient();

  try {
    // --- Webhook secrets ---
    const webhooks = await prisma.webhookEndpoint.findMany();
    let encryptedSecrets = 0;
    let skippedSecrets = 0;

    for (const wh of webhooks) {
      if (!wh.secret || isEncrypted(wh.secret)) {
        skippedSecrets++;
        continue;
      }
      try {
        const encrypted = encryptApiKey(wh.secret);
        await prisma.webhookEndpoint.update({
          where: { id: wh.id },
          data: { secret: encrypted },
        });
        encryptedSecrets++;
      } catch (err) {
        console.error(`Failed to encrypt webhook secret for endpoint ${wh.id}:`, err);
      }
    }

    // --- Slack webhook URLs ---
    const slackIntegrations = await prisma.slackIntegration.findMany();
    let encryptedUrls = 0;
    let skippedUrls = 0;

    for (const si of slackIntegrations) {
      if (!si.webhookUrl || isEncrypted(si.webhookUrl)) {
        skippedUrls++;
        continue;
      }
      try {
        const encrypted = encryptApiKey(si.webhookUrl);
        await prisma.slackIntegration.update({
          where: { id: si.id },
          data: { webhookUrl: encrypted },
        });
        encryptedUrls++;
      } catch (err) {
        console.error(`Failed to encrypt Slack webhook URL for integration ${si.id}:`, err);
      }
    }

    console.log(`Encrypted ${encryptedSecrets} webhook secrets (${skippedSecrets} already encrypted/null)`);
    console.log(`Encrypted ${encryptedUrls} Slack webhook URLs (${skippedUrls} already encrypted/null)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
