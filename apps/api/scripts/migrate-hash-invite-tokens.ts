/**
 * Data migration: Hash plaintext invite tokens.
 *
 * WARNING: Hashing tokens invalidates any outstanding invite links.
 * Run with --confirm to proceed.
 *
 * Usage: cd apps/api && npx tsx scripts/migrate-hash-invite-tokens.ts --confirm
 *
 * Requires DATABASE_URL in .env.
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashToken } from '../src/utils/token.js';

function isAlreadyHashed(token: string): boolean {
  // SHA-256 hash = 64 hex characters
  return /^[0-9a-f]{64}$/.test(token);
}

function isRawUUID(token: string): boolean {
  // Raw UUID = 36 characters with dashes (8-4-4-4-12)
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
}

async function main() {
  if (!process.argv.includes('--confirm')) {
    console.warn('⚠️  WARNING: Hashing invite tokens will invalidate ALL outstanding invite links.');
    console.warn('   Users with pending invites will need to be re-invited.');
    console.warn('');
    console.warn('   Run with --confirm to proceed:');
    console.warn('   npx tsx scripts/migrate-hash-invite-tokens.ts --confirm');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    const invites = await prisma.orgInvite.findMany();
    let hashed = 0;
    let alreadyHashed = 0;
    let skipped = 0;

    for (const invite of invites) {
      if (!invite.token) {
        skipped++;
        continue;
      }

      if (isAlreadyHashed(invite.token)) {
        alreadyHashed++;
        continue;
      }

      if (isRawUUID(invite.token)) {
        try {
          const hashedToken = hashToken(invite.token);
          await prisma.orgInvite.update({
            where: { inviteId: invite.inviteId },
            data: { token: hashedToken },
          });
          hashed++;
        } catch (err) {
          console.error(`Failed to hash token for invite ${invite.inviteId}:`, err);
        }
      } else {
        // Token format not recognized — skip to be safe
        skipped++;
      }
    }

    console.log(`Hashed ${hashed} invite tokens (${alreadyHashed} already hashed, ${skipped} skipped)`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
