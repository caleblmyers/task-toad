-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "github_issue_node_id" TEXT,
ADD COLUMN "github_issue_number" INTEGER;

-- CreateTable
CREATE TABLE "github_commit_links" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "sha" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "author" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "github_commit_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "github_pull_request_links" (
    "id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "pr_node_id" TEXT NOT NULL,
    "pr_number" INTEGER NOT NULL,
    "pr_url" TEXT NOT NULL,
    "pr_title" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "github_pull_request_links_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "github_commit_links_task_id_idx" ON "github_commit_links"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "github_commit_links_sha_task_id_key" ON "github_commit_links"("sha", "task_id");

-- CreateIndex
CREATE INDEX "github_pull_request_links_task_id_idx" ON "github_pull_request_links"("task_id");

-- AddForeignKey
ALTER TABLE "github_commit_links" ADD CONSTRAINT "github_commit_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "github_pull_request_links" ADD CONSTRAINT "github_pull_request_links_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE RESTRICT ON UPDATE CASCADE;
