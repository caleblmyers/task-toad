-- AlterTable users: add email verification and password reset fields
ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "verification_token" TEXT;
ALTER TABLE "users" ADD COLUMN "reset_token" TEXT;
ALTER TABLE "users" ADD COLUMN "reset_token_expiry" TIMESTAMP(3);

-- Grandfather existing users: mark them as already verified
UPDATE "users" SET "email_verified_at" = NOW() WHERE "email_verified_at" IS NULL;

-- CreateTable org_invites
CREATE TABLE "org_invites" (
    "invite_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'org:member',
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accepted_at" TIMESTAMP(3),

    CONSTRAINT "org_invites_pkey" PRIMARY KEY ("invite_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_verification_token_key" ON "users"("verification_token");
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");
CREATE UNIQUE INDEX "org_invites_token_key" ON "org_invites"("token");
CREATE INDEX "org_invites_token_idx" ON "org_invites"("token");
CREATE INDEX "org_invites_org_id_idx" ON "org_invites"("org_id");

-- AddForeignKey
ALTER TABLE "org_invites" ADD CONSTRAINT "org_invites_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;
