-- AlterTable
ALTER TABLE "orgs" ADD COLUMN "trial_ends_at" TIMESTAMP(3),
ADD COLUMN "stripe_customer_id" TEXT,
ADD COLUMN "stripe_subscription_id" TEXT;
