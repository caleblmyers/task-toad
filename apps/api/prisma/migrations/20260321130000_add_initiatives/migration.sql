-- CreateTable
CREATE TABLE "initiatives" (
    "initiative_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "target_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "initiatives_pkey" PRIMARY KEY ("initiative_id")
);

-- CreateTable
CREATE TABLE "initiative_projects" (
    "id" TEXT NOT NULL,
    "initiative_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "initiative_projects_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "initiatives_org_id_idx" ON "initiatives"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "initiative_projects_initiative_id_project_id_key" ON "initiative_projects"("initiative_id", "project_id");

-- AddForeignKey
ALTER TABLE "initiatives" ADD CONSTRAINT "initiatives_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_projects" ADD CONSTRAINT "initiative_projects_initiative_id_fkey" FOREIGN KEY ("initiative_id") REFERENCES "initiatives"("initiative_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initiative_projects" ADD CONSTRAINT "initiative_projects_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;
