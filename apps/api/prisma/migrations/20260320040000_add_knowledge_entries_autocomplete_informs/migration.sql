-- CreateTable
CREATE TABLE "knowledge_entries" (
    "knowledge_entry_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "category" TEXT NOT NULL DEFAULT 'standard',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_entries_pkey" PRIMARY KEY ("knowledge_entry_id")
);

-- CreateIndex
CREATE INDEX "knowledge_entries_project_id_idx" ON "knowledge_entries"("project_id");

-- CreateIndex
CREATE INDEX "knowledge_entries_org_id_idx" ON "knowledge_entries"("org_id");

-- AddForeignKey
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_entries" ADD CONSTRAINT "knowledge_entries_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable: Add autoComplete to tasks
ALTER TABLE "tasks" ADD COLUMN "auto_complete" BOOLEAN NOT NULL DEFAULT false;
