-- AlterTable
ALTER TABLE "ai_prompt_logs" ALTER COLUMN "expires_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "github_login" TEXT,
ADD COLUMN     "github_token_encrypted" TEXT;
