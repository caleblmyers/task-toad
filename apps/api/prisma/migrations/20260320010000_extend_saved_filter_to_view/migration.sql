-- AlterTable
ALTER TABLE "saved_filters" ADD COLUMN "view_type" TEXT,
ADD COLUMN "sort_by" TEXT,
ADD COLUMN "sort_order" TEXT,
ADD COLUMN "group_by" TEXT,
ADD COLUMN "visible_columns" TEXT,
ADD COLUMN "is_shared" BOOLEAN NOT NULL DEFAULT false;
