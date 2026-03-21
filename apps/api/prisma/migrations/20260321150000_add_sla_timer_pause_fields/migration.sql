-- AlterTable
ALTER TABLE "sla_timers" ADD COLUMN "paused_at" TIMESTAMP(3),
ADD COLUMN "total_paused_ms" INTEGER NOT NULL DEFAULT 0;
