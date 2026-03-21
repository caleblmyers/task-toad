-- CreateTable
CREATE TABLE "sla_policies" (
    "sla_policy_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "response_time_hours" INTEGER NOT NULL,
    "resolution_time_hours" INTEGER NOT NULL,
    "priority" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("sla_policy_id")
);

-- CreateTable
CREATE TABLE "sla_timers" (
    "sla_timer_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "responded_at" TIMESTAMP(3),
    "resolved_at" TIMESTAMP(3),
    "response_breached" BOOLEAN NOT NULL DEFAULT false,
    "resolution_breached" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "sla_timers_pkey" PRIMARY KEY ("sla_timer_id")
);

-- CreateIndex
CREATE INDEX "sla_policies_project_id_idx" ON "sla_policies"("project_id");

-- CreateIndex
CREATE INDEX "sla_policies_org_id_idx" ON "sla_policies"("org_id");

-- CreateIndex
CREATE INDEX "sla_timers_task_id_idx" ON "sla_timers"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "sla_timers_task_id_policy_id_key" ON "sla_timers"("task_id", "policy_id");

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_policies" ADD CONSTRAINT "sla_policies_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_timers" ADD CONSTRAINT "sla_timers_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_timers" ADD CONSTRAINT "sla_timers_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "sla_policies"("sla_policy_id") ON DELETE CASCADE ON UPDATE CASCADE;
