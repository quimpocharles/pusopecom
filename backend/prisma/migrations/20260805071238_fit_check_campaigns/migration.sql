-- AlterTable
ALTER TABLE "try_on_logs" ADD COLUMN     "fitCheckCampaignId" TEXT;

-- CreateTable
CREATE TABLE "fit_check_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sponsorName" TEXT NOT NULL,
    "organizationId" TEXT,
    "productIds" TEXT[],
    "category" "ProductCategory",
    "unlimitedFitChecks" BOOLEAN NOT NULL DEFAULT true,
    "bannerImage" TEXT,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "ctaLabel" TEXT,
    "ctaLink" TEXT,
    "landingPageUrl" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fit_check_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fit_check_campaigns_active_priority_idx" ON "fit_check_campaigns"("active", "priority");

-- AddForeignKey
ALTER TABLE "fit_check_campaigns" ADD CONSTRAINT "fit_check_campaigns_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_logs" ADD CONSTRAINT "try_on_logs_fitCheckCampaignId_fkey" FOREIGN KEY ("fitCheckCampaignId") REFERENCES "fit_check_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;
