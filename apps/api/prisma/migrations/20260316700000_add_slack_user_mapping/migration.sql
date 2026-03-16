-- CreateTable
CREATE TABLE "slack_user_mappings" (
    "id" TEXT NOT NULL,
    "slack_user_id" TEXT NOT NULL,
    "slack_team_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "slack_user_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "slack_user_mappings_user_id_idx" ON "slack_user_mappings"("user_id");

-- CreateIndex
CREATE INDEX "slack_user_mappings_org_id_idx" ON "slack_user_mappings"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "slack_user_mappings_slack_team_id_slack_user_id_key" ON "slack_user_mappings"("slack_team_id", "slack_user_id");

-- AddForeignKey
ALTER TABLE "slack_user_mappings" ADD CONSTRAINT "slack_user_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "slack_user_mappings" ADD CONSTRAINT "slack_user_mappings_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;
