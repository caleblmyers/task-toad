-- CreateTable
CREATE TABLE "task_action_plans" (
    "action_plan_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "summary" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_action_plans_pkey" PRIMARY KEY ("action_plan_id")
);

-- CreateTable
CREATE TABLE "task_actions" (
    "action_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "action_type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requires_approval" BOOLEAN NOT NULL DEFAULT true,
    "result" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_actions_pkey" PRIMARY KEY ("action_id")
);

-- CreateIndex
CREATE INDEX "task_action_plans_task_id_idx" ON "task_action_plans"("task_id");

-- CreateIndex
CREATE INDEX "task_action_plans_org_id_status_idx" ON "task_action_plans"("org_id", "status");

-- CreateIndex
CREATE INDEX "task_actions_plan_id_position_idx" ON "task_actions"("plan_id", "position");

-- AddForeignKey
ALTER TABLE "task_action_plans" ADD CONSTRAINT "task_action_plans_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_actions" ADD CONSTRAINT "task_actions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "task_action_plans"("action_plan_id") ON DELETE CASCADE ON UPDATE CASCADE;
