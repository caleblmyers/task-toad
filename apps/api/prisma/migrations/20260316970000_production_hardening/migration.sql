-- Production hardening: add verification token expiry and AI prompt log retention

-- Add verification_token_expiry to users table
ALTER TABLE "users" ADD COLUMN "verification_token_expiry" TIMESTAMP(3);

-- Add expires_at to ai_prompt_logs table for retention policy
ALTER TABLE "ai_prompt_logs" ADD COLUMN "expires_at" TIMESTAMP(3) NOT NULL DEFAULT (NOW() + INTERVAL '30 days');

-- Index for efficient expired prompt log cleanup
CREATE INDEX "ai_prompt_logs_expires_at_idx" ON "ai_prompt_logs"("expires_at");
