-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "orderExpirationEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "orderRetentionHours" INTEGER NOT NULL DEFAULT 48;
