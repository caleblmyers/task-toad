-- CreateTable
CREATE TABLE "task_dependencies" (
    "task_dependency_id" TEXT NOT NULL,
    "source_task_id" TEXT NOT NULL,
    "target_task_id" TEXT NOT NULL,
    "link_type" TEXT NOT NULL DEFAULT 'blocks',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_dependencies_pkey" PRIMARY KEY ("task_dependency_id")
);

-- CreateIndex
CREATE INDEX "task_dependencies_source_task_id_idx" ON "task_dependencies"("source_task_id");

-- CreateIndex
CREATE INDEX "task_dependencies_target_task_id_idx" ON "task_dependencies"("target_task_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_dependencies_source_task_id_target_task_id_link_type_key" ON "task_dependencies"("source_task_id", "target_task_id", "link_type");

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_dependencies" ADD CONSTRAINT "task_dependencies_target_task_id_fkey" FOREIGN KEY ("target_task_id") REFERENCES "tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;
