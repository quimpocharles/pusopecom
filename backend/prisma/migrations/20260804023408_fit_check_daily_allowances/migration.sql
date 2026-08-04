-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('registered', 'premium');

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "fitCheckDailyLimitGuest" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "fitCheckDailyLimitPremium" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "fitCheckDailyLimitRegistered" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "fitCheckGuestRetentionHours" INTEGER NOT NULL DEFAULT 24;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'registered';
