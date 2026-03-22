-- AlterTable
ALTER TABLE "sla_policies" ADD COLUMN "business_hours_start" INTEGER NOT NULL DEFAULT 9,
ADD COLUMN "business_hours_end" INTEGER NOT NULL DEFAULT 17,
ADD COLUMN "exclude_weekends" BOOLEAN NOT NULL DEFAULT true;
