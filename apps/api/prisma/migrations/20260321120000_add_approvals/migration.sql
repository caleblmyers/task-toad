-- CreateTable
CREATE TABLE "approvals" (
    "approval_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "requested_by_id" TEXT NOT NULL,
    "approver_id" TEXT,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "decided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("approval_id")
);

-- CreateIndex
CREATE INDEX "approvals_task_id_idx" ON "approvals"("task_id");

-- CreateIndex
CREATE INDEX "approvals_approver_id_status_idx" ON "approvals"("approver_id", "status");

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_approver_id_fkey" FOREIGN KEY ("approver_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
