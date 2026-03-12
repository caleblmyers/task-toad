-- AlterTable
ALTER TABLE "tasks" ADD COLUMN     "depends_on" TEXT,
ADD COLUMN     "estimated_hours" DOUBLE PRECISION,
ADD COLUMN     "priority" TEXT NOT NULL DEFAULT 'medium';
