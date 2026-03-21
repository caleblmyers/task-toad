-- CreateTable
CREATE TABLE "field_permissions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "field_name" TEXT NOT NULL,
    "allowed_roles" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "field_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_permissions_project_id_idx" ON "field_permissions"("project_id");

-- CreateIndex
CREATE UNIQUE INDEX "field_permissions_project_id_field_name_key" ON "field_permissions"("project_id", "field_name");

-- AddForeignKey
ALTER TABLE "field_permissions" ADD CONSTRAINT "field_permissions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;
