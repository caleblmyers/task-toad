-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "sprint_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reports_project_id_type_created_at_idx" ON "reports"("project_id", "type", "created_at");

-- CreateIndex
CREATE INDEX "reports_org_id_created_at_idx" ON "reports"("org_id", "created_at");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
