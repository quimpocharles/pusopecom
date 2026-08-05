-- CreateEnum
CREATE TYPE "BonusFitCheckReason" AS ENUM ('profile_complete', 'email_verified', 'first_purchase', 'birthday', 'referral', 'admin_grant', 'campaign');

-- AlterTable
ALTER TABLE "site_settings" ADD COLUMN     "fitCheckBonusEmailVerified" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "fitCheckBonusEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "fitCheckBonusFirstPurchase" INTEGER NOT NULL DEFAULT 2,
ADD COLUMN     "fitCheckBonusProfileComplete" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "bonus_fit_check_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reason" "BonusFitCheckReason" NOT NULL,
    "amount" INTEGER NOT NULL,
    "consumedCount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bonus_fit_check_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "bonus_fit_check_grants_userId_idx" ON "bonus_fit_check_grants"("userId");

-- AddForeignKey
ALTER TABLE "bonus_fit_check_grants" ADD CONSTRAINT "bonus_fit_check_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
