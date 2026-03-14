-- AlterTable: Update default statuses to include "in_review"
ALTER TABLE "projects" ALTER COLUMN "statuses" SET DEFAULT '["todo","in_progress","in_review","done"]';

-- AlterTable: Update default sprint columns to include "In Review"
ALTER TABLE "sprints" ALTER COLUMN "columns" SET DEFAULT '["To Do","In Progress","In Review","Done"]';
