-- CreateTable
CREATE TABLE "custom_fields" (
    "custom_field_id" TEXT NOT NULL,
    "org_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "field_type" TEXT NOT NULL,
    "options" TEXT,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "custom_fields_pkey" PRIMARY KEY ("custom_field_id")
);

-- CreateTable
CREATE TABLE "custom_field_values" (
    "custom_field_value_id" TEXT NOT NULL,
    "custom_field_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_field_values_pkey" PRIMARY KEY ("custom_field_value_id")
);

-- CreateTable
CREATE TABLE "saved_filters" (
    "saved_filter_id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "filters" TEXT NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "saved_filters_pkey" PRIMARY KEY ("saved_filter_id")
);

-- CreateIndex
CREATE INDEX "custom_fields_project_id_idx" ON "custom_fields"("project_id");

-- CreateIndex
CREATE INDEX "custom_fields_org_id_idx" ON "custom_fields"("org_id");

-- CreateIndex
CREATE UNIQUE INDEX "custom_field_values_custom_field_id_task_id_key" ON "custom_field_values"("custom_field_id", "task_id");

-- CreateIndex
CREATE INDEX "custom_field_values_task_id_idx" ON "custom_field_values"("task_id");

-- CreateIndex
CREATE INDEX "custom_field_values_custom_field_id_idx" ON "custom_field_values"("custom_field_id");

-- CreateIndex
CREATE INDEX "saved_filters_project_id_idx" ON "saved_filters"("project_id");

-- CreateIndex
CREATE INDEX "saved_filters_user_id_idx" ON "saved_filters"("user_id");

-- AddForeignKey
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_org_id_fkey" FOREIGN KEY ("org_id") REFERENCES "orgs"("org_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_fields" ADD CONSTRAINT "custom_fields_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_custom_field_id_fkey" FOREIGN KEY ("custom_field_id") REFERENCES "custom_fields"("custom_field_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "custom_field_values" ADD CONSTRAINT "custom_field_values_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "tasks"("task_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("project_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "saved_filters" ADD CONSTRAINT "saved_filters_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
