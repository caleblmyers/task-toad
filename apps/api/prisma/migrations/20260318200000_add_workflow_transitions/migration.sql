-- CreateTable
CREATE TABLE "workflow_transitions" (
    "transition_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "from_status" TEXT NOT NULL,
    "to_status" TEXT NOT NULL,
    "allowed_roles" TEXT,
    "condition" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("transition_id")
);

-- CreateIndex
CREATE INDEX "workflow_transitions_project_id_idx" ON "workflow_transitions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_transitions_project_id_from_status_to_status_key" ON "workflow_transitions"("project_id", "from_status", "to_status");

-- AddForeignKey
ALTER TABLE "workflow_transitions" ADD CONSTRAINT "workflow_transitions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;
