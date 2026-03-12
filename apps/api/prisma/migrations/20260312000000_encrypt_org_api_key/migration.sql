-- Rename column to signal the value is now encrypted (AES-256-GCM).
-- Any existing plaintext values in this column will remain but become unreadable
-- until re-entered through the settings UI, which will encrypt them on save.
ALTER TABLE "orgs" RENAME COLUMN "anthropic_api_key" TO "anthropic_api_key_encrypted";
